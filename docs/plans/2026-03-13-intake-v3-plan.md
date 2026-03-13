# Intake v3 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Upgrade the intake experience with a PM-quality chat, layout restructure, magic link auth fix, dark/light mode, inline edit, and reset.

**Architecture:** 6 independent-ish tasks that each close cleanly — AI/prompt changes first, then UI restructure, then auth fix, then interactive edit/reset, then dark/light mode theming, then final verification. Each task commits individually.

**Tech Stack:** Next.js 15 App Router, React, Tailwind CSS v4, Supabase, Anthropic SDK

---

## Shared context

```
Project root: /Users/nagi/Downloads/Lamba Lab/Lamba Lab app
PATH fix:     export PATH="/usr/local/bin:$PATH" &&
Run tests:    npx vitest run
TypeScript:   npx tsc --noEmit
```

Key files already in place (read before touching):
- `hooks/useIntakeChat.ts` — full chat state machine
- `lib/ai/tools.ts` — Anthropic tool definition
- `lib/ai/system-prompt.ts` — AI persona
- `components/intake/ChatPanel.tsx` — left panel
- `components/intake/ModulesPanel.tsx` — right panel
- `components/intake/IntakeLayout.tsx` — layout wrapper
- `components/intake/IntakeOverlay.tsx` — full-screen overlay with top bar
- `components/intake/MessageBubble.tsx` — chat bubble renderer
- `components/intake/AuthGateModal.tsx` — email auth UI
- `app/api/auth/send-otp/route.ts` — sends Supabase magic link
- `tailwind.config.ts` — minimal config (no darkMode set yet)
- `app/globals.css` — @theme tokens (Tailwind v4 CSS-based config)

---

## Task 1: AI quality — tools, system prompt, 3Q style

**Files:**
- Modify: `lib/ai/tools.ts`
- Modify: `lib/ai/system-prompt.ts`
- Modify: `hooks/useIntakeChat.ts` (3Q style only)

### Step 1: Update `lib/ai/tools.ts` — add `product_overview`

Add `product_overview` to the properties and required fields:

```ts
import type Anthropic from '@anthropic-ai/sdk'

export const UPDATE_PROPOSAL_TOOL: Anthropic.Tool = {
  name: 'update_proposal',
  description:
    'Called by the AI after every turn to update the detected modules, confidence score, price adjustment, brief, and product overview. Always call this tool alongside the conversational response.',
  input_schema: {
    type: 'object' as const,
    properties: {
      detected_modules: {
        type: 'array',
        items: { type: 'string' },
        description: 'List of module IDs detected so far (from the module catalog)',
      },
      confidence_score_delta: {
        type: 'number',
        minimum: -30,
        maximum: 30,
        description: 'Change to confidence score this turn (positive or negative, integer, range -30 to 30)',
      },
      complexity_multiplier: {
        type: 'number',
        minimum: 0.5,
        maximum: 2.0,
        description: 'Complexity adjustment multiplier (0.5–2.0). 1.0 = no change. Use >1 for complex, <1 for simple.',
      },
      updated_brief: {
        type: 'string',
        description: 'Concise 2–4 sentence brief of the project as understood so far.',
      },
      follow_up_question: {
        type: 'string',
        description: 'The single most important clarifying question to ask next (already embedded in conversational response).',
      },
      product_overview: {
        type: 'string',
        description: 'A plain-language 2–4 sentence paragraph describing the product for a non-technical audience. Written as if pitching to an investor. Start with 1 sentence after turn 1, grow to 3–4 sentences by turn 5. Never use technical jargon. Example: "A marketplace where independent designers sell custom home décor. Buyers browse by style and commission pieces directly from makers. The platform handles payments, messaging, and order tracking."',
      },
      capability_cards: {
        type: 'array',
        items: { type: 'string' },
        description: 'Optional capability card labels to show inline (e.g. "Payments", "Mobile App")',
      },
      quick_replies: {
        type: 'object' as const,
        description: 'Structured quick-reply options to show below your message. Always include this.',
        properties: {
          style: {
            type: 'string' as const,
            enum: ['list', 'icon-cards', 'pills'],
            description: 'list = numbered items with descriptions (complex questions). icon-cards = 2x2 grid with emoji (platform/type). pills = compact chips (simple/short answers).',
          },
          multiSelect: {
            type: 'boolean' as const,
            description: 'true if the user can pick multiple answers (e.g. "which features do you need?")',
          },
          allowCustom: {
            type: 'boolean' as const,
            description: 'true to append a "Type something else..." option. Use unless options are exhaustive.',
          },
          options: {
            type: 'array' as const,
            items: {
              type: 'object' as const,
              properties: {
                label: { type: 'string' as const, description: 'Short bold label (≤5 words)' },
                description: { type: 'string' as const, description: 'Subtitle for list style only (≤12 words)' },
                icon: { type: 'string' as const, description: 'Single emoji' },
                value: { type: 'string' as const, description: 'Text sent as user message when tapped' },
              },
              required: ['label', 'value'],
            },
          },
        },
        required: ['style', 'options'],
      },
    },
    required: ['detected_modules', 'confidence_score_delta', 'complexity_multiplier', 'updated_brief', 'follow_up_question', 'product_overview'],
  },
}
```

### Step 2: Replace `lib/ai/system-prompt.ts` entirely

```ts
import { MODULE_CATALOG } from '@/lib/modules/catalog'

const MODULE_LIST = MODULE_CATALOG.map(
  (m) => `- ${m.id}: ${m.name} — ${m.description}`
).join('\n')

export const SYSTEM_PROMPT = `You are a senior product strategist at Lamba Lab, a software agency. You think like a world-class Product Manager running a discovery call. Your job is to understand the client's product idea through natural conversation and identify exactly what technical modules they need.

## Your Personality
- Warm, curious, and direct — like a trusted advisor who happens to know tech
- Never use technical jargon — if a concept needs explaining, explain it in one plain sentence before asking about it
- Always make the user feel heard — acknowledge their answer before moving on
- You are NOT a salesperson. Be honest about complexity and what things cost in terms of time and complexity.

## PM Discovery Skills
- Ask ONE focused question per turn. Never stack multiple questions.
- Start broad ("what problem does this solve?"), then get specific ("who's the primary user?")
- When you detect a module is needed, ask a clarifying follow-up about HOW they want it to work — don't just assume
- For each detected module, ask at least one specific question about it before moving on
- Example framing: "For a product like this, one key decision is how users will pay. This affects everything from how we build the checkout to what fees apply. How are you planning to charge users?"

