'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { calculatePriceRange, applyComplexityAdjustment, tightenPriceRange, type PriceRange } from '@/lib/pricing/engine'
import type { QuickReplies } from '@/lib/intake-types'
import { bundleOnboardingContext } from '@/lib/intake-utils'

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
  capability_cards?: string[]
  quick_replies?: QuickReplies
}

type ApiMessage = { role: 'user' | 'assistant'; content: string }

type Props = {
  proposalId: string
  idea: string
}

const ONBOARDING_QUESTIONS = [
  {
    content: 'What platform are you building for?',
    quickReplies: {
      style: 'icon-cards' as const,
      options: [
        { label: 'Web App', icon: '🌐', value: 'Web App' },
        { label: 'Mobile App', icon: '📱', value: 'Mobile App' },
        { label: 'Both', icon: '🖥️', value: 'Web + Mobile' },
        { label: 'Not sure yet', icon: '🤔', value: 'Platform TBD' },
      ],
    },
  },
  {
    content: 'What type of product is this?',
    quickReplies: {
      style: 'icon-cards' as const,
      options: [
        { label: 'Marketplace', icon: '🛒', value: 'Marketplace' },
        { label: 'Social / Community', icon: '💬', value: 'Social / Community' },
        { label: 'SaaS / Internal Tool', icon: '🛠️', value: 'SaaS / Internal Tool' },
        { label: 'Something else', icon: '🎯', value: 'Other' },
      ],
    },
  },
  {
    content: "What's the goal for this product?",
    quickReplies: {
      style: 'icon-cards' as const,
      options: [
        { label: 'Launch a startup', icon: '🚀', value: 'Launch a startup' },
        { label: 'Grow my business', icon: '🏢', value: 'Grow my existing business' },
        { label: 'Build for my team', icon: '🛠️', value: 'Build a tool for my team' },
        { label: 'Something else', icon: '🎯', value: 'Other' },
      ],
    },
  },
]

export function useIntakeChat({ idea }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'onboarding-0',
      role: 'assistant',
      content: ONBOARDING_QUESTIONS[0].content,
      quickReplies: ONBOARDING_QUESTIONS[0].quickReplies,
    },
  ])
  const [onboardingStep, setOnboardingStep] = useState(0)
  const [onboardingAnswers, setOnboardingAnswers] = useState<string[]>([])
  const [activeModules, setActiveModules] = useState<string[]>([])
  const [confidenceScore, setConfidenceScore] = useState(0)
  const [complexityMultiplier, setComplexityMultiplier] = useState(1.0)
  const [priceRange, setPriceRange] = useState<PriceRange>({ min: 0, max: 0 })
  const [isStreaming, setIsStreaming] = useState(false)

  const messagesRef = useRef<ChatMessage[]>([])
  const confidenceRef = useRef(0)
  const activeModulesRef = useRef<string[]>([])
  const complexityRef = useRef(1.0)

  useEffect(() => { messagesRef.current = messages }, [messages])
  useEffect(() => { confidenceRef.current = confidenceScore }, [confidenceScore])
  useEffect(() => { activeModulesRef.current = activeModules }, [activeModules])
  useEffect(() => { complexityRef.current = complexityMultiplier }, [complexityMultiplier])

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

    // ── Onboarding phase: intercept first 3 sends locally ───────────────────
    if (onboardingStep < 3) {
      const userMsg: ChatMessage = { id: crypto.randomUUID(), role: 'user', content }
      const newAnswers = [...onboardingAnswers, content]
      const newStep = onboardingStep + 1

      setMessages((prev) => {
        // Clear quickReplies from the last assistant message
        const cleared = prev.map((m, i) =>
          i === prev.length - 1 ? { ...m, quickReplies: undefined } : m
        )
        const withUser = [...cleared, userMsg]
        // If more onboarding questions remain, inject the next one
        if (newStep < 3) {
          const nextQ = ONBOARDING_QUESTIONS[newStep]
          return [
            ...withUser,
            {
              id: `onboarding-${newStep}`,
              role: 'assistant' as const,
              content: nextQ.content,
              quickReplies: nextQ.quickReplies,
            },
          ]
        }
        return withUser
      })

      setOnboardingAnswers(newAnswers)
      setOnboardingStep(newStep)

      // All 3 answered → bundle context and send to AI with a fresh history
      if (newStep === 3) {
        const bundled = bundleOnboardingContext({
          idea,
          platform: newAnswers[0],
          productType: newAnswers[1],
          goal: content,
        })
        await streamAIResponse([{ role: 'user', content: bundled }])
      }
      return
    }

    // ── Normal AI phase ──────────────────────────────────────────────────────
    const userMessage: ChatMessage = { id: crypto.randomUUID(), role: 'user', content }

    // Exclude hardcoded onboarding messages from API history (ids start with 'onboarding-')
    const aiHistory = messagesRef.current
      .filter((m) => !m.id.startsWith('onboarding-'))
      .map((m): ApiMessage => ({ role: m.role, content: m.content }))
    const apiMessages: ApiMessage[] = [...aiHistory, { role: 'user', content }]

    setMessages((prev) => [...prev, userMessage])
    // Clear quickReplies from last assistant message
    setMessages((prev) => {
      const lastAssistantIdx = [...prev].reverse().findIndex((m) => m.role === 'assistant')
      if (lastAssistantIdx === -1) return prev
      const realIdx = prev.length - 1 - lastAssistantIdx
      return prev.map((m, i) => i === realIdx ? { ...m, quickReplies: undefined } : m)
    })

    await streamAIResponse(apiMessages)
  }, [onboardingStep, onboardingAnswers, idea, isStreaming]) // eslint-disable-line react-hooks/exhaustive-deps

  function toggleModule(moduleId: string) {
    const newModules = activeModules.includes(moduleId)
      ? activeModules.filter((m) => m !== moduleId)
      : [...activeModules, moduleId]
    setActiveModules(newModules)
    setPriceRange(computePriceRange(newModules, complexityMultiplier, confidenceScore))
  }

  return { messages, activeModules, confidenceScore, priceRange, isStreaming, sendMessage, toggleModule }
}
