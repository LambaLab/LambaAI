# Intake Redesign Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add Gmail-style minimize, hardcoded 3-step onboarding, and rich AI quick-reply cards (list / icon-cards / pills, with multi-select and custom input) to the intake chat.

**Architecture:** New `OnboardingSteps` component runs before the chat, collecting platform/type/scale. After onboarding, AI chat begins with context pre-loaded. The `update_proposal` tool gains a `quick_replies` field; `MessageBubble` renders it. `IntakeOverlay` handles minimize internally — overlay stays mounted, `MinimizedBar` shows at bottom-right.

**Tech Stack:** Next.js App Router, React, Tailwind CSS v4, Anthropic SDK (claude-sonnet-4-6), Vitest

---

## Shared Types (read first, referenced throughout)

```ts
// New file: lib/intake-types.ts
export type QuickReplyOption = {
  label: string
  description?: string   // shown in 'list' style
  icon?: string          // emoji
  value: string          // text sent as message when tapped
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
  scale: string
}
```

---

### Task 1: Shared Types + Unit Tests

**Files:**
- Create: `lib/intake-types.ts`
- Create: `lib/intake-utils.ts`
- Create: `__tests__/intake-utils.test.ts`

**Step 1: Write failing tests**

```ts
// __tests__/intake-utils.test.ts
import { describe, it, expect } from 'vitest'
import { bundleOnboardingContext, serializeMultiSelect } from '@/lib/intake-utils'

describe('bundleOnboardingContext', () => {
  it('returns structured message with all four fields', () => {
    const result = bundleOnboardingContext({
      idea: 'sell stories',
      platform: 'Web App',
      productType: 'Marketplace',
      scale: '<100 users',
    })
    expect(result).toContain('sell stories')
    expect(result).toContain('Web App')
    expect(result).toContain('Marketplace')
    expect(result).toContain('<100 users')
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

**Step 2: Run to verify it fails**

```bash
export PATH="/usr/local/bin:$PATH" && cd "/Users/nagi/Downloads/Lamba Lab/Lamba Lab app" && npx vitest run __tests__/intake-utils.test.ts
```
Expected: FAIL — module not found

**Step 3: Create the types and utils files**

```ts
// lib/intake-types.ts
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
  scale: string
}
```

```ts
// lib/intake-utils.ts
import type { OnboardingContext } from './intake-types'

export function bundleOnboardingContext(ctx: OnboardingContext): string {
  return [
    `User idea: "${ctx.idea}"`,
    `Platform: ${ctx.platform}`,
    `Product type: ${ctx.productType}`,
    `Expected scale: ${ctx.scale}`,
  ].join('\n')
}

export function serializeMultiSelect(values: string[]): string {
  return values.join(', ')
}
```

**Step 4: Run tests — expect PASS**

```bash
export PATH="/usr/local/bin:$PATH" && cd "/Users/nagi/Downloads/Lamba Lab/Lamba Lab app" && npx vitest run __tests__/intake-utils.test.ts
```

**Step 5: Commit**

```bash
cd "/Users/nagi/Downloads/Lamba Lab/Lamba Lab app" && git add lib/intake-types.ts lib/intake-utils.ts __tests__/intake-utils.test.ts && git commit -m "feat: add intake shared types and utils with tests"
```

---

### Task 2: QuickReplies Component

**Files:**
- Create: `components/intake/QuickReplies.tsx`

This component renders all three styles + multi-select + custom input. It is a pure presentational component.

**Step 1: Create the component**

```tsx
// components/intake/QuickReplies.tsx
'use client'

import { useState } from 'react'
import type { QuickReplies as QuickRepliesType, QuickReplyOption } from '@/lib/intake-types'

type Props = {
  quickReplies: QuickRepliesType
  onSelect: (value: string) => void
  disabled?: boolean
}