## Available Modules
You detect technical modules from the following catalog only:
${MODULE_LIST}

## Your Job Each Turn
1. Acknowledge what the user just said in 1 sentence
2. Give a brief insight or observation (1–2 sentences) that shows you understand their domain
3. Ask ONE focused follow-up question with context explaining why it matters
4. ALWAYS call the \`update_proposal\` tool with updated data

## Quick Replies (REQUIRED every turn)
Always include \`quick_replies\` in your tool call. Rules:
- **style: 'list'** — use for most questions (decisions, preferences, features). Include \`description\` for each option explaining what it means in plain language.
- **style: 'pills'** — use only for simple binary or short-answer choices (yes/no, timeline, simple scale).
- **style: 'icon-cards'** — use sparingly, only for platform/category questions. Include \`icon\` emoji.
- **multiSelect: true** — use when multiple answers are valid (e.g. "which features do you need?")
- **allowCustom: true** — almost always include this unless the options are completely exhaustive
- Provide 3–4 options. The LAST option MUST always be: \`{ label: "Not sure — recommend for me", description: "I'll suggest the best fit based on what we've covered", value: "__recommend__" }\`
- Keep labels ≤5 words, descriptions ≤12 words.

## Handling "__recommend__" responses
When the user selects "Not sure — recommend for me" (value: \`__recommend__\`):
- Respond: "Got it — based on what you've told me, I'd recommend [X] because [plain-language reason]. I'll factor that in."
- Make the recommendation confidently, then move on to the next question.

## Confidence Score Rules
- Start at 5%
- Increase by 5–15% per turn based on how much new information you receive
- Reach 80%+ only when you understand: target users, core workflow, monetization model, and scale
- Decrease if the client contradicts earlier statements

## Module Detection Rules
- Only add modules you're confident about (>70% sure from context)
- Consider dependencies: payments requires auth + database
- Don't add modules just because they sound related — wait for evidence from the conversation

## Product Overview Rules
- \`product_overview\`: Write this in the voice of a product person describing the idea to a non-technical investor. No jargon.
- Turn 1–2: 1 sentence (just the core idea)
- Turn 3–5: 2–3 sentences (add who it's for and the core workflow)
- Turn 6+: 3–4 sentences (add how it makes money or delivers value)
- Update it every turn as your understanding improves

## Brief Rules
- Keep \`updated_brief\` to 2–4 sentences
- Focus on WHAT it does and WHO it serves, not HOW it's built

Remember: you are the expert. Help the client think through their product with curiosity and care.`

export function getSystemPrompt(): string {
  return SYSTEM_PROMPT
}
```

### Step 3: Change initial 3 onboarding questions from `icon-cards` to `list` in `hooks/useIntakeChat.ts`

Read the current file, then replace the `ONBOARDING_QUESTIONS` constant (lines 33–70) with:

```ts
const ONBOARDING_QUESTIONS = [
  {
    content: 'What platform are you building for?',
    quickReplies: {
      style: 'list' as const,
      options: [
        { label: '🌐 Web App', description: 'A browser-based product users visit on any device', value: 'Web App' },
        { label: '📱 Mobile App', description: 'A native iOS or Android app on phones and tablets', value: 'Mobile App' },
        { label: '🖥️ Both', description: 'Needs to work well on web and as a mobile app', value: 'Web + Mobile' },
        { label: '🤔 Not sure yet', description: 'I\'ll help you figure out the right fit', value: 'Platform TBD' },
      ],
    },
  },
  {
    content: 'What type of product is this?',
    quickReplies: {
      style: 'list' as const,
      options: [
        { label: '🛒 Marketplace', description: 'Connects buyers and sellers or service providers', value: 'Marketplace' },
        { label: '💬 Social / Community', description: 'People connect, share, and engage with each other', value: 'Social / Community' },
        { label: '🛠️ SaaS / Tool', description: 'A software tool for businesses or internal teams', value: 'SaaS / Internal Tool' },
        { label: '🎯 Something else', description: 'A different kind of product — I\'ll describe it', value: 'Other' },
      ],
    },
  },
  {
    content: "What's the goal for this product?",
    quickReplies: {
      style: 'list' as const,
      options: [
        { label: '🚀 Launch a startup', description: 'Build a new business around this product', value: 'Launch a startup' },
        { label: '🏢 Grow my business', description: 'Expand or improve an existing business with this', value: 'Grow my existing business' },
        { label: '🛠️ Build for my team', description: 'An internal tool to help my team work better', value: 'Build a tool for my team' },
        { label: '🎯 Something else', description: 'A different goal — I\'ll explain', value: 'Other' },
      ],
    },
  },
]
```

### Step 4: Add `productOverview` state + `UpdateProposalInput.product_overview` to `hooks/useIntakeChat.ts`

In the `UpdateProposalInput` type (around line 16), add:
```ts
  product_overview?: string
```

After `const [isStreaming, setIsStreaming] = useState(false)`, add:
```ts
  const [productOverview, setProductOverview] = useState('')
```

In the `tool_result` handler (inside `streamAIResponse`), after `setPriceRange(...)`, add:
```ts
            if (input?.product_overview && input.product_overview.trim()) {
              setProductOverview(input.product_overview.trim())
            }
```

In the return statement at the bottom, add `productOverview`:
```ts
  return { messages, activeModules, confidenceScore, priceRange, isStreaming, sendMessage, toggleModule, productOverview }
```

### Step 5: Run tests

```bash
export PATH="/usr/local/bin:$PATH" && cd "/Users/nagi/Downloads/Lamba Lab/Lamba Lab app" && npx vitest run 2>&1
```

Expected: all 33 tests pass.

### Step 6: TypeScript check

```bash
export PATH="/usr/local/bin:$PATH" && cd "/Users/nagi/Downloads/Lamba Lab/Lamba Lab app" && npx tsc --noEmit 2>&1
```

Fix any errors. TypeScript may complain about callers of `useIntakeChat` not using `productOverview` yet — that's fine, it's unused for now.

### Step 7: Commit

```bash
cd "/Users/nagi/Downloads/Lamba Lab/Lamba Lab app" && git add lib/ai/tools.ts lib/ai/system-prompt.ts hooks/useIntakeChat.ts && git commit -m "feat: PM-quality system prompt, product_overview field, 3Q style→list"
```

---

## Task 2: Layout restructure + product overview display

**Files:**
- Modify: `components/intake/ChatPanel.tsx`
- Modify: `components/intake/ModulesPanel.tsx`
- Modify: `components/intake/IntakeLayout.tsx`

### Step 1: Read all three current files before making any changes

### Step 2: Replace `components/intake/ChatPanel.tsx`

The ChatPanel becomes pure chat: messages + input only. Remove ConfidenceBar, remove "View Full Proposal" button, remove `pricingVisible` and `priceRange` props.

```tsx
'use client'

