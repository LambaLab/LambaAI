# Chat Onboarding Redesign Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Move the 3-step onboarding into seamless chat bubbles, fix minimize resetting chat state, update step 3 to focus on business intent, and hide per-module prices until confidence threshold is met.

**Architecture:** `useIntakeChat` owns the onboarding state machine — it initialises `messages` with Q1 already loaded and intercepts the first 3 `sendMessage` calls locally before handing off to the AI. `IntakeOverlay` keeps `IntakeLayout` always mounted, using CSS `hidden` to hide it when minimized. `ModuleCard` gains a `pricingVisible` prop and shows a blurred placeholder when false.

**Tech Stack:** Next.js App Router, React, Tailwind CSS v4, Vitest

---

## Shared context (read once, referenced throughout)

```
Project root: /Users/nagi/Downloads/Lamba Lab/Lamba Lab app
PATH fix:     export PATH="/usr/local/bin:$PATH" &&
Run tests:    npx vitest run
TypeScript:   npx tsc --noEmit
```

Key files being changed:
- `lib/intake-types.ts` — `OnboardingContext.scale → goal`
- `lib/intake-utils.ts` — update `bundleOnboardingContext`
- `__tests__/intake-utils.test.ts` — update for goal rename
- `hooks/useIntakeChat.ts` — onboarding state machine
- `components/intake/IntakeLayout.tsx` — remove onboarding state, always render chat
- `components/intake/OnboardingSteps.tsx` — **delete**
- `components/intake/IntakeOverlay.tsx` — CSS hide instead of unmount
- `components/intake/ModuleCard.tsx` — pricingVisible prop
- `components/intake/ModulesPanel.tsx` — pass pricingVisible to ModuleCard

---

### Task 1: Rename `scale → goal` in types, utils, and tests

**Files:**
- Modify: `lib/intake-types.ts`
- Modify: `lib/intake-utils.ts`
- Modify: `__tests__/intake-utils.test.ts`

**Step 1: Update `lib/intake-types.ts`**

Change `OnboardingContext.scale` to `goal`:

```ts
export type QuickReplyOption = {
  label: string
  description?: string
  icon?: string
  value: string
}

export type QuickReplies = {
  style: 'list' | 'icon-cards' | 'pills'
  multiSelect?: boolean
  allowCustom?: boolean
  options: QuickReplyOption[]
}

export type OnboardingContext = {
  idea: string
  platform: string
  productType: string
  goal: string   // was: scale
}
```

**Step 2: Update `lib/intake-utils.ts`**

Replace the full file:

```ts
import type { OnboardingContext } from './intake-types'

export function bundleOnboardingContext(ctx: OnboardingContext): string {
  const lines: string[] = []
  if (ctx.idea.trim()) {
    lines.push(`User idea: "${ctx.idea.trim()}"`)
  }
  lines.push(
    `Platform: ${ctx.platform}`,
    `Product type: ${ctx.productType}`,
    `Goal: ${ctx.goal}`,
  )
  return lines.join('\n')
}

export function serializeMultiSelect(values: string[]): string {
  return values.join(', ')
}
```

**Step 3: Update `__tests__/intake-utils.test.ts`**

Replace full file:

```ts
import { describe, it, expect } from 'vitest'
import { bundleOnboardingContext, serializeMultiSelect } from '@/lib/intake-utils'

describe('bundleOnboardingContext', () => {
  it('returns structured message with all four fields', () => {
    const result = bundleOnboardingContext({
      idea: 'sell stories',
      platform: 'Web App',
      productType: 'Marketplace',
      goal: 'Launch a startup',
    })
    expect(result).toContain('sell stories')
    expect(result).toContain('Web App')
    expect(result).toContain('Marketplace')
    expect(result).toContain('Launch a startup')
  })

  it('formats output as newline-separated labelled fields', () => {
    const result = bundleOnboardingContext({
      idea: 'sell stories',
      platform: 'Web App',
      productType: 'Marketplace',
      goal: 'Launch a startup',
    })
    expect(result).toBe(
      'User idea: "sell stories"\nPlatform: Web App\nProduct type: Marketplace\nGoal: Launch a startup'
    )
  })

  it('omits idea line when idea is empty string', () => {
    const result = bundleOnboardingContext({
      idea: '',
      platform: 'Web App',
      productType: 'Marketplace',
      goal: 'Launch a startup',
    })
    expect(result).not.toContain('User idea')
    expect(result).toBe('Platform: Web App\nProduct type: Marketplace\nGoal: Launch a startup')
  })
})

describe('serializeMultiSelect', () => {
  it('joins selected values with comma', () => {
    expect(serializeMultiSelect(['iOS', 'Android'])).toBe('iOS, Android')
  })
  it('returns single value unchanged', () => {
    expect(serializeMultiSelect(['Web App'])).toBe('Web App')
  })
})
```