export default function QuickReplies({ quickReplies, onSelect, disabled }: Props) {
  const { style, multiSelect, allowCustom, options } = quickReplies
  const [selected, setSelected] = useState<string[]>([])
  const [showCustomInput, setShowCustomInput] = useState(false)
  const [customValue, setCustomValue] = useState('')

  function toggleSelected(value: string) {
    setSelected((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]
    )
  }

  function handleSingleSelect(value: string) {
    if (disabled) return
    onSelect(value)
  }

  function handleMultiConfirm() {
    if (disabled || selected.length === 0) return
    const allValues = showCustomInput && customValue.trim()
      ? [...selected, customValue.trim()]
      : selected
    onSelect(allValues.join(', '))
  }

  function handleCustomSubmit() {
    if (disabled || !customValue.trim()) return
    if (multiSelect) {
      setSelected((prev) => [...prev, customValue.trim()])
      setShowCustomInput(false)
      setCustomValue('')
    } else {
      onSelect(customValue.trim())
    }
  }

  const allOptions: (QuickReplyOption | 'custom')[] = allowCustom
    ? [...options, 'custom']
    : options

  if (style === 'icon-cards') {
    return (
      <div className="mt-3 grid grid-cols-2 gap-2">
        {options.map((opt) => (
          <button
            key={opt.value}
            onClick={() => handleSingleSelect(opt.value)}
            disabled={disabled}
            className="flex flex-col items-start gap-1.5 p-3 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 hover:border-brand-yellow/40 transition-all text-left disabled:opacity-50"
          >
            {opt.icon && <span className="text-xl">{opt.icon}</span>}
            <span className="text-sm font-medium text-brand-white">{opt.label}</span>
          </button>
        ))}
        {allowCustom && (
          <button
            onClick={() => setShowCustomInput(true)}
            disabled={disabled}
            className="flex flex-col items-start gap-1.5 p-3 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 hover:border-brand-yellow/40 transition-all text-left disabled:opacity-50"
          >
            <span className="text-xl">✏️</span>
            <span className="text-sm font-medium text-brand-white">Type something</span>
          </button>
        )}
        {showCustomInput && (
          <div className="col-span-2 flex gap-2 mt-1">
            <input
              autoFocus
              value={customValue}
              onChange={(e) => setCustomValue(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCustomSubmit()}
              placeholder="Describe your idea..."
              className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-brand-white placeholder:text-brand-gray-mid outline-none focus:border-brand-yellow/50"
            />
            <button
              onClick={handleCustomSubmit}
              disabled={!customValue.trim()}
              className="px-3 py-2 bg-brand-yellow text-brand-dark rounded-xl text-sm font-medium disabled:opacity-40"
            >
              Send
            </button>
          </div>
        )}
      </div>
    )
  }

  if (style === 'pills') {
    return (
      <div className="mt-3 flex flex-wrap gap-2">
        {options.map((opt) => {
          const isChecked = selected.includes(opt.value)
          return (
            <button
              key={opt.value}
              onClick={() => multiSelect ? toggleSelected(opt.value) : handleSingleSelect(opt.value)}
              disabled={disabled}
              className={`px-3 py-1.5 rounded-full border text-sm transition-all disabled:opacity-50 ${
                isChecked
                  ? 'bg-brand-yellow text-brand-dark border-brand-yellow font-medium'
                  : 'bg-white/5 text-brand-white border-white/10 hover:border-brand-yellow/40'
              }`}
            >
              {opt.icon && <span className="mr-1">{opt.icon}</span>}
              {opt.label}
            </button>
          )
        })}
        {allowCustom && !showCustomInput && (
          <button
            onClick={() => setShowCustomInput(true)}
            disabled={disabled}
            className="px-3 py-1.5 rounded-full border border-white/10 bg-white/5 text-brand-gray-mid text-sm hover:border-brand-yellow/40 transition-all"
          >
            ✏️ Other...
          </button>
        )}
        {showCustomInput && (
          <div className="w-full flex gap-2 mt-1">
            <input
              autoFocus
              value={customValue}
              onChange={(e) => setCustomValue(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCustomSubmit()}
              placeholder="Type your answer..."
              className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-brand-white placeholder:text-brand-gray-mid outline-none focus:border-brand-yellow/50"
            />
            <button
              onClick={handleCustomSubmit}
              disabled={!customValue.trim()}
              className="px-3 py-2 bg-brand-yellow text-brand-dark rounded-xl text-sm font-medium disabled:opacity-40"
            >
              Send
            </button>
          </div>
        )}
        {multiSelect && selected.length > 0 && (
          <button
            onClick={handleMultiConfirm}
            disabled={disabled}
            className="w-full mt-2 py-2 bg-brand-yellow text-brand-dark font-medium rounded-xl text-sm transition-all hover:bg-brand-yellow/90 disabled:opacity-50"
          >
            Continue →
          </button>
        )}
      </div>
    )
  }

  // style === 'list' (default) — AskUserQuestion clone
  return (
    <div className="mt-3 space-y-0 rounded-xl border border-white/10 overflow-hidden">
      {allOptions.map((opt, i) => {
        const isCustom = opt === 'custom'
        const value = isCustom ? '' : (opt as QuickReplyOption).value
        const isChecked = !isCustom && selected.includes(value)
        const num = i + 1

        if (isCustom) {
          return (
            <div key="custom" className="border-t border-white/10 first:border-t-0">
              {showCustomInput ? (
                <div className="flex gap-2 p-3">
                  <input
                    autoFocus
                    value={customValue}
                    onChange={(e) => setCustomValue(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleCustomSubmit()}
                    placeholder="Type your answer..."
                    className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-brand-white placeholder:text-brand-gray-mid outline-none focus:border-brand-yellow/50"
                  />
                  <button
                    onClick={handleCustomSubmit}
                    disabled={!customValue.trim()}
                    className="px-3 py-2 bg-brand-yellow text-brand-dark rounded-lg text-sm font-medium disabled:opacity-40"
                  >
                    Send
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowCustomInput(true)}
                  disabled={disabled}
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/5 transition-colors text-left disabled:opacity-50"
                >
                  <span className="text-sm text-brand-gray-mid">Type something else...</span>
                  <span className="text-xs text-brand-gray-mid bg-white/10 rounded-md px-2 py-0.5 font-mono">{num}</span>
                </button>
              )}
            </div>
          )
        }

        const option = opt as QuickReplyOption
        return (
          <button
            key={option.value}
            onClick={() => multiSelect ? toggleSelected(option.value) : handleSingleSelect(option.value)}
            disabled={disabled}
            className={`w-full flex items-start justify-between px-4 py-3 hover:bg-white/5 transition-colors text-left border-t border-white/10 first:border-t-0 disabled:opacity-50 ${
              isChecked ? 'bg-white/8' : ''
            }`}
          >
            <div className="flex items-start gap-3 flex-1 min-w-0">
              {multiSelect && (
                <div className={`mt-0.5 w-4 h-4 rounded flex-shrink-0 border flex items-center justify-center ${
                  isChecked ? 'bg-brand-yellow border-brand-yellow' : 'border-white/30'
                }`}>
                  {isChecked && <span className="text-brand-dark text-[10px] font-bold">✓</span>}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-brand-white">
                  {option.icon && <span className="mr-1.5">{option.icon}</span>}
                  {option.label}
                </p>
                {option.description && (
                  <p className="text-xs text-brand-gray-mid mt-0.5 leading-relaxed">{option.description}</p>
                )}
              </div>
            </div>
            <span className="text-xs text-brand-gray-mid bg-white/10 rounded-md px-2 py-0.5 font-mono ml-3 flex-shrink-0">{num}</span>
          </button>
        )
      })}

      {multiSelect && selected.length > 0 && (
        <div className="border-t border-white/10 p-3">
          <button
            onClick={handleMultiConfirm}
            disabled={disabled}
            className="w-full py-2 bg-brand-yellow text-brand-dark font-medium rounded-xl text-sm transition-all hover:bg-brand-yellow/90 disabled:opacity-50"
          >
            Continue →
          </button>
        </div>
      )}
    </div>
  )
}
```

**Step 2: Run existing tests to make sure nothing broke**

```bash
export PATH="/usr/local/bin:$PATH" && cd "/Users/nagi/Downloads/Lamba Lab/Lamba Lab app" && npx vitest run
```
Expected: all existing tests pass

**Step 3: Commit**

```bash
cd "/Users/nagi/Downloads/Lamba Lab/Lamba Lab app" && git add components/intake/QuickReplies.tsx && git commit -m "feat: add QuickReplies component (list/icon-cards/pills + multi-select + custom input)"
```

---

### Task 3: Update MessageBubble + useIntakeChat types

**Files:**
- Modify: `hooks/useIntakeChat.ts`
- Modify: `components/intake/MessageBubble.tsx`

**Step 1: Add `quickReplies` to `ChatMessage` type and handle in `useIntakeChat`**

In `hooks/useIntakeChat.ts`:

1. Add import at top:
```ts
import type { QuickReplies } from '@/lib/intake-types'
```

2. Update `ChatMessage` type:
```ts
export type ChatMessage = {
  id: string
  role: 'user' | 'assistant'
  content: string
  capabilityCards?: string[]
  quickReplies?: QuickReplies    // ADD THIS
}
```

3. In the `tool_result` handler (after the `setMessages` call that sets content/capabilityCards), also set quickReplies:
```ts
// After existing setMessages call, add:
// Parse quickReplies from tool input if present
const rawQR = (data.input as Record<string, unknown>)?.quick_replies
if (rawQR && typeof rawQR === 'object') {
  const qr = rawQR as QuickReplies
  setMessages((prev) => {
    const last = prev[prev.length - 1]
    if (last?.role !== 'assistant') return prev
    return [...prev.slice(0, -1), { ...last, quickReplies: qr }]
  })
}
```

4. Update `sendMessage` to clear `quickReplies` on the last assistant message when a new user message is sent. Add this right after `setMessages((prev) => [...prev, userMessage])`:
```ts
// Clear quickReplies from the last assistant message when user replies
setMessages((prev) => {
  const lastAssistant = [...prev].reverse().find((m) => m.role === 'assistant')
  if (!lastAssistant) return prev
  return prev.map((m) => m.id === lastAssistant.id ? { ...m, quickReplies: undefined } : m)
})
```

**Step 2: Update MessageBubble to render QuickReplies**

Replace `components/intake/MessageBubble.tsx` with:

```tsx
import type { ChatMessage } from '@/hooks/useIntakeChat'
import QuickReplies from './QuickReplies'

type Props = {
  message: ChatMessage
  isStreaming?: boolean
  onQuickReply?: (value: string) => void
  isLastMessage?: boolean
}

export default function MessageBubble({ message, isStreaming, onQuickReply, isLastMessage }: Props) {
  const isUser = message.role === 'user'
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className="max-w-[85%] space-y-3">
        <div
          className={`px-4 py-3 rounded-2xl text-sm leading-relaxed ${
            isUser
              ? 'bg-brand-yellow text-brand-dark font-medium rounded-br-sm'
              : 'bg-white/5 text-brand-white rounded-bl-sm'
          }`}
        >
          {message.content}
          {isStreaming && !message.content && (
            <span className="inline-flex gap-1">
              <span className="w-1.5 h-1.5 bg-brand-gray-mid rounded-full animate-bounce [animation-delay:0ms]" />
              <span className="w-1.5 h-1.5 bg-brand-gray-mid rounded-full animate-bounce [animation-delay:150ms]" />
              <span className="w-1.5 h-1.5 bg-brand-gray-mid rounded-full animate-bounce [animation-delay:300ms]" />
            </span>
          )}
        </div>

        {message.capabilityCards && message.capabilityCards.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {message.capabilityCards.map((card) => (
              <span
                key={card}
                className="px-3 py-1.5 text-xs font-medium border border-brand-yellow/30 text-brand-yellow rounded-lg"
              >
                {card}
              </span>
            ))}
          </div>
        )}

        {message.quickReplies && isLastMessage && onQuickReply && (
          <QuickReplies
            quickReplies={message.quickReplies}
            onSelect={onQuickReply}
            disabled={isStreaming}
          />
        )}
      </div>
    </div>
  )
}
```

**Step 3: Update ChatPanel to pass `onQuickReply` and `isLastMessage` to MessageBubble**

In `components/intake/ChatPanel.tsx`, update the `MessageBubble` usage inside the messages map:

```tsx
{messages.map((msg, i) => (
  <MessageBubble
    key={msg.id}
    message={msg}
    isStreaming={isStreaming && i === messages.length - 1 && msg.role === 'assistant'}
    onQuickReply={onSend}
    isLastMessage={i === messages.length - 1}
  />
))}
```

**Step 4: Run all tests**

```bash
export PATH="/usr/local/bin:$PATH" && cd "/Users/nagi/Downloads/Lamba Lab/Lamba Lab app" && npx vitest run
```
Expected: all pass

**Step 5: Commit**

```bash
cd "/Users/nagi/Downloads/Lamba Lab/Lamba Lab app" && git add hooks/useIntakeChat.ts components/intake/MessageBubble.tsx components/intake/ChatPanel.tsx && git commit -m "feat: wire QuickReplies into chat — ChatMessage type, MessageBubble render, ChatPanel passthrough"
```

---

### Task 4: Update AI Tool Schema + System Prompt

**Files:**
- Modify: `lib/ai/tools.ts`
- Modify: `lib/ai/system-prompt.ts`

**Step 1: Add `quick_replies` to `UPDATE_PROPOSAL_TOOL` in `lib/ai/tools.ts`**

Add the following property inside `input_schema.properties` (after `capability_cards`):

```ts
quick_replies: {
  type: 'object',
  description: 'Structured quick-reply options to show below your message. Always include this.',
  properties: {
    style: {
      type: 'string',
      enum: ['list', 'icon-cards', 'pills'],
      description: 'list = numbered items with descriptions (complex questions). icon-cards = 2x2 grid with emoji (platform/type). pills = compact chips (simple/short answers).',
    },
    multiSelect: {
      type: 'boolean',
      description: 'true if the user can pick multiple answers (e.g. "which features do you need?")',
    },
    allowCustom: {
      type: 'boolean',
      description: 'true to append a "Type something else..." option. Use unless options are exhaustive.',
    },
    options: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          label: { type: 'string', description: 'Short bold label (≤5 words)' },
          description: { type: 'string', description: 'Subtitle for list style only (≤12 words)' },
          icon: { type: 'string', description: 'Single emoji' },
          value: { type: 'string', description: 'Text sent as user message when tapped' },
        },
        required: ['label', 'value'],
      },
    },
  },
  required: ['style', 'options'],
},
```

Do NOT add `quick_replies` to the `required` array — it's optional.

**Step 2: Update system prompt in `lib/ai/system-prompt.ts`**

Add a new section after `## Your Job Each Turn`:

```ts
## Quick Replies (REQUIRED every turn)
Always include \`quick_replies\` in your tool call. Rules:
- **style: 'list'** — use for nuanced questions (monetization, auth model, feature selection). Include \`description\` for each option.
- **style: 'icon-cards'** — use for platform/product type questions. Include \`icon\` emoji for each option. Max 4 options.
- **style: 'pills'** — use for simple/short answers (yes/no, scale, timeline). Keep labels ≤3 words.
- **multiSelect: true** — use when multiple answers are valid (e.g. "which features do you need?")
- **allowCustom: true** — use unless the options are truly exhaustive (e.g. a yes/no question)
- Provide 2–4 options. Never more than 5.
- Keep label ≤5 words, description ≤12 words.
```

**Step 3: Run all tests**

```bash
export PATH="/usr/local/bin:$PATH" && cd "/Users/nagi/Downloads/Lamba Lab/Lamba Lab app" && npx vitest run
```

**Step 4: Commit**

```bash
cd "/Users/nagi/Downloads/Lamba Lab/Lamba Lab app" && git add lib/ai/tools.ts lib/ai/system-prompt.ts && git commit -m "feat: add quick_replies to update_proposal tool schema and system prompt instructions"
```

---

### Task 5: MinimizedBar Component + IntakeOverlay Minimize State

