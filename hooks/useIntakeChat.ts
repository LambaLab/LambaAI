'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { calculatePriceRange, applyComplexityAdjustment, tightenPriceRange, type PriceRange } from '@/lib/pricing/engine'
import type { QuickReplies } from '@/lib/intake-types'

export type ChatMessage = {
  id: string
  role: 'user' | 'assistant'
  content: string
  capabilityCards?: string[]
  quickReplies?: QuickReplies
}

type UpdateProposalInput = {
  detected_modules: string[]
  confidence_score_delta: number
  complexity_multiplier: number
  updated_brief: string
  follow_up_question: string
  product_overview?: string
  capability_cards?: string[]
  quick_replies?: QuickReplies
}

type ApiMessage = { role: 'user' | 'assistant'; content: string }

type Props = {
  proposalId: string
  idea: string
}

export function useIntakeChat({ idea }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [activeModules, setActiveModules] = useState<string[]>([])
  const [confidenceScore, setConfidenceScore] = useState(0)
  const [complexityMultiplier, setComplexityMultiplier] = useState(1.0)
  const [priceRange, setPriceRange] = useState<PriceRange>({ min: 0, max: 0 })
  const [isStreaming, setIsStreaming] = useState(false)
  const [productOverview, setProductOverview] = useState('')

  const messagesRef = useRef<ChatMessage[]>([])
  const confidenceRef = useRef(0)
  const activeModulesRef = useRef<string[]>([])
  const complexityRef = useRef(1.0)

  useEffect(() => { messagesRef.current = messages }, [messages])
  useEffect(() => { confidenceRef.current = confidenceScore }, [confidenceScore])
  useEffect(() => { activeModulesRef.current = activeModules }, [activeModules])
  useEffect(() => { complexityRef.current = complexityMultiplier }, [complexityMultiplier])

  // Auto-send the idea on mount (fires once)
  useEffect(() => {
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
          } else if (event === 'tool_result') {
            const input = data.input as UpdateProposalInput
            const newModules = Array.isArray(input?.detected_modules) ? input.detected_modules : []
            const newMultiplier = typeof input?.complexity_multiplier === 'number' ? input.complexity_multiplier : 1.0
            const delta = typeof input?.confidence_score_delta === 'number' ? input.confidence_score_delta : 0
            const newScore = Math.max(0, Math.min(100, confidenceRef.current + delta))

            setActiveModules(newModules)
            setConfidenceScore(newScore)
            setComplexityMultiplier(newMultiplier)
            setPriceRange(computePriceRange(newModules, newMultiplier, newScore))
            if (input?.product_overview && input.product_overview.trim()) {
              setProductOverview(input.product_overview.trim())
            }

            setMessages((prev) => {
              const last = prev[prev.length - 1]
              if (last?.role !== 'assistant') return prev
              const updatedContent = last.content || (typeof input?.follow_up_question === 'string' ? input.follow_up_question : '')
              const updatedCards = input?.capability_cards?.length ? input.capability_cards : last.capabilityCards
              const updatedQR = input?.quick_replies
              return [...prev.slice(0, -1), { ...last, content: updatedContent, capabilityCards: updatedCards, quickReplies: updatedQR }]
            })
          }
        }
      }
    } catch (err) {
      console.error('Chat error:', err)
      setMessages((prev) => {
        const last = prev[prev.length - 1]
        if (last?.role !== 'assistant') return prev
        return [...prev.slice(0, -1), { ...last, content: 'Sorry, something went wrong. Please try again.' }]
      })
    } finally {
      setIsStreaming(false)
    }
  }

  const sendMessage = useCallback(async (content: string) => {
    if (isStreaming) return

    const userMessage: ChatMessage = { id: crypto.randomUUID(), role: 'user', content }

    const apiMessages: ApiMessage[] = [
      ...messagesRef.current.map((m): ApiMessage => ({ role: m.role, content: m.content })),
      { role: 'user', content },
    ]

    setMessages((prev) => {
      // Clear quickReplies from last assistant message
      const cleared = prev.map((m, i) =>
        i === prev.length - 1 && m.role === 'assistant' ? { ...m, quickReplies: undefined } : m
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
  }

  const editMessage = useCallback(async (messageId: string, newContent: string) => {
    if (isStreaming) return

    const msgIndex = messagesRef.current.findIndex((m) => m.id === messageId)
    if (msgIndex === -1) return
    if (msgIndex === 0) return // Don't edit the original idea — use Reset to start over

    const correctionMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: `Actually, let me clarify my earlier answer: ${newContent}`,
    }

    const kept = messagesRef.current.slice(0, msgIndex)
    setMessages([...kept, correctionMsg])

    const aiHistory = [...kept, correctionMsg].map(
      (m): ApiMessage => ({ role: m.role, content: m.content })
    )

    await streamAIResponse(aiHistory)
  }, [isStreaming]) // eslint-disable-line react-hooks/exhaustive-deps

  const reset = useCallback(() => {
    // Reset refs synchronously
    messagesRef.current = []
    confidenceRef.current = 0
    activeModulesRef.current = []
    complexityRef.current = 1.0
    // Reset state — blank slate
    setMessages([])
    setActiveModules([])
    setConfidenceScore(0)
    setComplexityMultiplier(1.0)
    setPriceRange({ min: 0, max: 0 })
    setIsStreaming(false)
    setProductOverview('')
  }, [])

  return { messages, activeModules, confidenceScore, priceRange, isStreaming, sendMessage, toggleModule, productOverview, editMessage, reset }
}