**Step 4: Run tests — expect FAIL** (the old `scale` references still exist in `useIntakeChat` / `OnboardingSteps`; that's expected — those are fixed in Task 2+)

```bash
export PATH="/usr/local/bin:$PATH" && cd "/Users/nagi/Downloads/Lamba Lab/Lamba Lab app" && npx vitest run __tests__/intake-utils.test.ts 2>&1
```

Expected: `intake-utils` tests pass. TypeScript may fail until Task 2 — don't run `tsc` yet.

**Step 5: Commit**

```bash
cd "/Users/nagi/Downloads/Lamba Lab/Lamba Lab app" && git add lib/intake-types.ts lib/intake-utils.ts __tests__/intake-utils.test.ts && git commit -m "feat: rename scale→goal in OnboardingContext, update bundleOnboardingContext label"
```

---

### Task 2: Rewrite `useIntakeChat` — onboarding state machine

**Files:**
- Modify: `hooks/useIntakeChat.ts`

This is the biggest change. The hook gains 3 hardcoded onboarding questions and intercepts the first 3 `sendMessage` calls locally. After the 3rd answer, it bundles context and calls the AI. For subsequent calls it excludes onboarding messages from the API history.

**Step 1: Replace the full file with this:**

```ts
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
```

**Step 2: Run tests**

```bash
export PATH="/usr/local/bin:$PATH" && cd "/Users/nagi/Downloads/Lamba Lab/Lamba Lab app" && npx vitest run 2>&1
```

Expected: all tests pass. (TypeScript may still have errors from IntakeLayout referencing old props — that's fixed in Task 3.)

**Step 3: Commit**

```bash
cd "/Users/nagi/Downloads/Lamba Lab/Lamba Lab app" && git add hooks/useIntakeChat.ts && git commit -m "feat: move onboarding into chat — useIntakeChat owns 3-step state machine"
```

---

### Task 3: Simplify `IntakeLayout` + delete `OnboardingSteps`

**Files:**
- Modify: `components/intake/IntakeLayout.tsx`
- Delete: `components/intake/OnboardingSteps.tsx`

**Step 1: Replace `components/intake/IntakeLayout.tsx` with this:**

```tsx
'use client'

import { useEffect } from 'react'
import ChatPanel from './ChatPanel'
import ModulesPanel from './ModulesPanel'
import MobileBottomDrawer from './MobileBottomDrawer'
import { useIntakeChat } from '@/hooks/useIntakeChat'
import { formatPriceRange, isPricingVisible } from '@/lib/pricing/engine'

type Props = {
  proposalId: string
  initialMessage: string
  onStateChange?: (moduleCount: number, confidenceScore: number) => void
}

export default function IntakeLayout({ proposalId, initialMessage, onStateChange }: Props) {
  const {
    messages,
    activeModules,
    confidenceScore,
    priceRange,
    isStreaming,
    sendMessage,
    toggleModule,
  } = useIntakeChat({ proposalId, idea: initialMessage })

  useEffect(() => {
    onStateChange?.(activeModules.length, confidenceScore)
  }, [activeModules.length, confidenceScore, onStateChange])

  const pricingVisible = isPricingVisible(confidenceScore)
  const summaryText = pricingVisible
    ? `${activeModules.length} modules · ${formatPriceRange(priceRange)}`
    : `${activeModules.length} modules detected`

  return (
    <div className="flex-1 overflow-hidden flex">
      {/* Desktop: side by side */}
      <div className="hidden md:flex flex-1 overflow-hidden">
        <div className="w-[55%] border-r border-white/5 overflow-hidden">
          <ChatPanel
            messages={messages}
            isStreaming={isStreaming}
            confidenceScore={confidenceScore}
            onSend={sendMessage}
            proposalId={proposalId}
            pricingVisible={pricingVisible}
            priceRange={priceRange}
          />
        </div>
        <div className="w-[45%] overflow-hidden">
          <ModulesPanel
            activeModules={activeModules}
            confidenceScore={confidenceScore}
            priceRange={priceRange}
            pricingVisible={pricingVisible}
            onToggle={toggleModule}
          />
        </div>
      </div>

      {/* Mobile: full chat + bottom drawer */}
      <div className="md:hidden flex-1 overflow-hidden flex flex-col">
        <div className="flex-1 overflow-hidden">
          <ChatPanel
            messages={messages}
            isStreaming={isStreaming}
            confidenceScore={confidenceScore}
            onSend={sendMessage}
            proposalId={proposalId}
            pricingVisible={pricingVisible}
            priceRange={priceRange}
          />
        </div>
        <MobileBottomDrawer
          summary={summaryText}
          activeModules={activeModules}
          confidenceScore={confidenceScore}
          priceRange={priceRange}
          pricingVisible={pricingVisible}
          onToggle={toggleModule}
        />
      </div>
    </div>
  )
}
```

**Step 2: Delete `OnboardingSteps.tsx`**

```bash
rm "/Users/nagi/Downloads/Lamba Lab/Lamba Lab app/components/intake/OnboardingSteps.tsx"
```

**Step 3: Run TypeScript check**

```bash
export PATH="/usr/local/bin:$PATH" && cd "/Users/nagi/Downloads/Lamba Lab/Lamba Lab app" && npx tsc --noEmit 2>&1
```

Expected: no errors. Fix any that appear.

**Step 4: Run tests**

```bash
export PATH="/usr/local/bin:$PATH" && cd "/Users/nagi/Downloads/Lamba Lab/Lamba Lab app" && npx vitest run 2>&1
```

**Step 5: Commit**

```bash
cd "/Users/nagi/Downloads/Lamba Lab/Lamba Lab app" && git add components/intake/IntakeLayout.tsx && git rm components/intake/OnboardingSteps.tsx && git commit -m "feat: simplify IntakeLayout — remove onboarding state, delete OnboardingSteps"
```

---

### Task 4: Fix `IntakeOverlay` — keep `IntakeLayout` mounted when minimized

**Files:**
- Modify: `components/intake/IntakeOverlay.tsx`

**Problem:** Current code does `if (minimized) return <MinimizedBar>` — this completely unmounts `IntakeLayout` and destroys all chat state.

**Step 1: Replace the main `return` block (after the session/error guards) with CSS-based show/hide**

Read the current file, then make these changes:

1. Remove the `if (minimized) { return <MinimizedBar ...> }` early return (lines 49–57)

2. Replace the final `return (...)` with this (keeping everything else — mount effect, session loading, error states — unchanged):

```tsx
  return (
    <>
      {/* MinimizedBar — always rendered when minimized */}
      {minimized && (
        <MinimizedBar
          moduleCount={liveModuleCount}
          confidenceScore={liveConfidenceScore}
          onExpand={() => setMinimized(false)}
        />
      )}

      {/* Loading / error states — only shown when not minimized and session not ready */}
      {!minimized && sessionError && (
        <div className={`fixed inset-0 z-50 bg-brand-dark flex items-center justify-center transition-opacity duration-300 ${mounted ? 'opacity-100' : 'opacity-0'}`}>
          <div className="text-center space-y-3">
            <p className="text-brand-white">Couldn't start session. Please try again.</p>
            <button onClick={() => setMinimized(true)} className="text-brand-gray-mid text-sm hover:text-brand-white transition-colors">
              Dismiss
            </button>
          </div>
        </div>
      )}

      {!minimized && !session && !sessionError && (
        <div className={`fixed inset-0 z-50 bg-brand-dark flex items-center justify-center transition-opacity duration-300 ${mounted ? 'opacity-100' : 'opacity-0'}`}>
          <div className="w-8 h-8 border-2 border-brand-yellow border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* Full overlay — always mounted once session is ready, hidden via CSS when minimized */}
      {session && (
        <div className={`fixed inset-0 z-50 bg-brand-dark flex flex-col transition-opacity duration-300 ${mounted ? 'opacity-100' : 'opacity-0'} ${minimized ? 'hidden' : ''}`}>
          {/* Top bar */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 flex-shrink-0">
            <span className="font-bebas text-xl tracking-widest text-brand-white">LAMBA LAB</span>
            <button
              onClick={() => setMinimized(true)}
              className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-brand-gray-mid hover:text-brand-white transition-colors"
              aria-label="Minimize"
            >
              <Minus className="w-4 h-4" />
            </button>
          </div>

          {/* Main content — stays mounted, preserving all chat state */}
          <IntakeLayout
            proposalId={session.proposalId}
            initialMessage={initialMessage}
            onStateChange={handleStateChange}
          />
        </div>
      )}
    </>
  )
```

**Step 2: Run tests**

```bash
export PATH="/usr/local/bin:$PATH" && cd "/Users/nagi/Downloads/Lamba Lab/Lamba Lab app" && npx vitest run 2>&1
```

**Step 3: TypeScript check**

```bash
export PATH="/usr/local/bin:$PATH" && cd "/Users/nagi/Downloads/Lamba Lab/Lamba Lab app" && npx tsc --noEmit 2>&1
```

**Step 4: Commit**

```bash
cd "/Users/nagi/Downloads/Lamba Lab/Lamba Lab app" && git add components/intake/IntakeOverlay.tsx && git commit -m "fix: keep IntakeLayout mounted when minimized — use CSS hidden to preserve chat state"
```

---

### Task 5: Hide per-module prices — `ModuleCard` + `ModulesPanel`

**Files:**
- Modify: `components/intake/ModuleCard.tsx`
- Modify: `components/intake/ModulesPanel.tsx`

**Step 1: Update `ModuleCard.tsx`**

Add `pricingVisible` prop and replace the price line with a conditional display:

```tsx
'use client'

import { getModuleById, validateModuleRemoval } from '@/lib/modules/dependencies'
import * as Icons from 'lucide-react'
import { X, Plus } from 'lucide-react'

type Props = {
  moduleId: string
  isActive: boolean
  activeModules: string[]
  onToggle: (id: string) => void
  pricingVisible: boolean
}

export default function ModuleCard({ moduleId, isActive, activeModules, onToggle, pricingVisible }: Props) {
  const mod = getModuleById(moduleId)
  if (!mod) return null

  const { canRemove, blockedBy } = validateModuleRemoval(moduleId, activeModules)
  const canToggle = isActive ? canRemove : true

  const IconComponent = (Icons as unknown as Record<string, React.ComponentType<{ className?: string }>>)[mod.icon] ?? Icons.Box

  return (
    <button
      type="button"
      onClick={() => canToggle && onToggle(moduleId)}
      disabled={!canToggle}
      title={!canToggle ? `Required by: ${blockedBy.join(', ')}` : undefined}
      className={`w-full p-3 rounded-xl border transition-all text-left ${
        isActive
          ? 'bg-brand-yellow/5 border-brand-yellow/30'
          : 'bg-white/2 border-white/5 opacity-50'
      } ${canToggle ? 'hover:border-brand-yellow/50' : 'cursor-not-allowed'}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${isActive ? 'bg-brand-yellow/15' : 'bg-white/5'}`}>
            <IconComponent className={`w-4 h-4 ${isActive ? 'text-brand-yellow' : 'text-brand-gray-mid'}`} />
          </div>
          <div className="min-w-0">
            <p className={`text-sm font-medium truncate ${isActive ? 'text-brand-white' : 'text-brand-gray-mid'}`}>
              {mod.name}
            </p>
            {pricingVisible ? (
              <p className="text-xs text-brand-gray-mid truncate">
                ${mod.priceMin.toLocaleString()}–${mod.priceMax.toLocaleString()}
              </p>
            ) : (
              <p className="text-xs text-brand-gray-mid/40 blur-[3px] select-none" aria-hidden="true">
                $●,●●●–$●,●●●
              </p>
            )}
          </div>
        </div>
        <span className={`flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center ${isActive ? 'bg-brand-yellow/20 text-brand-yellow' : 'bg-white/5 text-brand-gray-mid'}`}>
          {isActive ? <X className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
        </span>
      </div>
    </button>
  )
}
```

**Step 2: Update `ModulesPanel.tsx`** — pass `pricingVisible` to each `ModuleCard`

```tsx
import ModuleCard from './ModuleCard'
import { MODULE_CATALOG } from '@/lib/modules/catalog'
import type { PriceRange } from '@/lib/pricing/engine'
import { formatPriceRange } from '@/lib/pricing/engine'

type Props = {
  activeModules: string[]
  confidenceScore: number
  priceRange: PriceRange
  pricingVisible: boolean
  onToggle: (id: string) => void
}

export default function ModulesPanel({ activeModules, confidenceScore: _confidenceScore, priceRange, pricingVisible, onToggle }: Props) {
  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-white/5 flex-shrink-0">
        <h2 className="font-bebas text-2xl text-brand-white tracking-wide">
          TECHNICAL MODULES
        </h2>
        <p className="text-xs text-brand-gray-mid mt-0.5">
          {activeModules.length} selected · Toggle to customize
        </p>
      </div>

      {pricingVisible && (
        <div className="px-4 py-3 bg-brand-yellow/5 border-b border-brand-yellow/10">
          <p className="text-xs text-brand-gray-mid mb-1">Total estimate</p>
          <p className="font-bebas text-3xl text-brand-yellow">{formatPriceRange(priceRange)}</p>
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2">
        {activeModules.length > 0 && (
          <div className="space-y-2">
            {activeModules.map((id) => (
              <ModuleCard
                key={id}
                moduleId={id}
                isActive={true}
                activeModules={activeModules}
                onToggle={onToggle}
                pricingVisible={pricingVisible}
              />
            ))}
          </div>
        )}

        {activeModules.length > 0 && (
          <div className="py-2">
            <div className="h-px bg-white/5" />
            <p className="text-xs text-brand-gray-mid mt-2 mb-1">Add modules</p>
          </div>
        )}

        {MODULE_CATALOG
          .filter((m) => !activeModules.includes(m.id))
          .map((m) => (
            <ModuleCard
              key={m.id}
              moduleId={m.id}
              isActive={false}
              activeModules={activeModules}
              onToggle={onToggle}
              pricingVisible={pricingVisible}
            />
          ))}
      </div>
    </div>
  )
}
```

**Step 3: Run all tests**

```bash
export PATH="/usr/local/bin:$PATH" && cd "/Users/nagi/Downloads/Lamba Lab/Lamba Lab app" && npx vitest run 2>&1
```

**Step 4: TypeScript check**

```bash
export PATH="/usr/local/bin:$PATH" && cd "/Users/nagi/Downloads/Lamba Lab/Lamba Lab app" && npx tsc --noEmit 2>&1
```

**Step 5: Commit**

```bash
cd "/Users/nagi/Downloads/Lamba Lab/Lamba Lab app" && git add components/intake/ModuleCard.tsx components/intake/ModulesPanel.tsx && git commit -m "feat: hide per-module prices until confidence threshold — blurred placeholder when locked"
```

---

### Task 6: Final Verification + Push

**Step 1: Full test suite**

```bash
export PATH="/usr/local/bin:$PATH" && cd "/Users/nagi/Downloads/Lamba Lab/Lamba Lab app" && npx vitest run 2>&1
```

Expected: all tests pass

**Step 2: TypeScript**

```bash
export PATH="/usr/local/bin:$PATH" && cd "/Users/nagi/Downloads/Lamba Lab/Lamba Lab app" && npx tsc --noEmit 2>&1
```

Expected: no errors

**Step 3: Git log — confirm all commits**

```bash
cd "/Users/nagi/Downloads/Lamba Lab/Lamba Lab app" && git log --oneline -8
```

Expected commits (newest first):
- feat: hide per-module prices until confidence threshold
- fix: keep IntakeLayout mounted when minimized
- feat: simplify IntakeLayout — remove onboarding state, delete OnboardingSteps
- feat: move onboarding into chat — useIntakeChat owns 3-step state machine
- feat: rename scale→goal in OnboardingContext

**Step 4: Push**

```bash
cd "/Users/nagi/Downloads/Lamba Lab/Lamba Lab app" && git push origin main
```

---

## Manual Test Checklist

After implementation, verify in the browser (`npm run dev`):

- [ ] Opening the overlay shows Q1 ("What platform?") as a chat bubble immediately — no full-screen step flow
- [ ] Right column (modules panel) is visible from the very first screen
- [ ] Selecting a platform option shows it as a user bubble + Q2 appears as assistant bubble
- [ ] Selecting Q2 → Q3 appears ("What's the goal?") with the 4 business-intent options
- [ ] After Q3, bundled context is sent silently and AI responds with its first real message
- [ ] Minimize button collapses to bottom-right bar
- [ ] Clicking bar re-expands — chat is exactly where it was (onboarding or AI conversation preserved)
- [ ] Module price ranges are blurred/hidden initially (show `$●,●●●–$●,●●●`)
- [ ] As AI confidence increases, prices unlock (same threshold as total estimate)
