'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { calculatePriceRange, applyComplexityAdjustment, tightenPriceRange, type PriceRange } from '@/lib/pricing/engine'

export type ChatMessage = {
  id: string
  role: 'user' | 'assistant'
  content: string
  capabilityCards?: string[]
}

type UpdateProposalInput = {
  detected_modules: string[]
  confidence_score_delta: number
  complexity_multiplier: number
  updated_brief: string
  follow_up_question: string
  capability_cards?: string[]
}

type Props = {
  proposalId: string
  initialMessage: string
}

export function useIntakeChat({ proposalId: _proposalId, initialMessage }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [activeModules, setActiveModules] = useState<string[]>([])
  const [confidenceScore, setConfidenceScore] = useState(0)
  const [complexityMultiplier, setComplexityMultiplier] = useState(1.0)
  const [priceRange, setPriceRange] = useState<PriceRange>({ min: 0, max: 0 })
  const [isStreaming, setIsStreaming] = useState(false)
  const initialSentRef = useRef(false)
  // Keep a ref to always-current messages for building API history without stale closure issues
  const messagesRef = useRef<ChatMessage[]>([])
  const confidenceRef = useRef(0)

  // Keep refs in sync with state
  useEffect(() => { messagesRef.current = messages }, [messages])
  useEffect(() => { confidenceRef.current = confidenceScore }, [confidenceScore])

  function computePriceRange(modules: string[], multiplier: number, score: number): PriceRange {
    const base = calculatePriceRange(modules)
    const adjusted = applyComplexityAdjustment(base, multiplier)
    return tightenPriceRange(adjusted, score)
  }

  const sendMessage = useCallback(async (content: string) => {
    if (isStreaming) return

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content,
    }

    // Build API history from ref (always current) before adding the new message
    const apiMessages = [...messagesRef.current, userMessage].map((m) => ({
      role: m.role,
      content: m.content,
    }))

    setMessages((prev) => [...prev, userMessage])
    setIsStreaming(true)

    const assistantMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: '',
    }
    setMessages((prev) => [...prev, assistantMessage])

    try {
      const res = await fetch('/api/intake/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: apiMessages,
          currentModules: activeModules,
          confidenceScore,
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

            if (input?.capability_cards?.length) {
              setMessages((prev) => {
                const last = prev[prev.length - 1]
                if (last?.role !== 'assistant') return prev
                return [...prev.slice(0, -1), { ...last, capabilityCards: input.capability_cards }]
              })
            }
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
  }, [activeModules, confidenceScore, isStreaming])

  function toggleModule(moduleId: string) {
    // Compute new modules directly from closure value — no side effects in state updater
    const newModules = activeModules.includes(moduleId)
      ? activeModules.filter((m) => m !== moduleId)
      : [...activeModules, moduleId]
    setActiveModules(newModules)
    setPriceRange(computePriceRange(newModules, complexityMultiplier, confidenceScore))
  }

  // Send initial message on mount
  useEffect(() => {
    if (!initialSentRef.current && initialMessage) {
      initialSentRef.current = true
      sendMessage(initialMessage)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return { messages, activeModules, confidenceScore, priceRange, isStreaming, sendMessage, toggleModule }
}