**Files:**
- Create: `components/intake/MinimizedBar.tsx`
- Modify: `components/intake/IntakeOverlay.tsx`
- Modify: `components/landing/HeroSection.tsx`

**Step 1: Create `MinimizedBar`**

```tsx
// components/intake/MinimizedBar.tsx
'use client'

import { ChevronUp } from 'lucide-react'

type Props = {
  moduleCount: number
  confidenceScore: number
  onExpand: () => void
}

export default function MinimizedBar({ moduleCount, confidenceScore, onExpand }: Props) {
  const pct = Math.min(100, Math.max(0, confidenceScore))
  return (
    <button
      onClick={onExpand}
      className="fixed bottom-4 right-4 z-50 flex items-center gap-3 px-4 py-3 bg-[#1a1a1a] border border-white/10 rounded-2xl shadow-2xl hover:border-brand-yellow/30 transition-all w-72"
    >
      <span className="text-base">🔨</span>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-bebas tracking-widest text-brand-white">LAMBA LAB</p>
        <div className="flex items-center gap-2 mt-0.5">
          <p className="text-[11px] text-brand-gray-mid whitespace-nowrap">
            {moduleCount} module{moduleCount !== 1 ? 's' : ''} · {pct}%
          </p>
          <div className="flex-1 h-1 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-brand-yellow rounded-full transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      </div>
      <ChevronUp className="w-4 h-4 text-brand-gray-mid flex-shrink-0" />
    </button>
  )
}
```

