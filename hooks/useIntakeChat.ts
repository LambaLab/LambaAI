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

export function useIntakeChat({ proposalId, initialMessage }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [activeModules, setActiveModules] = useState<string[]>([])
  const [confidenceScore, setConfidenceScore] = useState(0)
  const [complexityMultiplier, setComplexityMultiplier] = useState(1.0)
  const [priceRange, setPriceRange] = useState<PriceRange>({ min: 0, max: 0 })
  const [isStreaming, setIsStreaming] = useState(false)
  const initialSentRef = useRef(false)

  function updatePriceRange(modules: string[], multiplier: number, score: number) {
    const base = calculatePriceRange(modules)
    const adjusted = applyComplexityAdjustment(base, multiplier)
    const tightened = tightenPriceRange(adjusted, score)
    setPriceRange(tightened)
  }

  const sendMessage = useCallback(async (content: string) => {
    if (isStreaming) return

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content,
    }

    setMessages((prev) => [...prev, userMessage])
    setIsStreaming(true)

    const assistantMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: '',
    }
    setMessages((prev) => [...prev, assistantMessage])

    // Build message history for API (use functional update to get current state)
    const apiMessages = [...messages, userMessage].map((m) => ({
      role: m.role,
      content: m.content,
    }))

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

          const { event, data } = JSON.parse(raw)

          if (event === 'text') {
            setMessages((prev) => {
              const last = prev[prev.length - 1]
              if (last?.role !== 'assistant') return prev
              return [...prev.slice(0, -1), { ...last, content: last.content + data.text }]
            })
          } else if (event === 'tool_result') {
            const input = data.input as UpdateProposalInput
            const newScore = Math.max(0, Math.min(100, confidenceScore + input.confidence_score_delta))
            const newMultiplier = input.complexity_multiplier
            const newModules = input.detected_modules

            setActiveModules(newModules)
            setConfidenceScore(newScore)
            setComplexityMultiplier(newMultiplier)
            updatePriceRange(newModules, newMultiplier, newScore)

            if (input.capability_cards?.length) {
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
  }, [messages, activeModules, confidenceScore, isStreaming])

  function toggleModule(moduleId: string) {
    setActiveModules((prev) => {
      const newModules = prev.includes(moduleId)
        ? prev.filter((m) => m !== moduleId)
        : [...prev, moduleId]
      updatePriceRange(newModules, complexityMultiplier, confidenceScore)
      return newModules
    })
  }

  // Send initial message on mount
  useEffect(() => {
    if (!initialSentRef.current && initialMessage) {
      initialSentRef.current = true
      sendMessage(initialMessage)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Suppress unused variable warning for proposalId (used by caller context)
  void proposalId

  return { messages, activeModules, confidenceScore, priceRange, isStreaming, sendMessage, toggleModule }
}