import { useRef, useEffect, useState } from 'react'
import { ArrowRight } from 'lucide-react'
import MessageBubble from './MessageBubble'
import type { ChatMessage } from '@/hooks/useIntakeChat'

type Props = {
  messages: ChatMessage[]
  isStreaming: boolean
  onSend: (message: string) => void
}

export default function ChatPanel({ messages, isStreaming, onSend }: Props) {
  const [input, setInput] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  function handleSubmit() {
    const trimmed = input.trim()
    if (!trimmed || isStreaming) return
    onSend(trimmed)
    setInput('')
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  function handleTextareaChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setInput(e.target.value)
    const el = e.target
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.map((msg, i) => (
          <MessageBubble
            key={msg.id}
            message={msg}
            isStreaming={isStreaming && i === messages.length - 1 && msg.role === 'assistant'}
            onQuickReply={onSend}
            isLastMessage={i === messages.length - 1}
          />
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input area */}
      <div className="flex-shrink-0 px-4 pb-4">
        <div className="flex items-end gap-2 bg-white/5 border border-white/10 rounded-xl p-3 focus-within:border-brand-yellow/30 transition-colors">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleTextareaChange}
            onKeyDown={handleKeyDown}
            placeholder="Tell me more..."
            rows={1}
            disabled={isStreaming}
            aria-label="Chat input"
            className="flex-1 bg-transparent text-brand-white placeholder:text-brand-gray-mid resize-none outline-none text-sm leading-relaxed min-h-[20px] max-h-[120px] overflow-y-auto disabled:opacity-50"
          />
          <button
            onClick={handleSubmit}
            disabled={!input.trim() || isStreaming}
            className="w-8 h-8 bg-brand-yellow rounded-lg flex items-center justify-center disabled:opacity-30 hover:bg-brand-yellow/90 transition-all active:scale-95 flex-shrink-0"
            aria-label="Send message"
          >
            <ArrowRight className="w-4 h-4 text-brand-dark" />
          </button>
        </div>
      </div>
    </div>
  )
}
```

### Step 3: Replace `components/intake/ModulesPanel.tsx`

ModulesPanel now shows: product overview → confidence bar → modules → Full Proposal button.

```tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import ModuleCard from './ModuleCard'
import ConfidenceBar from './ConfidenceBar'
import AuthGateModal from './AuthGateModal'
import { MODULE_CATALOG } from '@/lib/modules/catalog'
import type { PriceRange } from '@/lib/pricing/engine'

type Props = {
  activeModules: string[]
  confidenceScore: number
  priceRange: PriceRange
  pricingVisible: boolean
  productOverview: string
  proposalId: string
  onToggle: (id: string) => void
  aiStarted: boolean
}