**Step 2: Update `IntakeOverlay` to manage minimize internally**

Replace the full content of `components/intake/IntakeOverlay.tsx`:

```tsx
'use client'

import { useEffect, useState } from 'react'
import { Minus } from 'lucide-react'
import IntakeLayout from './IntakeLayout'
import MinimizedBar from './MinimizedBar'
import { getOrCreateSession, type SessionData } from '@/lib/session'

type Props = {
  initialMessage: string
  moduleCount?: number
  confidenceScore?: number
}

export default function IntakeOverlay({ initialMessage, moduleCount = 0, confidenceScore = 0 }: Props) {
  const [session, setSession] = useState<SessionData | null>(null)
  const [sessionError, setSessionError] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [minimized, setMinimized] = useState(false)

  useEffect(() => {
    setMounted(true)
    const timer = setTimeout(() => {
      document.body.style.overflow = 'hidden'
    }, 50)
    return () => {
      clearTimeout(timer)
      document.body.style.overflow = ''
    }
  }, [])

  useEffect(() => {
    if (minimized) {
      document.body.style.overflow = ''
    } else {
      document.body.style.overflow = 'hidden'
    }
  }, [minimized])

  useEffect(() => {
    getOrCreateSession().then(setSession).catch(() => setSessionError(true))
  }, [])

  if (minimized) {
    return (
      <MinimizedBar
        moduleCount={moduleCount}
        confidenceScore={confidenceScore}
        onExpand={() => setMinimized(false)}
      />
    )
  }

  if (sessionError) {
    return (
      <div className={`fixed inset-0 z-50 bg-brand-dark flex items-center justify-center transition-opacity duration-300 ${mounted ? 'opacity-100' : 'opacity-0'}`}>
        <div className="text-center space-y-3">
          <p className="text-brand-white">Couldn't start session. Please try again.</p>
          <button onClick={() => setMinimized(true)} className="text-brand-gray-mid text-sm hover:text-brand-white transition-colors">
            Dismiss
          </button>
        </div>
      </div>
    )
  }

  if (!session) {
    return (
      <div className={`fixed inset-0 z-50 bg-brand-dark flex items-center justify-center transition-opacity duration-300 ${mounted ? 'opacity-100' : 'opacity-0'}`}>
        <div className="w-8 h-8 border-2 border-brand-yellow border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className={`fixed inset-0 z-50 bg-brand-dark flex flex-col transition-opacity duration-300 ${mounted ? 'opacity-100' : 'opacity-0'}`}>
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

      {/* Main content */}
      <IntakeLayout
        proposalId={session.proposalId}
        initialMessage={initialMessage}
      />
    </div>
  )
}
```

