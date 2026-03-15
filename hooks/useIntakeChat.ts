'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { calculatePriceRange, applyComplexityAdjustment, tightenPriceRange, type PriceRange } from '@/lib/pricing/engine'
import { expandWithDependencies } from '@/lib/modules/dependencies'
import type { QuickReplies } from '@/lib/intake-types'
import { getStoredSession } from '@/lib/session'

export type ChatMessage = {
  id: string
  role: 'user' | 'assistant'
  content: string
  displayContent?: string  // For user bubbles: shown text may differ from content sent to the API
  question?: string        // The question for this turn (shown as rows card header)
  capabilityCards?: string[]
  quickReplies?: QuickReplies
  sourceQuickReplies?: QuickReplies  // For user messages created by row selection: the original QR offered
  sourceQuestion?: string            // The question text that was shown when this row was selected
  isPause?: boolean                  // true = this turn is a conversation checkpoint (breather)
}

type UpdateProposalInput = {
  detected_modules: string[]
  confidence_score_delta: number
  complexity_multiplier: number
  updated_brief: string
  follow_up_question: string
  question?: string
  product_overview?: string
  capability_cards?: string[]
  quick_replies?: QuickReplies
  module_summaries?: { [moduleId: string]: string }
  suggest_pause?: boolean
  project_name?: string
}

type ApiMessage = { role: 'user' | 'assistant'; content: string }

type Props = {
  proposalId: string
  idea: string
}

const MSGS_KEY = (pid: string) => `lamba_msgs_${pid}`
const PROPOSAL_KEY = (pid: string) => `lamba_proposal_${pid}`
const EMAIL_VERIFIED_KEY = (pid: string) => `lamba_email_verified_${pid}`
const SYNCED_COUNT_KEY   = (pid: string) => `lamba_synced_count_${pid}`

