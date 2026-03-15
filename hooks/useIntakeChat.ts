'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { calculatePriceRange, applyComplexityAdjustment, tightenPriceRange, type PriceRange } from '@/lib/pricing/engine'
import { expandWithDependencies } from '@/lib/modules/dependencies'
import type { QuickReplies } from '@/lib/intake-types'

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
}

type ApiMessage = { role: 'user' | 'assistant'; content: string }

type Props = {
  proposalId: string
  idea: string
}

const MSGS_KEY = (pid: string) => `lamba_msgs_${pid}`
const PROPOSAL_KEY = (pid: string) => `lamba_proposal_${pid}`

export function useIntakeChat({ proposalId, idea }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [activeModules, setActiveModules] = useState<string[]>([])
  const [confidenceScore, setConfidenceScore] = useState(0)
  const [complexityMultiplier, setComplexityMultiplier] = useState(1.0)
  const [priceRange, setPriceRange] = useState<PriceRange>({ min: 0, max: 0 })
  const [isStreaming, setIsStreaming] = useState(false)
  const [productOverview, setProductOverview] = useState('')
  const [moduleSummaries, setModuleSummaries] = useState<{ [moduleId: string]: string }>({})

  const messagesRef = useRef<ChatMessage[]>([])
  const confidenceRef = useRef(0)
  const activeModulesRef = useRef<string[]>([])
  const complexityRef = useRef(1.0)
  const productOverviewRef = useRef('')
  const moduleSummariesRef = useRef<{ [moduleId: string]: string }>({})
  const lastPauseTurn = useRef(-999)  // turn index of the last checkpoint (-999 = never)
  const turnCount = useRef(0)         // increments each time a tool_result is processed

  useEffect(() => { messagesRef.current = messages }, [messages])
  useEffect(() => { confidenceRef.current = confidenceScore }, [confidenceScore])
  useEffect(() => { activeModulesRef.current = activeModules }, [activeModules])
  useEffect(() => { complexityRef.current = complexityMultiplier }, [complexityMultiplier])
  useEffect(() => { productOverviewRef.current = productOverview }, [productOverview])
  useEffect(() => { moduleSummariesRef.current = moduleSummaries }, [moduleSummaries])

  // Persist messages to localStorage after every update
  useEffect(() => {
    if (messages.length > 0 && proposalId) {
      localStorage.setItem(MSGS_KEY(proposalId), JSON.stringify(messages))
    }
  }, [messages, proposalId])

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
    setIsStreaming(true)
    const assistantMessage: ChatMessage = { id: crypto.randomUUID(), role: 'assistant', content: '' }
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
              if (last?.role !== 'assistant') return prev
              return [...prev.slice(0, -1), { ...last, content: last.content + (data.text as string) }]
            })
          } else if (event === 'error') {
            // Route explicitly signalled an error (e.g. Anthropic API failure).
            // Show a visible message immediately instead of leaving an empty bubble.
            const msg = typeof data.message === 'string' ? data.message : ''
            console.error('SSE error from route:', msg)
            setMessages((prev) => {
              const last = prev[prev.length - 1]
              if (last?.role !== 'assistant') return prev
              return [...prev.slice(0, -1), { ...last, content: 'Something went wrong. Please try again.' }]
            })
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

            // Checkpoint (breather) — allow recurring pauses, min 4 turns apart
            turnCount.current++
            const turnsSinceLast = turnCount.current - lastPauseTurn.current
            const isPauseThisTurn = input?.suggest_pause === true && turnsSinceLast >= 4
            if (isPauseThisTurn) lastPauseTurn.current = turnCount.current

            setMessages((prev) => {
              const last = prev[prev.length - 1]
              if (last?.role !== 'assistant') return prev
              const followUp = typeof input?.follow_up_question === 'string' ? input.follow_up_question : ''
              const questionText = typeof input?.question === 'string' ? input.question.trim() : ''
              // Validate quick_replies — empty options array is as bad as no quick_replies
            // (QuickReplies component would render only "Type something", which is confusing)
            const rawQR = input?.quick_replies
            const updatedQR = rawQR && Array.isArray(rawQR.options) && rawQR.options.length > 0
              ? rawQR
              : undefined
            const isListQR = updatedQR?.style === 'list'

              // For list QR: question goes in the rows card header (message.question), not in the bubble
              // For no QR or pills QR: question is appended to bubble content so it's visible
              const base = last.content || followUp
              const bubbleContent = !isListQR && questionText
                ? (base ? `${base}\n\n${questionText}` : questionText)
                : base

              return [...prev.slice(0, -1), {
                ...last,
                content: bubbleContent,
                question: isListQR ? (questionText || undefined) : undefined,
                quickReplies: updatedQR,
                isPause: isPauseThisTurn || undefined,
              }]
            })

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
                localStorage.setItem(PROPOSAL_KEY(proposalId), JSON.stringify({
                  activeModules: newModules,
                  confidenceScore: newScore,
                  complexityMultiplier: newMultiplier,
                  productOverview: savedOverview,
                  moduleSummaries: savedSummaries,
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
      // Guard: if the stream closed without ever populating the assistant bubble
      // (e.g. Vercel function timeout, network drop), replace the empty bubble with
      // a visible error message so the user isn't left staring at a blank reply.
      setMessages((prev) => {
        const last = prev[prev.length - 1]
        if (last?.role === 'assistant' && !last.content.trim()) {
          return [...prev.slice(0, -1), { ...last, content: 'Something went wrong. Please try again.' }]
        }
        return prev
      })
      setIsStreaming(false)
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
  }, [proposalId]) // eslint-disable-line react-hooks/exhaustive-deps

  return { messages, activeModules, confidenceScore, priceRange, isStreaming, sendMessage, toggleModule, productOverview, editMessage, reset, moduleSummaries }
}