**Note:** `moduleCount` and `confidenceScore` props are wired up in Task 6 — for now they use defaults.

**Step 3: Update `HeroSection` — remove `onMinimize` prop**

In `components/landing/HeroSection.tsx`, the `IntakeOverlay` now handles minimize internally. Remove the `onMinimize` prop:

```tsx
{intakeOpen && (
  <IntakeOverlay
    initialMessage={initialMessage}
  />
)}
```

**Step 4: Run all tests**

```bash
export PATH="/usr/local/bin:$PATH" && cd "/Users/nagi/Downloads/Lamba Lab/Lamba Lab app" && npx vitest run
```

**Step 5: Commit**

```bash
cd "/Users/nagi/Downloads/Lamba Lab/Lamba Lab app" && git add components/intake/MinimizedBar.tsx components/intake/IntakeOverlay.tsx components/landing/HeroSection.tsx && git commit -m "feat: Gmail-style minimize — MinimizedBar with progress, overlay handles state internally"
```

---

### Task 6: Bubble Module/Confidence State Up to IntakeOverlay

The `MinimizedBar` needs live `moduleCount` and `confidenceScore`. These come from `useIntakeChat` which lives inside `IntakeLayout`. We need to lift this state up so `IntakeOverlay` can access it.

**Files:**
- Modify: `components/intake/IntakeLayout.tsx`
- Modify: `components/intake/IntakeOverlay.tsx`

**Step 1: Add `onStateChange` callback prop to `IntakeLayout`**

In `components/intake/IntakeLayout.tsx`:

1. Add to `Props`:
```ts
type Props = {
  proposalId: string
  initialMessage: string
  onStateChange?: (moduleCount: number, confidenceScore: number) => void
}
```

2. Add a `useEffect` that calls `onStateChange` whenever `activeModules` or `confidenceScore` changes:
```ts
useEffect(() => {
  onStateChange?.(activeModules.length, confidenceScore)
}, [activeModules.length, confidenceScore, onStateChange])
```

**Step 2: Wire up in `IntakeOverlay`**

1. Add state:
```ts
const [liveModuleCount, setLiveModuleCount] = useState(0)
const [liveConfidenceScore, setLiveConfidenceScore] = useState(0)
```