export function useIntakeChat({ proposalId, idea }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [activeModules, setActiveModules] = useState<string[]>([])
  const [confidenceScore, setConfidenceScore] = useState(0)
  const [complexityMultiplier, setComplexityMultiplier] = useState(1.0)
  const [priceRange, setPriceRange] = useState<PriceRange>({ min: 0, max: 0 })
  const [isStreaming, setIsStreaming] = useState(false)
  const [productOverview, setProductOverview] = useState('')
  const [moduleSummaries, setModuleSummaries] = useState<{ [moduleId: string]: string }>({})
  const [projectName, setProjectName] = useState('')

  const messagesRef = useRef<ChatMessage[]>([])
  const confidenceRef = useRef(0)
  const activeModulesRef = useRef<string[]>([])
  const complexityRef = useRef(1.0)
  const productOverviewRef = useRef('')
  const moduleSummariesRef = useRef<{ [moduleId: string]: string }>({})
  const lastPauseTurn = useRef(-999)  // turn index of the last checkpoint (-999 = never)
  const turnCount = useRef(0)         // increments each time a tool_result is processed
  const streamIdRef = useRef<string>('')  // ID of the currently-active stream; used to prevent
                                          // stale streams from clobbering newer state

  useEffect(() => { messagesRef.current = messages }, [messages])
  useEffect(() => { confidenceRef.current = confidenceScore }, [confidenceScore])
  useEffect(() => { activeModulesRef.current = activeModules }, [activeModules])
  useEffect(() => { complexityRef.current = complexityMultiplier }, [complexityMultiplier])
  useEffect(() => { productOverviewRef.current = productOverview }, [productOverview])
  useEffect(() => { moduleSummariesRef.current = moduleSummaries }, [moduleSummaries])

  // Persist messages to localStorage after every update.
  // Also auto-saves to Supabase when email is verified and streaming is complete.
  useEffect(() => {
    if (messages.length > 0 && proposalId) {
      localStorage.setItem(MSGS_KEY(proposalId), JSON.stringify(messages))

      if (!isStreaming && localStorage.getItem(EMAIL_VERIFIED_KEY(proposalId))) {
        const storedSession = getStoredSession()
        if (storedSession?.sessionId) {
          const syncedCount = parseInt(
            localStorage.getItem(SYNCED_COUNT_KEY(proposalId)) ?? '0',
            10
          )
          const newMessages = messages.slice(syncedCount)
          if (newMessages.length > 0) {
            const newCount = messages.length
            // Include proposal metadata so Supabase has it for cross-device restore
            let syncBrief: string | undefined
            let syncModules: string[] | undefined
            let syncConfidence: number | undefined
            let syncMetadata: Record<string, unknown> | undefined
            try {
              const p = JSON.parse(localStorage.getItem(PROPOSAL_KEY(proposalId)) ?? '{}')
              if (typeof p.brief === 'string' && p.brief) syncBrief = p.brief
              if (Array.isArray(p.activeModules)) syncModules = p.activeModules
              if (typeof p.confidenceScore === 'number') syncConfidence = p.confidenceScore
              // Rich metadata for full-fidelity restore
              syncMetadata = {
                ...(typeof p.projectName === 'string' && p.projectName ? { projectName: p.projectName } : {}),
                ...(typeof p.productOverview === 'string' && p.productOverview ? { productOverview: p.productOverview } : {}),
                ...(p.moduleSummaries && typeof p.moduleSummaries === 'object' ? { moduleSummaries: p.moduleSummaries } : {}),
              }
            } catch { /* ignore */ }

            // Capture the last assistant message's QR state for restore
            const lastAssistant = [...messages].reverse().find(m => m.role === 'assistant' && !m.isPause)
            if (lastAssistant?.quickReplies && syncMetadata) {
              syncMetadata.lastQuestion = lastAssistant.question || undefined
              syncMetadata.lastQuickReplies = lastAssistant.quickReplies
            }

            fetch('/api/intake/sync-messages', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                proposalId,
                sessionId: storedSession.sessionId,
                messages: newMessages.map((m) => ({ role: m.role, content: m.content })),
                brief: syncBrief,
                modules: syncModules,
                confidenceScore: syncConfidence,
                metadata: syncMetadata,
              }),
            })
              .then(() =>
                localStorage.setItem(SYNCED_COUNT_KEY(proposalId), String(newCount))
              )
              .catch((e) => console.error('Auto-save error:', e))
          }
        }
      }
    }
  }, [messages, proposalId, isStreaming]) // eslint-disable-line react-hooks/exhaustive-deps

  // NOTE: Proposal state is saved inline (not via a reactive effect) to avoid a
  // mount-order bug: a reactive effect would fire before the restore effect and
  // overwrite the stored data with empty defaults before it could be read back.

  // Auto-send the idea on mount (fires once) — or restore stored messages
  useEffect(() => {
    if (!proposalId) return

    // Check for stored messages first
    const stored = localStorage.getItem(MSGS_KEY(proposalId))
    if (stored) {
      try {
        const parsed: ChatMessage[] = JSON.parse(stored)
        if (parsed.length > 0) {
          messagesRef.current = parsed
          setMessages(parsed)

          // Also restore proposal state so the panel isn't blank on reload
          const storedProposal = localStorage.getItem(PROPOSAL_KEY(proposalId))
          if (storedProposal) {
            try {
              const p = JSON.parse(storedProposal)
              const modules: string[] = Array.isArray(p.activeModules) ? p.activeModules : []
              const score: number = typeof p.confidenceScore === 'number' ? p.confidenceScore : 0
              const multiplier: number = typeof p.complexityMultiplier === 'number' ? p.complexityMultiplier : 1.0
              activeModulesRef.current = modules
              confidenceRef.current = score
              complexityRef.current = multiplier
              setActiveModules(modules)
              setConfidenceScore(score)
              setComplexityMultiplier(multiplier)
              setPriceRange(computePriceRange(modules, multiplier, score))
              if (typeof p.productOverview === 'string' && p.productOverview) setProductOverview(p.productOverview)
              if (p.moduleSummaries && typeof p.moduleSummaries === 'object') setModuleSummaries(p.moduleSummaries)
              if (typeof p.projectName === 'string' && p.projectName) setProjectName(p.projectName)
            } catch {
              // Ignore — non-critical, proposal panel will just be empty
            }
          }

          return // Skip auto-send — conversation already exists
        }
      } catch {
        // Ignore parse errors, fall through to auto-send
      }
    }

    // No stored messages — auto-send the idea
    if (!idea.trim()) return

    const userMessage: ChatMessage = { id: crypto.randomUUID(), role: 'user', content: idea }
    messagesRef.current = [userMessage]
    setMessages([userMessage])

    streamAIResponse([{ role: 'user', content: idea }])
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function computePriceRange(modules: string[], multiplier: number, score: number): PriceRange {
    const base = calculatePriceRange(modules)
    const adjusted = applyComplexityAdjustment(base, multiplier)
    return tightenPriceRange(adjusted, score)
  }

  // Streams from /api/intake/chat with the given API message history.
  // Adds an empty assistant message first, then fills it in as tokens arrive.
  async function streamAIResponse(apiMessages: ApiMessage[]) {
    // Capture a unique ID for this stream invocation so stale streams (still draining
    // after the user submitted a new message) can be identified and their side-effects
    // suppressed without cancelling the HTTP request itself.
    const myStreamId = crypto.randomUUID()
    streamIdRef.current = myStreamId
    setIsStreaming(true)
    const assistantMessage: ChatMessage = { id: crypto.randomUUID(), role: 'assistant', content: '' }
    // activeBubbleId tracks the ID of the assistant message currently receiving text events.
    // It starts as bubble 1 and is reassigned to bubble 2 when a bubble_split event arrives
    // (i.e. when the AI produces transition_text for a topic pivot). All setMessages guards
    // use this variable so stale streams can never corrupt a different message.
    let activeBubbleId = assistantMessage.id
    let partialResultApplied = false  // tracks if partial_result already built bubbleContent
    setMessages((prev) => [...prev, assistantMessage])

    try {
      const res = await fetch('/api/intake/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: apiMessages,
          currentModules: activeModulesRef.current,
          confidenceScore: confidenceRef.current,
        }),
      })

      if (!res.body) throw new Error('No response body')

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const raw = line.slice(6)
          if (!raw.trim()) continue

          let parsed: { event: string; data: Record<string, unknown> }
          try {
            parsed = JSON.parse(raw)
          } catch {
            console.warn('Failed to parse SSE line:', raw)
            continue
          }

          const { event, data } = parsed

          if (event === 'text') {
            setMessages((prev) => {
              const last = prev[prev.length - 1]
              // Guard: only update the specific assistant message for this stream.
              // If the user submitted before this event arrived, last.id will be a
              // different message and we must not corrupt it.
              if (last?.id !== activeBubbleId) return prev
              return [...prev.slice(0, -1), { ...last, content: last.content + (data.text as string) }]
            })
          } else if (event === 'error') {
            // Route explicitly signalled an error (e.g. Anthropic API failure).
            // Show a visible message immediately instead of leaving an empty bubble.
            const msg = typeof data.message === 'string' ? data.message : ''
            console.error('SSE error from route:', msg)
            setMessages((prev) => {
              const last = prev[prev.length - 1]
              if (last?.id !== activeBubbleId) return prev
              return [...prev.slice(0, -1), { ...last, content: 'Something went wrong. Please try again.' }]
            })
          } else if (event === 'bubble_split') {
            // The AI produced a non-empty transition_text — create a second assistant
            // message bubble and redirect all subsequent text events into it.
            // The stale-stream guard prevents an old stream from injecting a spurious
            // second bubble into a newer stream's conversation.
            if (streamIdRef.current !== myStreamId) continue
            const bubble2: ChatMessage = { id: crypto.randomUUID(), role: 'assistant', content: '' }
            activeBubbleId = bubble2.id
            setMessages((prev) => [...prev, bubble2])
          } else if (event === 'partial_question') {
            // question field is complete but quick_replies is still generating.
            // Show the QR card skeleton immediately so the user sees something.
            const questionText = typeof data.question === 'string' ? data.question.trim() : ''
            if (questionText) {
              setMessages((prev) => {
                const last = prev[prev.length - 1]
                if (last?.id !== activeBubbleId) return prev
                return [...prev.slice(0, -1), {
                  ...last,
                  question: questionText,
                  quickReplies: { style: 'list' as const, options: [] },
                }]
              })
            }
          } else if (event === 'partial_result') {
            // question + quick_replies are now complete in the server's JSON buffer.
            // Show the QR card immediately — the heavy metadata fields (product_overview,
            // module_summaries) are still generating but aren't needed for interactivity.
            const questionText = typeof data.question === 'string' ? data.question.trim() : ''
            const rawQR = data.quick_replies as QuickReplies | undefined
            const updatedQR =
              rawQR && Array.isArray(rawQR.options) && rawQR.options.length > 0 ? rawQR : undefined

            if (updatedQR) {
              const isListQR = updatedQR.style === 'list'
              setMessages((prev) => {
                const last = prev[prev.length - 1]
                if (last?.id !== activeBubbleId) return prev  // user already moved on
                const base = last.content  // follow_up_question text already streamed in
                const bubbleContent =
                  !isListQR && questionText
                    ? base ? `${base}\n\n${questionText}` : questionText
                    : base
                return [...prev.slice(0, -1), {
                  ...last,
                  content: bubbleContent,
                  question: isListQR ? (questionText || undefined) : undefined,
                  quickReplies: updatedQR,
                  // suggest_pause is best-effort — may or may not be in the buffer yet.
                  // tool_result will set isPause correctly; partial_result only sets it
                  // when the field was already present to avoid a jarring re-render.
                  isPause: data.suggest_pause === true || undefined,
                }]
              })
              partialResultApplied = true
              // Mark this stream done so the QR card and input become interactive.
              // The Anthropic stream is still open generating metadata fields, but
              // there's nothing left the user needs to wait for.
              if (streamIdRef.current === myStreamId) setIsStreaming(false)
            }
          } else if (event === 'partial_modules') {
            // detected_modules is complete in the server buffer — update the panel now,
            // before the heavy product_overview / module_summaries fields finish.
            // tool_result will overwrite these with identical values; no double-counting.
            const rawModules = data.detected_modules
            if (Array.isArray(rawModules)) {
              const earlyModules = expandWithDependencies(rawModules as string[])
              setActiveModules(earlyModules)
            }
          } else if (event === 'tool_result') {
            const input = data.input as UpdateProposalInput
            // Auto-expand to include required dependencies (e.g. payments → auth + database)
            const newModules = expandWithDependencies(
              Array.isArray(input?.detected_modules) ? input.detected_modules : []
            )
            const newMultiplier = typeof input?.complexity_multiplier === 'number' ? input.complexity_multiplier : 1.0
            const delta = typeof input?.confidence_score_delta === 'number' ? input.confidence_score_delta : 0
            const newScore = Math.max(0, Math.min(85, confidenceRef.current + delta))

            setActiveModules(newModules)
            setConfidenceScore(newScore)
            setComplexityMultiplier(newMultiplier)
            setPriceRange(computePriceRange(newModules, newMultiplier, newScore))
            if (input?.product_overview && input.product_overview.trim()) {
              setProductOverview(input.product_overview.trim())
            }
            if (input?.module_summaries && typeof input.module_summaries === 'object') {
              setModuleSummaries(prev => ({ ...prev, ...input.module_summaries }))
            }
            if (input?.project_name && input.project_name.trim()) {
              setProjectName(input.project_name.trim())
            }

            // Checkpoint (breather) — allow recurring pauses, min 4 turns apart
            turnCount.current++
            const turnsSinceLast = turnCount.current - lastPauseTurn.current
            const isPauseThisTurn = input?.suggest_pause === true && turnsSinceLast >= 4
            if (isPauseThisTurn) lastPauseTurn.current = turnCount.current

            setMessages((prev) => {
              const last = prev[prev.length - 1]
              // Guard: if the user already responded (after a partial_result), last.id will
              // be a different message and we must not overwrite the new stream's state.
              if (last?.id !== activeBubbleId) return prev
              const followUp = typeof input?.follow_up_question === 'string' ? input.follow_up_question : ''
              const questionText = typeof input?.question === 'string' ? input.question.trim() : ''
              // Validate quick_replies — empty options array is as bad as no quick_replies
              // (QuickReplies component would render only "Type something", which is confusing)
              const rawQR = input?.quick_replies
              const updatedQR = rawQR && Array.isArray(rawQR.options) && rawQR.options.length > 0
                ? rawQR
                : undefined
              const isListQR = updatedQR?.style === 'list'

              if (isPauseThisTurn) {
                // PAUSE TURN: split into two separate messages so the reaction appears
                // as a standard MessageBubble before the checkpoint divider.
                // 1. Reaction bubble — normal MessageBubble (follow_up_question streamed live)
                const reactionBubble: ChatMessage = {
                  ...last,
                  content: last.content || followUp,
                  question: undefined,
                  quickReplies: undefined,
                  isPause: undefined,
                }
                // 2. Pause checkpoint — friendly intro from the `question` field + hardcoded CTAs
                const checkpointMsg: ChatMessage = {
                  id: crypto.randomUUID(),
                  role: 'assistant',
                  content: questionText || 'Good progress. Want to take a look at what we\'ve built, keep going, or save this for later?',
                  isPause: true,
                }
                return [...prev.slice(0, -1), reactionBubble, checkpointMsg]
              }

              // Normal turn
              // For list QR: question goes in the rows card header (message.question), not in the bubble
              // For no QR or pills QR: question is appended to bubble content so it's visible
              // Skip appending if partial_result already built the content (avoids duplicate question)
              const base = last.content || followUp
              const bubbleContent = !isListQR && questionText && !partialResultApplied
                ? (base ? `${base}\n\n${questionText}` : questionText)
                : base

              return [...prev.slice(0, -1), {
                ...last,
                content: bubbleContent,
                question: isListQR ? (questionText || undefined) : undefined,
                quickReplies: updatedQR,
                isPause: undefined,
              }]
            })

            // Mark streaming done — the QR card and question are ready to show.
            // The Anthropic stream may still be open (consuming message_delta / message_stop)
            // but there's nothing left to display; we don't need to wait for it.
            // Guard: don't reset isStreaming if a newer stream has already started
            // (happens when partial_result already set it to false and the user submitted).
            if (streamIdRef.current === myStreamId) setIsStreaming(false)

            // Save proposal state inline so it survives page reload.
            // Must be inline (not a reactive effect) to avoid the mount-order bug
            // where the persistence effect fires before the restore effect.
            if (proposalId) {
              try {
                const savedOverview = (input?.product_overview && input.product_overview.trim())
                  ? input.product_overview.trim()
                  : productOverviewRef.current
                const savedSummaries = (input?.module_summaries && typeof input.module_summaries === 'object')
                  ? { ...moduleSummariesRef.current, ...input.module_summaries }
                  : moduleSummariesRef.current
                const savedProjectName = (input?.project_name && input.project_name.trim())
                  ? input.project_name.trim()
                  : ''
                const savedBrief = (input?.updated_brief && input.updated_brief.trim())
                  ? input.updated_brief.trim()
                  : undefined
                localStorage.setItem(PROPOSAL_KEY(proposalId), JSON.stringify({
                  activeModules: newModules,
                  confidenceScore: newScore,
                  complexityMultiplier: newMultiplier,
                  productOverview: savedOverview,
                  moduleSummaries: savedSummaries,
                  projectName: savedProjectName || undefined,
                  brief: savedBrief,
                }))
              } catch { /* Ignore QuotaExceededError */ }
            }
          }
        }
      }
    } catch (err) {
      console.error('Chat error:', err)
      setMessages((prev) => {
        const last = prev[prev.length - 1]
        if (last?.role !== 'assistant') return prev
        return [...prev.slice(0, -1), { ...last, content: 'Something went wrong. Please try again.' }]
      })
    } finally {
      // Guard: if the stream closed without ever producing a tool_result (e.g. Vercel
      // timeout, network drop), replace the empty bubble with a visible error.
      // We check the message ID so a stale stream doesn't clobber a newer one that
      // started after the user submitted while this stream was still draining.
      setMessages((prev) => {
        const last = prev[prev.length - 1]
        if (last?.id === activeBubbleId && last.role === 'assistant' && !last.content.trim()) {
          return [...prev.slice(0, -1), { ...last, content: 'Something went wrong. Please try again.' }]
        }
        return prev
      })
      // Safety net — only reset if this is still the active stream; a newer stream
      // may have started (e.g. user submitted after partial_result) in which case
      // we must NOT clobber its isStreaming state.
      if (streamIdRef.current === myStreamId) setIsStreaming(false)
    }
  }

  const sendMessage = useCallback(async (content: string, displayContent?: string, sourceQuickReplies?: QuickReplies, sourceQuestion?: string) => {
    if (isStreaming) return

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content,
      displayContent: displayContent && displayContent !== content ? displayContent : undefined,
      sourceQuickReplies,
      sourceQuestion,
    }

    const apiMessages: ApiMessage[] = [
      ...messagesRef.current.map((m): ApiMessage => ({ role: m.role, content: m.content })),
      { role: 'user', content },
    ]

    setMessages((prev) => {
      // Clear quickReplies and question from last assistant message
      const cleared = prev.map((m, i) =>
        i === prev.length - 1 && m.role === 'assistant' ? { ...m, quickReplies: undefined, question: undefined } : m
      )
      return [...cleared, userMessage]
    })

    await streamAIResponse(apiMessages)
  }, [isStreaming]) // eslint-disable-line react-hooks/exhaustive-deps

  function toggleModule(moduleId: string) {
    const newModules = activeModules.includes(moduleId)
      ? activeModules.filter((m) => m !== moduleId)
      : [...activeModules, moduleId]
    setActiveModules(newModules)
    setPriceRange(computePriceRange(newModules, complexityMultiplier, confidenceScore))

    // Save inline so module toggles survive page reload
    if (proposalId) {
      try {
        localStorage.setItem(PROPOSAL_KEY(proposalId), JSON.stringify({
          activeModules: newModules,
          confidenceScore,
          complexityMultiplier,
          productOverview,
          moduleSummaries,
        }))
      } catch { /* Ignore */ }
    }
  }

  const editMessage = useCallback(async (messageId: string, newContent: string, displayContent?: string) => {
    if (isStreaming) return

    const msgIndex = messagesRef.current.findIndex((m) => m.id === messageId)
    if (msgIndex === -1) return
    if (msgIndex === 0) return // Don't edit the original idea — use Reset to start over

    const correctionMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: `Actually, let me clarify my earlier answer: ${newContent}`,
      displayContent,  // Clean display (question + new answer) for row re-selections
    }

    const kept = messagesRef.current.slice(0, msgIndex)
    setMessages([...kept, correctionMsg])

    const aiHistory = [...kept, correctionMsg].map(
      (m): ApiMessage => ({ role: m.role, content: m.content })
    )

    await streamAIResponse(aiHistory)
  }, [isStreaming]) // eslint-disable-line react-hooks/exhaustive-deps

  const reset = useCallback(() => {
    // Clear stored messages and proposal state for this proposal
    if (proposalId) {
      localStorage.removeItem(MSGS_KEY(proposalId))
      localStorage.removeItem(PROPOSAL_KEY(proposalId))
    }
    // Reset refs synchronously
    messagesRef.current = []
    confidenceRef.current = 0
    activeModulesRef.current = []
    complexityRef.current = 1.0
    lastPauseTurn.current = -999
    turnCount.current = 0
    // Reset state — blank slate
    setMessages([])
    setActiveModules([])
    setConfidenceScore(0)
    setComplexityMultiplier(1.0)
    setPriceRange({ min: 0, max: 0 })
    setIsStreaming(false)
    setProductOverview('')
    setModuleSummaries({})
    setProjectName('')
  }, [proposalId]) // eslint-disable-line react-hooks/exhaustive-deps

  return { messages, activeModules, confidenceScore, priceRange, isStreaming, sendMessage, toggleModule, productOverview, editMessage, reset, moduleSummaries, projectName }
}