export default function ModulesPanel({
  activeModules,
  confidenceScore,
  priceRange: _priceRange,
  pricingVisible,
  productOverview,
  proposalId,
  onToggle,
  aiStarted,
}: Props) {
  const router = useRouter()
  const [showAuthGate, setShowAuthGate] = useState(false)

  function handleAuthSuccess() {
    setShowAuthGate(false)
    router.push(`/proposal/${proposalId}?status=pending`)
  }

  return (
    <div className="flex flex-col h-full">
      {/* 1. Product Overview */}
      <div className="px-4 pt-4 pb-3 border-b border-white/5 flex-shrink-0">
        <h2 className="font-bebas text-xs tracking-[0.15em] text-brand-gray-mid mb-2">
          YOUR PRODUCT
        </h2>
        {productOverview ? (
          <p className="text-sm text-brand-white leading-relaxed transition-all duration-500">
            {productOverview}
          </p>
        ) : (
          <p className="text-sm text-brand-gray-mid/50 leading-relaxed italic">
            Your product overview will appear here as we learn more...
          </p>
        )}
      </div>

      {/* 2. Estimate Accuracy */}
      <div className="px-4 py-3 border-b border-white/5 flex-shrink-0">
        <ConfidenceBar score={confidenceScore} />
      </div>

      {/* 3. Technical Modules */}
      <div className="px-4 py-3 border-b border-white/5 flex-shrink-0">
        <h2 className="font-bebas text-2xl text-brand-white tracking-wide">
          TECHNICAL MODULES
        </h2>
        <p className="text-xs text-brand-gray-mid mt-0.5">
          {activeModules.length} selected · Toggle to customize
        </p>
      </div>

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

      {/* 4. Full Proposal CTA — appears after first AI response */}
      {aiStarted && (
        <div className="px-4 pb-4 pt-2 flex-shrink-0 border-t border-white/5">
          <button
            onClick={() => setShowAuthGate(true)}
            className="w-full py-3 bg-brand-yellow text-brand-dark font-medium rounded-xl hover:bg-brand-yellow/90 transition-all active:scale-[0.98] text-sm"
          >
            View Full Proposal →
          </button>
        </div>
      )}

      {showAuthGate && (
        <AuthGateModal
          proposalId={proposalId}
          onClose={() => setShowAuthGate(false)}
          onSuccess={handleAuthSuccess}
        />
      )}
    </div>
  )
}
```

### Step 4: Update `components/intake/IntakeLayout.tsx`

Update to thread `productOverview`, `proposalId`, and `aiStarted` to ModulesPanel, and simplify ChatPanel props:

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
    productOverview,
  } = useIntakeChat({ proposalId, idea: initialMessage })

  useEffect(() => {
    onStateChange?.(activeModules.length, confidenceScore)
  }, [activeModules.length, confidenceScore, onStateChange])

  const pricingVisible = isPricingVisible(confidenceScore)

  // aiStarted = true once the AI has responded at least once (confidence > 0)
  const aiStarted = confidenceScore > 0

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
            onSend={sendMessage}
          />
        </div>
        <div className="w-[45%] overflow-hidden">
          <ModulesPanel
            activeModules={activeModules}
            confidenceScore={confidenceScore}
            priceRange={priceRange}
            pricingVisible={pricingVisible}
            productOverview={productOverview}
            proposalId={proposalId}
            onToggle={toggleModule}
            aiStarted={aiStarted}
          />
        </div>
      </div>

      {/* Mobile: full chat + bottom drawer */}
      <div className="md:hidden flex-1 overflow-hidden flex flex-col">
        <div className="flex-1 overflow-hidden">
          <ChatPanel
            messages={messages}
            isStreaming={isStreaming}
            onSend={sendMessage}
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

### Step 5: Check if MobileBottomDrawer needs updating

Read `components/intake/MobileBottomDrawer.tsx`. If it references `AuthGateModal` or the Full Proposal button, remove those references. If it has props that no longer exist, fix them.

### Step 6: Run TypeScript check

```bash
export PATH="/usr/local/bin:$PATH" && cd "/Users/nagi/Downloads/Lamba Lab/Lamba Lab app" && npx tsc --noEmit 2>&1
```

Fix any errors (likely: MobileBottomDrawer prop mismatches).

### Step 7: Run all tests

```bash
export PATH="/usr/local/bin:$PATH" && cd "/Users/nagi/Downloads/Lamba Lab/Lamba Lab app" && npx vitest run 2>&1
```

### Step 8: Commit

```bash
cd "/Users/nagi/Downloads/Lamba Lab/Lamba Lab app" && git add components/intake/ChatPanel.tsx components/intake/ModulesPanel.tsx components/intake/IntakeLayout.tsx && git commit -m "feat: layout restructure — pure chat left, product intelligence right panel"
```

If MobileBottomDrawer was changed, include it in the commit.

---

## Task 3: Auth — magic link fix

**Files:**
- Modify: `app/api/auth/send-otp/route.ts`
- Create: `app/auth/callback/route.ts`
- Modify: `components/intake/AuthGateModal.tsx`

### Context

Root cause: `supabase.auth.signInWithOtp()` sends a magic link (click-to-confirm email) but the app was waiting for a 6-digit code. The fix: embrace the magic link flow fully. The callback route handles the redirect, links the proposal to the user, and redirects to the proposal page.

### Step 1: Update `app/api/auth/send-otp/route.ts`

Add `sessionId` to the request body. Set `emailRedirectTo` so the magic link includes the proposal and session context:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const { email, proposalId, sessionId } = await req.json()
  if (!email || !proposalId || !sessionId) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }

  const supabase = await createServerSupabaseClient()

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? `https://${req.headers.get('host')}`
  const emailRedirectTo = `${appUrl}/auth/callback?proposalId=${proposalId}&sessionId=${sessionId}`

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: true,
      data: { proposal_id: proposalId },
      emailRedirectTo,
    },
  })

  if (error) {
    console.error('Magic link send error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
```

**Also add `NEXT_PUBLIC_APP_URL` to `.env.local`** (if not already there):
```
NEXT_PUBLIC_APP_URL=https://your-vercel-app.vercel.app
```
For local dev it should be `http://localhost:3000`. The user must set this in Vercel env vars too.

### Step 2: Create `app/auth/callback/route.ts`

Create directory `app/auth/callback/` and file `route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, createServiceClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const proposalId = requestUrl.searchParams.get('proposalId')
  const sessionId = requestUrl.searchParams.get('sessionId')

  if (!code || !proposalId || !sessionId) {
    console.error('Auth callback: missing params', { code: !!code, proposalId, sessionId })
    return NextResponse.redirect(new URL('/?error=auth_failed', requestUrl.origin))
  }

  const supabase = await createServerSupabaseClient()

  // Exchange the PKCE code for a session
  const { data, error } = await supabase.auth.exchangeCodeForSession(code)

  if (error || !data.user) {
    console.error('Auth callback: exchange failed', error)
    return NextResponse.redirect(new URL('/?error=auth_failed', requestUrl.origin))
  }

  // Validate proposal belongs to this session and link to user
  const serviceClient = await createServiceClient()

  const { data: proposal } = await serviceClient
    .from('proposals')
    .select('id, session_id')
    .eq('id', proposalId)
    .eq('session_id', sessionId)
    .single()

  if (!proposal) {
    console.error('Auth callback: proposal not found or session mismatch')
    return NextResponse.redirect(new URL('/?error=proposal_not_found', requestUrl.origin))
  }

  const { error: updateError } = await serviceClient
    .from('proposals')
    .update({ user_id: data.user.id, status: 'pending_review' })
    .eq('id', proposalId)
    .eq('session_id', sessionId)

  if (updateError) {
    console.error('Auth callback: proposal update failed', updateError)
    return NextResponse.redirect(new URL('/?error=update_failed', requestUrl.origin))
  }

  return NextResponse.redirect(new URL(`/proposal/${proposalId}?status=pending`, requestUrl.origin))
}
```

### Step 3: Replace `components/intake/AuthGateModal.tsx`

Remove OTP state entirely. Replace `'otp'` step with `'sent'` (show "check your inbox" message):

```tsx
'use client'

import { useState } from 'react'
import { X, Mail, ArrowRight, Loader2, CheckCircle } from 'lucide-react'
import { getStoredSession } from '@/lib/session'

type Step = 'email' | 'loading' | 'sent'

type Props = {
  proposalId: string
  onClose: () => void
  onSuccess: () => void
}

export default function AuthGateModal({ proposalId, onClose, onSuccess: _onSuccess }: Props) {
  const [step, setStep] = useState<Step>('email')
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')

  async function handleSendLink(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) return
    setStep('loading')
    setError('')

    const session = getStoredSession()

    const res = await fetch('/api/auth/send-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: email.trim(),
        proposalId,
        sessionId: session?.sessionId ?? '',
      }),
    })

    if (res.ok) {
      setStep('sent')
    } else {
      setStep('email')
      setError('Failed to send link. Please try again.')
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className="relative bg-[#1d1d1d] border border-white/10 rounded-2xl p-6 w-full max-w-sm shadow-2xl">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-brand-gray-mid hover:text-brand-white transition-colors"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        {step === 'sent' ? (
          <div className="text-center space-y-4 py-2">
            <div className="w-12 h-12 bg-brand-yellow/10 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle className="w-6 h-6 text-brand-yellow" />
            </div>
            <div>
              <h2 className="font-bold text-brand-white text-lg">Check your inbox</h2>
              <p className="text-brand-gray-mid text-sm mt-1">
                We sent a magic link to <span className="text-brand-white">{email}</span>.
                Click it to view your full proposal.
              </p>
            </div>
            <p className="text-brand-gray-mid/60 text-xs">
              Didn't receive it?{' '}
              <button
                onClick={() => setStep('email')}
                className="text-brand-yellow hover:underline"
              >
                Try again
              </button>
            </p>
          </div>
        ) : (
          <>
            <div className="mb-6">
              <div className="w-10 h-10 bg-brand-yellow/10 rounded-xl flex items-center justify-center mb-4">
                <Mail className="w-5 h-5 text-brand-yellow" />
              </div>
              <h2 className="font-bold text-brand-white text-lg">View your proposal</h2>
              <p className="text-brand-gray-mid text-sm mt-1">
                Enter your email and we'll send you a link to access the full proposal.
              </p>
            </div>

            {error && <p className="text-red-400 text-sm mb-4">{error}</p>}

            <form onSubmit={handleSendLink} className="space-y-4">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                autoFocus
                disabled={step === 'loading'}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-brand-white placeholder:text-brand-gray-mid outline-none focus:border-brand-yellow/50 transition-colors text-sm disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={step === 'loading' || !email.trim()}
                className="w-full py-3 bg-brand-yellow text-brand-dark font-medium rounded-xl hover:bg-brand-yellow/90 transition-all disabled:opacity-50 flex items-center justify-center gap-2 text-sm"
              >
                {step === 'loading' ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>Send magic link <ArrowRight className="w-4 h-4" /></>
                )}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
```

### Step 4: Run TypeScript check

```bash
export PATH="/usr/local/bin:$PATH" && cd "/Users/nagi/Downloads/Lamba Lab/Lamba Lab app" && npx tsc --noEmit 2>&1
```

### Step 5: Run all tests

```bash
export PATH="/usr/local/bin:$PATH" && cd "/Users/nagi/Downloads/Lamba Lab/Lamba Lab app" && npx vitest run 2>&1
```

### Step 6: Commit

```bash
cd "/Users/nagi/Downloads/Lamba Lab/Lamba Lab app" && git add app/api/auth/send-otp/route.ts app/auth/callback/route.ts components/intake/AuthGateModal.tsx && git commit -m "fix: switch from OTP code to magic link auth — add callback route, update modal UI"
```

---

## Task 4: Edit messages + Reset button

**Files:**
- Modify: `hooks/useIntakeChat.ts`
- Modify: `components/intake/MessageBubble.tsx`
- Modify: `components/intake/IntakeLayout.tsx`
- Modify: `components/intake/IntakeOverlay.tsx`

### Context

Users can edit any sent message:
- **During onboarding** (messages before the AI starts): clicking edit resets the onboarding to that step and clears subsequent messages + answers
- **Post-onboarding**: clicking edit appends a correction message to the conversation and calls the AI again

Reset button in the top bar clears all state and creates a fresh session.

### Step 1: Add `editMessage` and `reset` to `hooks/useIntakeChat.ts`

Read the current file, then:

**Add `onboardingStep` and `onboardingAnswers` to the return value** (they're needed by the layout to determine if a message is editable as an onboarding message):

In the return statement, change to:
```ts
  return { messages, activeModules, confidenceScore, priceRange, isStreaming, sendMessage, toggleModule, productOverview, onboardingStep, editMessage, reset }
```

**Add the `editMessage` function** (before the `return` statement):

```ts
  // editMessage — re-opens a previous user message for editing.
  // During onboarding (step < 3): resets to that onboarding step.
  // After onboarding: injects a correction and calls the AI.
  const editMessage = useCallback(async (messageId: string, newContent: string) => {
    if (isStreaming) return

    const msgIndex = messagesRef.current.findIndex((m) => m.id === messageId)
    if (msgIndex === -1) return

    // Determine which onboarding index this message corresponds to
    // Onboarding user messages are at positions 1, 3, 5 (after each Q)
    const onboardingUserMessages = messagesRef.current
      .slice(0, onboardingStep * 2 + 1) // rough slice during onboarding
      .filter((m) => m.role === 'user' && !m.id.startsWith('onboarding-'))

    const onboardingUserIndex = onboardingUserMessages.findIndex((m) => m.id === messageId)

    if (onboardingUserIndex !== -1 && onboardingStep >= onboardingUserIndex + 1) {
      // This is an onboarding message — reset to that step
      const stepIndex = onboardingUserIndex // 0 = answer to Q1, etc.

      // Clear messages from the user message onward, re-inject the question
      const keptMessages = messagesRef.current.slice(0, msgIndex) // everything before this user msg
      const nextQ = ONBOARDING_QUESTIONS[stepIndex]
      const newMessages: ChatMessage[] = [
        ...keptMessages,
        {
          id: `onboarding-${stepIndex}`,
          role: 'assistant' as const,
          content: nextQ.content,
          quickReplies: nextQ.quickReplies,
        },
      ]
      setMessages(newMessages)
      setOnboardingStep(stepIndex)
      setOnboardingAnswers((prev) => prev.slice(0, stepIndex))
      return
    }

    // Post-onboarding: inject correction and call AI
    const correctionMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: `Actually, let me clarify my earlier answer: ${newContent}`,
    }

    // Keep messages up to (but not including) the edited message, then add correction
    const kept = messagesRef.current.slice(0, msgIndex)
    setMessages([...kept, correctionMsg])

    const aiHistory = [...kept, correctionMsg]
      .filter((m) => !m.id.startsWith('onboarding-'))
      .map((m): ApiMessage => ({ role: m.role, content: m.content }))

    await streamAIResponse(aiHistory)
  }, [onboardingStep, isStreaming]) // eslint-disable-line react-hooks/exhaustive-deps
```

**Add the `reset` function** (before the `return` statement):

```ts
  const reset = useCallback(() => {
    setMessages([
      {
        id: 'onboarding-0',
        role: 'assistant',
        content: ONBOARDING_QUESTIONS[0].content,
        quickReplies: ONBOARDING_QUESTIONS[0].quickReplies,
      },
    ])
    setOnboardingStep(0)
    setOnboardingAnswers([])
    setActiveModules([])
    setConfidenceScore(0)
    setComplexityMultiplier(1.0)
    setPriceRange({ min: 0, max: 0 })
    setIsStreaming(false)
    setProductOverview('')
  }, [])
```

**Add `ApiMessage` type to local scope** (it's already defined in the file — no change needed).

### Step 2: Update `components/intake/MessageBubble.tsx`

Add hover edit icon for user messages. Add inline edit UI when editing:

```tsx
'use client'

import { useState } from 'react'
import { Pencil, Check, X } from 'lucide-react'
import type { ChatMessage } from '@/hooks/useIntakeChat'
import QuickReplies from './QuickReplies'

type Props = {
  message: ChatMessage
  isStreaming?: boolean
  onQuickReply?: (value: string) => void
  isLastMessage?: boolean
  onEdit?: (messageId: string, newContent: string) => void
}

export default function MessageBubble({ message, isStreaming, onQuickReply, isLastMessage, onEdit }: Props) {
  const isUser = message.role === 'user'
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState(message.content)

  function handleEditSave() {
    if (!editValue.trim() || !onEdit) return
    onEdit(message.id, editValue.trim())
    setIsEditing(false)
  }

  function handleEditCancel() {
    setEditValue(message.content)
    setIsEditing(false)
  }

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className="max-w-[85%] space-y-3">
        <div className={`relative group ${isUser ? '' : ''}`}>
          {isEditing ? (
            <div className="space-y-2">
              <textarea
                autoFocus
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleEditSave() }
                  if (e.key === 'Escape') handleEditCancel()
                }}
                className="w-full px-4 py-3 rounded-2xl text-sm leading-relaxed bg-brand-yellow/20 text-brand-white border border-brand-yellow/40 outline-none resize-none min-h-[60px]"
              />
              <div className="flex gap-2 justify-end">
                <button
                  onClick={handleEditCancel}
                  className="flex items-center gap-1 text-xs text-brand-gray-mid hover:text-brand-white transition-colors px-2 py-1 rounded-lg hover:bg-white/5"
                >
                  <X className="w-3 h-3" /> Cancel
                </button>
                <button
                  onClick={handleEditSave}
                  disabled={!editValue.trim()}
                  className="flex items-center gap-1 text-xs text-brand-dark bg-brand-yellow hover:bg-brand-yellow/90 transition-colors px-2 py-1 rounded-lg disabled:opacity-40"
                >
                  <Check className="w-3 h-3" /> Save
                </button>
              </div>
            </div>
          ) : (
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
          )}

          {/* Edit button — only for user messages, only when onEdit is provided, not while editing */}
          {isUser && onEdit && !isEditing && (
            <button
              onClick={() => { setEditValue(message.content); setIsEditing(true) }}
              className="absolute -top-2 -left-8 opacity-0 group-hover:opacity-100 transition-opacity w-6 h-6 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center"
              aria-label="Edit message"
            >
              <Pencil className="w-3 h-3 text-brand-gray-mid" />
            </button>
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

### Step 3: Update `components/intake/IntakeLayout.tsx` — wire edit callback

Read current file. In the hook destructuring, add `editMessage` and `reset`:
```ts
  const { messages, ..., editMessage, reset } = useIntakeChat(...)
```

Pass `onEdit` to `ChatPanel`:
```tsx
<ChatPanel
  messages={messages}
  isStreaming={isStreaming}
  onSend={sendMessage}
  onEdit={editMessage}
/>
```

Pass `onReset` prop down too (used by IntakeOverlay). Add `onReset?: () => void` to IntakeLayout's Props type. Wire up: pass `onReset` to the reset function somehow.

Actually, simpler: expose `reset` from the hook return, and have `IntakeLayout` expose it up to `IntakeOverlay` via a callback. Add to `IntakeLayout` Props:
```ts
type Props = {
  proposalId: string
  initialMessage: string
  onStateChange?: (moduleCount: number, confidenceScore: number) => void
  onResetRef?: React.MutableRefObject<(() => void) | null>
}
```

In `IntakeLayout`, set the ref after getting `reset` from the hook:
```ts
useEffect(() => {
  if (onResetRef) onResetRef.current = reset
}, [reset, onResetRef])
```

### Step 4: Update `components/intake/ChatPanel.tsx` — add `onEdit` prop

Read current file. Add `onEdit?: (messageId: string, newContent: string) => void` to Props and pass it to `MessageBubble`:
```tsx
<MessageBubble
  key={msg.id}
  message={msg}
  isStreaming={isStreaming && i === messages.length - 1 && msg.role === 'assistant'}
  onQuickReply={onSend}
  isLastMessage={i === messages.length - 1}
  onEdit={onEdit}
/>
```

### Step 5: Add Reset button to `components/intake/IntakeOverlay.tsx`

Read current file. Add reset confirm state and a ref for the reset function:

```tsx
  const [resetConfirm, setResetConfirm] = useState(false)
  const resetRef = useRef<(() => void) | null>(null)

  function handleResetClick() {
    if (!resetConfirm) {
      setResetConfirm(true)
      setTimeout(() => setResetConfirm(false), 3000) // auto-dismiss after 3s
      return
    }
    // Confirmed: call reset + create new session
    resetRef.current?.()
    setResetConfirm(false)
    // Also clear stored session and re-fetch
    sessionStorage.removeItem('lamba_session')
    setSession(null)
    getOrCreateSession().then(setSession).catch(() => setSessionError(true))
  }
```

In the top bar (inside the `{session && ...}` div), add the reset button between the wordmark and minimize:

```tsx
<div className="flex items-center justify-between px-4 py-3 border-b border-white/5 flex-shrink-0">
  <span className="font-bebas text-xl tracking-widest text-brand-white">LAMBA LAB</span>
  <div className="flex items-center gap-2">
    {resetConfirm ? (
      <div className="flex items-center gap-2">
        <span className="text-xs text-brand-gray-mid">Start over?</span>
        <button
          onClick={handleResetClick}
          className="text-xs text-red-400 hover:text-red-300 transition-colors px-2 py-1 rounded-lg hover:bg-white/5"
        >
          Yes
        </button>
        <button
          onClick={() => setResetConfirm(false)}
          className="text-xs text-brand-gray-mid hover:text-brand-white transition-colors px-2 py-1 rounded-lg hover:bg-white/5"
        >
          No
        </button>
      </div>
    ) : (
      <button
        onClick={handleResetClick}
        className="text-xs text-brand-gray-mid hover:text-brand-white transition-colors px-2 py-1 rounded-lg hover:bg-white/5"
        aria-label="Reset conversation"
      >
        ↺ Reset
      </button>
    )}
    <button
      onClick={() => setMinimized(true)}
      className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-brand-gray-mid hover:text-brand-white transition-colors"
      aria-label="Minimize"
    >
      <Minus className="w-4 h-4" />
    </button>
  </div>
</div>
```

Pass the `resetRef` to `IntakeLayout`:
```tsx
<IntakeLayout
  proposalId={session.proposalId}
  initialMessage={initialMessage}
  onStateChange={handleStateChange}
  onResetRef={resetRef}
/>
```

### Step 6: Run TypeScript check

```bash
export PATH="/usr/local/bin:$PATH" && cd "/Users/nagi/Downloads/Lamba Lab/Lamba Lab app" && npx tsc --noEmit 2>&1
```

Fix any type errors.

### Step 7: Run all tests

```bash
export PATH="/usr/local/bin:$PATH" && cd "/Users/nagi/Downloads/Lamba Lab/Lamba Lab app" && npx vitest run 2>&1
```

### Step 8: Commit

```bash
cd "/Users/nagi/Downloads/Lamba Lab/Lamba Lab app" && git add hooks/useIntakeChat.ts components/intake/MessageBubble.tsx components/intake/ChatPanel.tsx components/intake/IntakeLayout.tsx components/intake/IntakeOverlay.tsx && git commit -m "feat: inline message edit, reset button, edit/reset functions in useIntakeChat"
```

---

## Task 5: Dark/Light mode

**Files:**
- Modify: `tailwind.config.ts`
- Modify: `app/globals.css`
- Create: `hooks/useTheme.ts`
- Modify: `components/intake/IntakeOverlay.tsx`
- Modify: `components/intake/ChatPanel.tsx`
- Modify: `components/intake/ModulesPanel.tsx`
- Modify: `components/intake/MessageBubble.tsx`
- Modify: `components/intake/AuthGateModal.tsx`
- Modify: `components/intake/ConfidenceBar.tsx`
- Modify: `components/intake/ModuleCard.tsx`
- Modify: `components/intake/QuickReplies.tsx`
- Modify: `components/intake/MinimizedBar.tsx`

### Step 1: Enable `darkMode: 'class'` in `tailwind.config.ts`

```ts
import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: 'class',
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
}

export default config
```

### Step 2: Add theme CSS variables to `app/globals.css`

Append at the end of the file:

```css
/* Intake overlay light/dark theming */
/* Default (no class) = dark mode, because IntakeOverlay defaults to dark */
/* .intake-light on the overlay wrapper switches to light mode */
.intake-light {
  --ov-bg: #F5F4F0;
  --ov-surface: #FFFFFF;
  --ov-surface-subtle: rgba(0, 0, 0, 0.04);
  --ov-border: rgba(0, 0, 0, 0.08);
  --ov-text: #1A1A1A;
  --ov-text-muted: #6B7280;
  --ov-input-bg: rgba(0, 0, 0, 0.05);
  --ov-bubble-ai-bg: #FFFFFF;
  --ov-bubble-ai-border: rgba(0, 0, 0, 0.08);
  --ov-track: rgba(0, 0, 0, 0.1);
}
```

Note: dark mode doesn't need CSS variables because all existing classes use hardcoded dark values. Light mode uses `.intake-light` class on the overlay wrapper to override via CSS variables.

**Update `body` and `:root` to NOT force dark background** — the landing page can stay dark (it's a separate concern from the overlay). No change needed there.

### Step 3: Create `hooks/useTheme.ts`

```ts
import { useEffect, useState } from 'react'

type Theme = 'dark' | 'light'
const STORAGE_KEY = 'lamba-theme'

export function useTheme(): { theme: Theme; toggleTheme: () => void } {
  const [theme, setTheme] = useState<Theme>('dark')

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as Theme | null
    if (stored === 'light' || stored === 'dark') {
      setTheme(stored)
    }
  }, [])

  function toggleTheme() {
    const next: Theme = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    localStorage.setItem(STORAGE_KEY, next)
  }

  return { theme, toggleTheme }
}
```

### Step 4: Update `components/intake/IntakeOverlay.tsx` — apply theme

Read the current file. Add:
1. Import `useTheme` from `@/hooks/useTheme`
2. Import `Sun` and `Moon` from `lucide-react`
3. Call `const { theme, toggleTheme } = useTheme()` near the top of the component
4. Apply theme class to ALL wrapper divs that need theming (the full overlay div, the loading divs, the error divs). Change every `bg-brand-dark` to use the theme class.

The full overlay div currently reads:
```
className={`fixed inset-0 z-50 bg-brand-dark flex flex-col ...`}
```

Change it to:
```
className={`fixed inset-0 z-50 flex flex-col transition-opacity duration-300 ${theme === 'light' ? 'bg-[#F5F4F0] intake-light' : 'bg-brand-dark'} ${mounted ? 'opacity-100' : 'opacity-0'} ${minimized ? 'hidden' : ''}`}
```

Apply the same theme-aware background to the loading spinner div and error div.

In the top bar, add the theme toggle button between the Reset button and the Minus button:
```tsx
<button
  onClick={toggleTheme}
  className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-brand-gray-mid hover:text-brand-white transition-colors"
  aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
>
  {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
</button>
```

Also update the top bar's border class to be theme-aware:
- `border-b border-white/5` → `border-b ${theme === 'light' ? 'border-black/8' : 'border-white/5'}`

### Step 5: Update `components/intake/ChatPanel.tsx` — light mode classes

Read the current file. Replace classes using CSS variables (which are defined when `.intake-light` is on the parent):

The input area div:
```
bg-white/5 border border-white/10
```
→
```
bg-[var(--ov-input-bg,rgba(255,255,255,0.05))] border border-[var(--ov-border,rgba(255,255,255,0.10))]
```

The textarea text:
```
text-brand-white placeholder:text-brand-gray-mid
```
→
```
text-[var(--ov-text,#ffffff)] placeholder:text-[var(--ov-text-muted,#727272)]
```

The border focus class:
```
focus-within:border-brand-yellow/30
```
→ stays the same (yellow works in both modes)

### Step 6: Update `components/intake/MessageBubble.tsx` — light mode classes

AI bubble:
```
bg-white/5 text-brand-white
```
→
```
bg-[var(--ov-bubble-ai-bg,rgba(255,255,255,0.05))] text-[var(--ov-text,#ffffff)] border border-[var(--ov-bubble-ai-border,transparent)]
```

Edit textarea:
```
bg-brand-yellow/20 text-brand-white border border-brand-yellow/40
```
→ stays similar, text needs to be theme-aware:
```
bg-brand-yellow/20 text-[var(--ov-text,#ffffff)] border border-brand-yellow/40
```

### Step 7: Update `components/intake/ModulesPanel.tsx` — light mode classes

Header section:
- `border-b border-white/5` → `border-b border-[var(--ov-border,rgba(255,255,255,0.05))]`
- `text-brand-white` → `text-[var(--ov-text,#ffffff)]`
- `text-brand-gray-mid` → `text-[var(--ov-text-muted,#727272)]`

Overview paragraph empty state:
- `text-brand-gray-mid/50` → adjust to CSS var

### Step 8: Update `components/intake/ConfidenceBar.tsx` — light mode classes

The progress track:
```
bg-white/10
```
→
```
bg-[var(--ov-track,rgba(255,255,255,0.10))]
```

Text colors:
- `text-brand-gray-mid` → `text-[var(--ov-text-muted,#727272)]`
- `text-brand-white` → `text-[var(--ov-text,#ffffff)]`

### Step 9: Update `components/intake/ModuleCard.tsx` — light mode classes

Module card surfaces:
- `bg-white/2 border-white/5` (inactive) → `bg-[var(--ov-surface-subtle,rgba(255,255,255,0.02))] border-[var(--ov-border,rgba(255,255,255,0.05))]`
- `bg-white/5` (icon bg) → `bg-[var(--ov-surface-subtle,rgba(255,255,255,0.05))]`
- `text-brand-white` → `text-[var(--ov-text,#ffffff)]`
- `text-brand-gray-mid` → `text-[var(--ov-text-muted,#727272)]`

### Step 10: Update `components/intake/QuickReplies.tsx` — light mode classes

All card/button surfaces:
- `border-white/10 bg-white/5` → `border-[var(--ov-border,rgba(255,255,255,0.10))] bg-[var(--ov-surface-subtle,rgba(255,255,255,0.05))]`
- `hover:bg-white/10` → `hover:bg-[var(--ov-input-bg,rgba(255,255,255,0.10))]`
- `text-brand-white` → `text-[var(--ov-text,#ffffff)]`
- `text-brand-gray-mid` → `text-[var(--ov-text-muted,#727272)]`
- Input backgrounds in custom inputs: same treatment

### Step 11: Update `components/intake/AuthGateModal.tsx` — light mode classes

The modal card `bg-[#1d1d1d]` → `bg-[var(--ov-surface,#1d1d1d)]`
Text and borders use the same CSS var pattern.

Note: The modal overlay `bg-black/70` should stay dark in both modes (it's a scrim/dimmer).

### Step 12: Update `components/intake/MinimizedBar.tsx`

Read the file and apply the same CSS variable pattern for backgrounds, borders, and text.

### Step 13: Run TypeScript check

```bash
export PATH="/usr/local/bin:$PATH" && cd "/Users/nagi/Downloads/Lamba Lab/Lamba Lab app" && npx tsc --noEmit 2>&1
```

### Step 14: Run all tests

```bash
export PATH="/usr/local/bin:$PATH" && cd "/Users/nagi/Downloads/Lamba Lab/Lamba Lab app" && npx vitest run 2>&1
```

### Step 15: Commit

```bash
cd "/Users/nagi/Downloads/Lamba Lab/Lamba Lab app" && git add tailwind.config.ts app/globals.css hooks/useTheme.ts components/intake/ && git commit -m "feat: dark/light mode toggle — warm off-white light mode, brand identity preserved"
```

---

## Task 6: Final verification + push

### Step 1: Full test suite

```bash
export PATH="/usr/local/bin:$PATH" && cd "/Users/nagi/Downloads/Lamba Lab/Lamba Lab app" && npx vitest run 2>&1
```

Expected: all tests pass.

### Step 2: TypeScript check

```bash
export PATH="/usr/local/bin:$PATH" && cd "/Users/nagi/Downloads/Lamba Lab/Lamba Lab app" && npx tsc --noEmit 2>&1
```

Expected: zero errors.

### Step 3: Git log

```bash
cd "/Users/nagi/Downloads/Lamba Lab/Lamba Lab app" && git log --oneline -10
```

Expected (newest first):
- feat: dark/light mode toggle
- feat: inline message edit, reset button
- fix: switch to magic link auth
- feat: layout restructure — pure chat left, product intelligence right
- feat: PM-quality system prompt, product_overview field, 3Q style→list

### Step 4: Push

```bash
cd "/Users/nagi/Downloads/Lamba Lab/Lamba Lab app" && git push origin main 2>&1
```

---

## Manual Test Checklist (browser)

After deploy to Vercel, test:
- [ ] Chat opens with Q1 as a `list`-style option card (not icon-cards)
- [ ] Right panel shows "YOUR PRODUCT" placeholder initially
- [ ] After 3 onboarding answers + AI response, product overview paragraph appears in right panel
- [ ] ConfidenceBar is in the right panel (not left)
- [ ] Left panel is pure chat — no confidence bar, no Full Proposal button
- [ ] Full Proposal button appears in right panel after first AI response
- [ ] Clicking Full Proposal → modal asks for email → shows "Check your inbox" (no OTP code input)
- [ ] Clicking the magic link in email → redirects to `/proposal/[id]?status=pending`
- [ ] Reset button → two-step confirm → clears chat back to Q1
- [ ] Hovering a user message → pencil edit icon appears
- [ ] Editing an onboarding answer → question re-appears with options
- [ ] Editing a post-AI message → appends correction → AI responds
- [ ] ☀️ toggle switches to light mode (warm off-white background)
- [ ] 🌙 toggle switches back to dark mode
- [ ] Theme preference persists across minimize/expand

## Important: Set `NEXT_PUBLIC_APP_URL` in Vercel

Add this environment variable in Vercel dashboard:
```
NEXT_PUBLIC_APP_URL=https://your-vercel-app.vercel.app
```
Without this, the magic link will redirect to `undefined/auth/callback` and fail.

Also in Supabase Dashboard → Authentication → URL Configuration, add your app URL to the "Allowed Redirect URLs":
```
https://your-vercel-app.vercel.app/auth/callback
http://localhost:3000/auth/callback
```