2. Remove `moduleCount` and `confidenceScore` props (they're no longer needed from outside).

3. Pass callback to `IntakeLayout`:
```tsx
<IntakeLayout
  proposalId={session.proposalId}
  initialMessage={initialMessage}
  onStateChange={(m, c) => { setLiveModuleCount(m); setLiveConfidenceScore(c) }}
/>
```

4. Pass live values to `MinimizedBar`:
```tsx
<MinimizedBar
  moduleCount={liveModuleCount}
  confidenceScore={liveConfidenceScore}
  onExpand={() => setMinimized(false)}
/>
```

**Step 3: Run all tests**

```bash
export PATH="/usr/local/bin:$PATH" && cd "/Users/nagi/Downloads/Lamba Lab/Lamba Lab app" && npx vitest run
```

**Step 4: Commit**

```bash
cd "/Users/nagi/Downloads/Lamba Lab/Lamba Lab app" && git add components/intake/IntakeLayout.tsx components/intake/IntakeOverlay.tsx && git commit -m "feat: bubble module count and confidence score up to IntakeOverlay for MinimizedBar"
```

---

### Task 7: OnboardingSteps Component

**Files:**
- Create: `components/intake/OnboardingSteps.tsx`

**Step 1: Create the component**

```tsx
// components/intake/OnboardingSteps.tsx
'use client'

import { useState } from 'react'
import type { OnboardingContext } from '@/lib/intake-types'

type Props = {
  idea: string
  onComplete: (ctx: OnboardingContext) => void
}

type Step = 0 | 1 | 2

const PLATFORM_OPTIONS = [
  { label: 'Web App', icon: '🌐', value: 'Web App' },
  { label: 'Mobile App', icon: '📱', value: 'Mobile App' },
  { label: 'Both', icon: '🖥️', value: 'Web + Mobile' },
  { label: 'Not sure yet', icon: '🤔', value: 'Platform TBD' },
]

const TYPE_OPTIONS = [
  { label: 'Marketplace', icon: '🛒', value: 'Marketplace' },
  { label: 'Social / Community', icon: '💬', value: 'Social / Community' },
  { label: 'SaaS / Internal Tool', icon: '🛠️', value: 'SaaS / Internal Tool' },
  { label: 'Something else', icon: '🎯', value: 'Other' },
]

const SCALE_OPTIONS = [
  { label: 'Just me', icon: '👤', value: 'Just me (personal use)' },
  { label: '<100 users', icon: '👥', value: '<100 users' },
  { label: '1,000+ users', icon: '🏢', value: '1,000+ users' },
  { label: 'Not sure', icon: '🤷', value: 'Scale TBD' },
]

const STEPS = [
  { question: "What platform are you building for?", options: PLATFORM_OPTIONS, style: 'cards' as const },
  { question: "What type of product is this?", options: TYPE_OPTIONS, style: 'cards' as const },
  { question: "What's the expected scale?", options: SCALE_OPTIONS, style: 'pills' as const },
]

export default function OnboardingSteps({ idea, onComplete }: Props) {
  const [step, setStep] = useState<Step>(0)
  const [answers, setAnswers] = useState<string[]>([])

  function handleSelect(value: string) {
    const newAnswers = [...answers, value]
    if (step < 2) {
      setAnswers(newAnswers)
      setStep((step + 1) as Step)
    } else {
      onComplete({
        idea,
        platform: newAnswers[0],
        productType: newAnswers[1],
        scale: value,
      })
    }
  }

  const current = STEPS[step]

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-6 py-8 max-w-md mx-auto w-full">
      {/* Progress dots */}
      <div className="flex gap-2 mb-8">
        {STEPS.map((_, i) => (
          <div
            key={i}
            className={`h-1.5 rounded-full transition-all duration-300 ${
              i === step ? 'w-8 bg-brand-yellow' : i < step ? 'w-4 bg-brand-yellow/50' : 'w-4 bg-white/10'
            }`}
          />
        ))}
      </div>

      <p className="text-brand-gray-mid text-xs uppercase tracking-widest mb-3">Step {step + 1} of 3</p>
      <h2 className="font-bebas text-3xl text-brand-white text-center mb-6">{current.question}</h2>

      {current.style === 'cards' ? (
        <div className="grid grid-cols-2 gap-3 w-full">
          {current.options.map((opt) => (
            <button
              key={opt.value}
              onClick={() => handleSelect(opt.value)}
              className="flex flex-col items-start gap-2 p-4 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 hover:border-brand-yellow/40 transition-all text-left active:scale-[0.98]"
            >
              <span className="text-2xl">{opt.icon}</span>
              <span className="text-sm font-medium text-brand-white leading-tight">{opt.label}</span>
            </button>
          ))}
        </div>
      ) : (
        <div className="flex flex-wrap gap-2 justify-center w-full">
          {current.options.map((opt) => (
            <button
              key={opt.value}
              onClick={() => handleSelect(opt.value)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-full border border-white/10 bg-white/5 hover:bg-white/10 hover:border-brand-yellow/40 transition-all text-sm text-brand-white active:scale-[0.98]"
            >
              <span>{opt.icon}</span>
              <span>{opt.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
```

**Step 2: Run all tests**

```bash
export PATH="/usr/local/bin:$PATH" && cd "/Users/nagi/Downloads/Lamba Lab/Lamba Lab app" && npx vitest run
```

**Step 3: Commit**

```bash
cd "/Users/nagi/Downloads/Lamba Lab/Lamba Lab app" && git add components/intake/OnboardingSteps.tsx && git commit -m "feat: add OnboardingSteps component (3-step platform/type/scale with icon cards)"
```

---

### Task 8: Wire OnboardingSteps Into IntakeLayout + Update HeroSection

**Files:**
- Modify: `components/intake/IntakeLayout.tsx`
- Modify: `components/landing/HeroSection.tsx`
- Modify: `components/landing/HeroInput.tsx` (or wherever the CTA button lives)

**Step 1: Read `HeroInput.tsx` first**

```bash
cat "/Users/nagi/Downloads/Lamba Lab/Lamba Lab app/components/landing/HeroInput.tsx"
```

**Step 2: Update `IntakeLayout` to show `OnboardingSteps` before chat**

In `components/intake/IntakeLayout.tsx`:

1. Add imports:
```ts
import { useState } from 'react'
import OnboardingSteps from './OnboardingSteps'
import { bundleOnboardingContext } from '@/lib/intake-utils'
import type { OnboardingContext } from '@/lib/intake-types'
```

2. Update Props — `initialMessage` is now the user's idea (may be empty string if CTA changed):
```ts
type Props = {
  proposalId: string
  initialMessage: string   // the user's typed idea from hero (may be '')
  onStateChange?: (moduleCount: number, confidenceScore: number) => void
}
```

3. Add state:
```ts
const [onboardingDone, setOnboardingDone] = useState(false)
const [bundledMessage, setBundledMessage] = useState('')
```

4. Update `useIntakeChat` call — pass `bundledMessage` instead of `initialMessage`:
```ts
const { ... } = useIntakeChat({ proposalId, initialMessage: onboardingDone ? bundledMessage : '' })
```

5. Add `handleOnboardingComplete`:
```ts
function handleOnboardingComplete(ctx: OnboardingContext) {
  const msg = bundleOnboardingContext(ctx)
  setBundledMessage(msg)
  setOnboardingDone(true)
}
```

6. In the JSX, render `OnboardingSteps` when not done yet. Replace `<div className="flex-1 overflow-hidden flex">` with:

```tsx
if (!onboardingDone) {
  return (
    <div className="flex-1 overflow-hidden flex flex-col">
      <OnboardingSteps
        idea={initialMessage}
        onComplete={handleOnboardingComplete}
      />
    </div>
  )
}

return (
  <div className="flex-1 overflow-hidden flex">
    {/* existing desktop + mobile layout unchanged */}
  </div>
)
```

**Step 3: Update HeroSection — CTA opens intake immediately (no text required)**

The user still sees the `HeroInput` text field (nice-to-have for idea), but the intake opens as soon as they click the CTA even if the field is empty. The idea is passed as `initialMessage` to `IntakeOverlay`, and the onboarding shows first.

In `components/landing/HeroSection.tsx`, change `handleFirstMessage` to:
```ts
function handleStart(message: string = '') {
  setInitialMessage(message)
  setIntakeOpen(true)
}
```

Update `HeroInput` to call `onFirstMessage('')` immediately on button click (no waiting for text). If the user has typed something, pass it through.

**Step 4: Run all tests**

```bash
export PATH="/usr/local/bin:$PATH" && cd "/Users/nagi/Downloads/Lamba Lab/Lamba Lab app" && npx vitest run
```

**Step 5: Commit**

```bash
cd "/Users/nagi/Downloads/Lamba Lab/Lamba Lab app" && git add components/intake/IntakeLayout.tsx components/landing/HeroSection.tsx && git commit -m "feat: wire OnboardingSteps into IntakeLayout — runs before AI chat with bundled context"
```

---

### Task 9: Final Verification

**Step 1: Run full test suite**

```bash
export PATH="/usr/local/bin:$PATH" && cd "/Users/nagi/Downloads/Lamba Lab/Lamba Lab app" && npx vitest run
```
Expected: all tests pass (28+ tests)

**Step 2: TypeScript check**

```bash
export PATH="/usr/local/bin:$PATH" && cd "/Users/nagi/Downloads/Lamba Lab/Lamba Lab app" && npx tsc --noEmit 2>&1 | head -30
```
Expected: no errors

**Step 3: Push to GitHub**

```bash
cd "/Users/nagi/Downloads/Lamba Lab/Lamba Lab app" && git push origin main
```

---

## Manual Test Checklist

After implementation, verify these flows manually in the browser (`npm run dev`):

- [ ] Clicking CTA opens intake overlay immediately
- [ ] Onboarding step 1 shows 4 platform cards with icons
- [ ] Selecting a card advances to step 2 (no delay)
- [ ] Step 3 shows pill chips
- [ ] After step 3, chat starts with AI receiving bundled context
- [ ] AI response includes quick replies below the message bubble
- [ ] `list` style shows numbered items with descriptions
- [ ] `icon-cards` style shows 2×2 grid
- [ ] `pills` style shows inline chips
- [ ] Tapping a single-select reply sends it as user message and clears quick replies
- [ ] `multiSelect` shows checkboxes + "Continue →" button
- [ ] "Type something else..." reveals inline input field
- [ ] Minus button collapses to bottom-right bar
- [ ] Bar shows module count + confidence % + mini progress bar
- [ ] Clicking bar re-expands full overlay with all state preserved
