# Proposal Panel Polish Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Three UI enhancements — AI-generated module card summaries with accordion expansion, a single-word rotating typing indicator, and a Lamba Lab avatar on AI chat bubbles.

**Architecture:** AI tool schema gains `module_summaries`, state threads from hook → IntakeLayout → ModulesPanel → ModuleCard. `TypingIndicator` is a new standalone component swapped into `MessageBubble`. Avatar is a static asset rendered in `MessageBubble` for AI messages only.

**Tech Stack:** Next.js App Router, React, Tailwind CSS v4, Anthropic SDK, Lucide icons

---

## Task 1: Save the Lamba Lab avatar image

**Files:**
- Create: `public/lamba-icon.png`

**Step 1: Copy the image**

The user attached the Lamba Lab logo (yellow lightbulb with ~ symbol) in the conversation. Save it to the project:

```bash
# The image is accessible as a conversation attachment.
# Use the Read tool to locate the temp file, then copy it:
cp <temp-image-path> public/lamba-icon.png
```

If the temp path is unavailable, ask the user to drag the image into `public/lamba-icon.png` manually.

**Step 2: Verify**

```bash
ls -la public/lamba-icon.png
# Expected: file exists, non-zero size
```

**Step 3: Commit**

```bash
git add public/lamba-icon.png
git commit -m "feat: add Lamba Lab icon asset for chat avatar"
```

---

## Task 2: Add `module_summaries` to the AI tool schema

**Files:**
- Modify: `lib/ai/tools.ts`

**Step 1: Add the new property**

In `lib/ai/tools.ts`, inside `UPDATE_PROPOSAL_TOOL.input_schema.properties`, add after the `quick_replies` block:

```typescript
module_summaries: {
  type: 'object' as const,
  description:
    'Optional. For each currently active module ID, a 1–2 sentence project-specific note describing what was decided and what the module will contain for this specific product. Keys are module IDs (e.g. "auth", "payments"). Values are plain sentences, no markdown. Update these incrementally — include all active modules, not just newly added ones.',
  additionalProperties: { type: 'string' as const },
},
```

**Step 2: Verify TypeScript compiles**

```bash
cd "/Users/nagi/Downloads/Lamba Lab/Lamba Lab app" && npx tsc --noEmit 2>&1 | head -20
# Expected: no errors (or only pre-existing errors unrelated to this change)
```

**Step 3: Commit**

```bash
git add lib/ai/tools.ts
git commit -m "feat: add module_summaries field to update_proposal tool schema"
```

---

## Task 3: Update the system prompt to instruct the AI to write module summaries

**Files:**
- Modify: `lib/ai/system-prompt.ts`

**Step 1: Add module_summaries instruction**

Find the section in `SYSTEM_PROMPT` that describes the `update_proposal` tool or the module detection instructions. Add this paragraph near the end of the prompt (before the closing backtick):

```
## module_summaries — Required When Modules Are Active
For every module in detected_modules, include a module_summaries entry. Write 1–2 plain sentences specific to THIS product. Say what was decided and what the module will actually contain. Example for payments on a freelancer marketplace: "Handles Stripe Connect payouts to freelancers and per-project invoicing for clients. Includes escrow hold logic based on the milestone model you described." Never restate the generic module description — make it product-specific. Update all entries every turn, not just newly added modules.
```

**Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | head -20
```

**Step 3: Commit**

```bash
git add lib/ai/system-prompt.ts
git commit -m "feat: instruct AI to write per-module project-specific summaries"
```

---

## Task 4: Add `moduleSummaries` state to `useIntakeChat`

**Files:**
- Modify: `hooks/useIntakeChat.ts`

**Step 1: Add to `UpdateProposalInput` type (around line 19)**

```typescript
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
  module_summaries?: { [moduleId: string]: string }  // ← add this
}
```

**Step 2: Add state (after the `productOverview` useState line)**

```typescript
const [moduleSummaries, setModuleSummaries] = useState<{ [moduleId: string]: string }>({})
```

**Step 3: Merge summaries on tool call**

Find the tool call handler block (around line 155) where `input.detected_modules` is processed. After the existing state updates, add:

```typescript
if (input?.module_summaries && typeof input.module_summaries === 'object') {
  setModuleSummaries(prev => ({ ...prev, ...input.module_summaries }))
}
```

**Step 4: Add to reset function**

Find the `reset` callback. After `setProductOverview('')`, add:

```typescript
setModuleSummaries({})
```

**Step 5: Add to return object (line 286)**

```typescript
return { messages, activeModules, confidenceScore, priceRange, isStreaming, sendMessage, toggleModule, productOverview, editMessage, reset, moduleSummaries }
```

**Step 6: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | head -20
```

**Step 7: Commit**

```bash
git add hooks/useIntakeChat.ts
git commit -m "feat: add moduleSummaries state to useIntakeChat hook"
```

---

## Task 5: Thread `moduleSummaries` through `IntakeLayout`

**Files:**
- Modify: `components/intake/IntakeLayout.tsx`

**Step 1: Destructure from hook**

Find the line that destructures from `useIntakeChat` (around line 23). Add `moduleSummaries`:

```typescript
const {
  messages,
  activeModules,
  confidenceScore,
  priceRange,
  isStreaming,
  sendMessage,
  toggleModule,
  productOverview,
  editMessage,
  reset,
  moduleSummaries,   // ← add
} = useIntakeChat({ proposalId, initialMessage })
```

**Step 2: Pass to both `ModulesPanel` instances**

There are two `ModulesPanel` renders (mobile + desktop). Add `moduleSummaries={moduleSummaries}` to both:

```tsx
<ModulesPanel
  activeModules={activeModules}
  confidenceScore={confidenceScore}
  pricingVisible={pricingVisible}
  productOverview={productOverview}
  proposalId={proposalId}
  onToggle={toggleModule}
  aiStarted={aiStarted}
  theme={theme}
  moduleSummaries={moduleSummaries}   // ← add
/>
```

**Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | head -20
# Expected: ModulesPanel will temporarily error until Task 6 — that's fine at this step
```

**Step 4: Commit**

```bash
git add components/intake/IntakeLayout.tsx
git commit -m "feat: thread moduleSummaries from hook through IntakeLayout"
```

---

## Task 6: Update `ModulesPanel` to accept and forward `moduleSummaries`

**Files:**
- Modify: `components/intake/ModulesPanel.tsx`

**Step 1: Add to Props type**

```typescript
type Props = {
  activeModules: string[]
  confidenceScore: number
  pricingVisible: boolean
  productOverview: string
  proposalId: string
  onToggle: (id: string) => void
  aiStarted: boolean
  theme?: 'dark' | 'light'
  moduleSummaries?: { [id: string]: string }   // ← add
}
```

**Step 2: Destructure in component signature**

```typescript
export default function ModulesPanel({
  activeModules,
  confidenceScore,
  pricingVisible,
  productOverview,
  proposalId,
  onToggle,
  aiStarted,
  theme,
  moduleSummaries = {},   // ← add with default
}: Props) {
```

**Step 3: Pass summary to each active `ModuleCard`**

In the active modules map:

```tsx
{activeModules.length > 0 && activeModules.map((id) => (
  <ModuleCard
    key={id}
    moduleId={id}
    isActive={true}
    activeModules={activeModules}
    onToggle={onToggle}
    pricingVisible={pricingVisible}
    summary={moduleSummaries[id]}   // ← add
  />
))}
```

**Step 4: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | head -20
# Expected: ModuleCard will temporarily error until Task 7 — that's fine
```

**Step 5: Commit**

```bash
git add components/intake/ModulesPanel.tsx
git commit -m "feat: pass moduleSummaries through ModulesPanel to ModuleCard"
```

---

## Task 7: Redesign `ModuleCard` — accordion expansion, remove X, show summary

**Files:**
- Modify: `components/intake/ModuleCard.tsx`

**Step 1: Replace the entire file**

```tsx
'use client'

import { getModuleById, validateModuleRemoval } from '@/lib/modules/dependencies'
import * as Icons from 'lucide-react'
import { Plus, X } from 'lucide-react'

type Props = {
  moduleId: string
  isActive: boolean
  activeModules: string[]
  pricingVisible: boolean
  onToggle: (id: string) => void
  summary?: string
}

export default function ModuleCard({ moduleId, isActive, activeModules, pricingVisible, onToggle, summary }: Props) {
  const mod = getModuleById(moduleId)
  if (!mod) return null

  const { canRemove, blockedBy } = validateModuleRemoval(moduleId, activeModules)
  const canToggle = isActive ? canRemove : true

  const IconComponent = (Icons as unknown as Record<string, React.ComponentType<{ className?: string }>>)[mod.icon] ?? Icons.Box

  return (
    <div
      className={`w-full rounded-xl border transition-all text-left overflow-hidden ${
        isActive
          ? 'bg-brand-yellow/5 border-brand-yellow/30'
          : 'bg-[var(--ov-surface-subtle,rgba(255,255,255,0.02))] border-[var(--ov-border,rgba(255,255,255,0.05))] opacity-50'
      }`}
    >
      {/* Header row — always visible */}
      <button
        type="button"
        onClick={() => canToggle && onToggle(moduleId)}
        disabled={!canToggle && isActive}
        title={!canToggle ? `Required by: ${blockedBy.join(', ')}` : undefined}
        className={`w-full p-3 text-left ${canToggle ? 'hover:bg-white/[0.03] cursor-pointer' : 'cursor-not-allowed'}`}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${isActive ? 'bg-brand-yellow/15' : 'bg-[var(--ov-surface-subtle,rgba(255,255,255,0.05))]'}`}>
              <IconComponent className={`w-4 h-4 ${isActive ? 'text-brand-yellow' : 'text-brand-gray-mid'}`} />
            </div>
            <div className="min-w-0">
              <p className={`text-sm font-medium truncate ${isActive ? 'text-[var(--ov-text,#ffffff)]' : 'text-[var(--ov-text-muted,#727272)]'}`}>
                {mod.name}
              </p>
              {pricingVisible ? (
                <p className="text-xs text-[var(--ov-text-muted,#727272)] truncate">
                  ${mod.priceMin.toLocaleString()}–${mod.priceMax.toLocaleString()}
                </p>
              ) : (
                <p className="text-xs text-[var(--ov-text-muted,#727272)]/40 blur-[3px] select-none" aria-hidden="true">
                  $●,●●●–$●,●●●
                </p>
              )}
            </div>
          </div>

          {/* Inactive modules show + badge; active modules show nothing in header */}
          {!isActive && (
            <span className="flex-shrink-0 w-5 h-5 rounded-full bg-[var(--ov-surface-subtle,rgba(255,255,255,0.05))] text-[var(--ov-text-muted,#727272)] flex items-center justify-center">
              <Plus className="w-3 h-3" />
            </span>
          )}
        </div>
      </button>

      {/* Expandable body — only for active modules with a summary */}
      <div
        className="grid transition-[grid-template-rows] duration-300 ease-in-out"
        style={{ gridTemplateRows: isActive && summary ? '1fr' : '0fr' }}
      >
        <div className="overflow-hidden">
          <div className="px-3 pb-3">
            <div className="h-px bg-brand-yellow/10 mb-3" />
            <p className="text-xs text-[var(--ov-text-muted,#727272)] leading-relaxed">
              {summary}
            </p>
            {/* Deactivate affordance */}
            {canRemove && (
              <button
                type="button"
                onClick={() => onToggle(moduleId)}
                className="mt-2 flex items-center gap-1 text-[10px] text-[var(--ov-text-muted,#727272)]/50 hover:text-[var(--ov-text-muted,#727272)] transition-colors cursor-pointer"
              >
                <X className="w-2.5 h-2.5" />
                Remove module
              </button>
            )}
            {!canRemove && (
              <p className="mt-2 text-[10px] text-[var(--ov-text-muted,#727272)]/40">
                Required by: {blockedBy.join(', ')}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
```

**Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | head -20
```

**Step 3: Commit**

```bash
git add components/intake/ModuleCard.tsx
git commit -m "feat: module cards expand with AI summary, remove X badge from header"
```

---

## Task 8: Create `TypingIndicator` component

**Files:**
- Create: `components/intake/TypingIndicator.tsx`

**Step 1: Write the component**

```tsx
'use client'

import { useState, useEffect } from 'react'

const LABELS = ['Thinking', 'Analyzing', 'Planning', 'Mapping', 'Building']
const INTERVAL_MS = 1800

export default function TypingIndicator() {
  const [index, setIndex] = useState(0)
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    const cycle = setInterval(() => {
      // Fade out
      setVisible(false)
      setTimeout(() => {
        setIndex(i => (i + 1) % LABELS.length)
        setVisible(true)
      }, 200)
    }, INTERVAL_MS)

    return () => clearInterval(cycle)
  }, [])

  return (
    <span
      className="inline-block text-sm text-[var(--ov-text-muted,#727272)] transition-all duration-200"
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(4px)',
      }}
    >
      {LABELS[index]}…
    </span>
  )
}
```

**Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | head -20
```

**Step 3: Commit**

```bash
git add components/intake/TypingIndicator.tsx
git commit -m "feat: add TypingIndicator component with rotating single-word labels"
```

---

## Task 9: Update `MessageBubble` — swap in `TypingIndicator`, add AI avatar

**Files:**
- Modify: `components/intake/MessageBubble.tsx`

**Step 1: Add imports at the top**

```tsx
import Image from 'next/image'
import TypingIndicator from './TypingIndicator'
```

**Step 2: Replace the bouncing-dots span with `<TypingIndicator />`**

Find:
```tsx
{isStreaming && !rawContent ? (
  <span className="inline-flex gap-1">
    <span className="w-1.5 h-1.5 bg-brand-gray-mid rounded-full animate-bounce [animation-delay:0ms]" />
    <span className="w-1.5 h-1.5 bg-brand-gray-mid rounded-full animate-bounce [animation-delay:150ms]" />
    <span className="w-1.5 h-1.5 bg-brand-gray-mid rounded-full animate-bounce [animation-delay:300ms]" />
  </span>
```

Replace with:
```tsx
{isStreaming && !rawContent ? (
  <TypingIndicator />
```

**Step 3: Wrap AI messages in avatar layout**

The outer `<div>` of the component currently is:
```tsx
<div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
  <div className="max-w-[85%] space-y-3">
```

Replace with:
```tsx
<div className={`flex ${isUser ? 'justify-end' : 'items-start gap-2'}`}>
  {/* Avatar — AI messages only */}
  {!isUser && (
    <Image
      src="/lamba-icon.png"
      alt="Lamba Lab"
      width={24}
      height={24}
      className="rounded-full flex-shrink-0 mt-1 select-none"
    />
  )}
  <div className={`space-y-3 ${isUser ? 'max-w-[85%]' : 'max-w-[80%]'}`}>
```

Close the extra `</div>` at the end of the component is unchanged — it was already closing both divs.

**Step 4: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | head -20
```

**Step 5: Quick visual check in the preview**

Start the dev server and open the intake page. Confirm:
- AI messages show the yellow bulb avatar on the left
- When AI is loading (before text arrives), the bubble shows rotating single-word label instead of dots
- User messages have no avatar, stay right-aligned

```bash
# Dev server is on port 3001 with webpack
# Already configured in .claude/launch.json
```

**Step 6: Commit**

```bash
git add components/intake/MessageBubble.tsx
git commit -m "feat: add Lamba Lab avatar to AI messages, replace dots with TypingIndicator"
```

---

## Task 10: End-to-end smoke test + push

**Step 1: TypeScript full check**

```bash
npx tsc --noEmit 2>&1
# Expected: zero errors
```

**Step 2: Manual smoke test in Chrome**

1. Open the intake page (port 3001)
2. Type an idea and send
3. While AI is responding: confirm rotating label shows (`Thinking…`, `Analyzing…`, etc.)
4. After AI responds: confirm the Lamba Lab avatar appears next to the bubble
5. Open the proposal panel (desktop)
6. Confirm active module cards have NO `X` badge in the header
7. After the AI has run once with modules active: confirm module cards expand to show the summary text
8. Confirm inactive modules still show `+` and are collapsed

**Step 3: Push to Vercel**

```bash
git push origin main
# Vercel auto-deploys
```

---

## Summary of All Commits

| # | Commit message |
|---|----------------|
| 1 | `feat: add Lamba Lab icon asset for chat avatar` |
| 2 | `feat: add module_summaries field to update_proposal tool schema` |
| 3 | `feat: instruct AI to write per-module project-specific summaries` |
| 4 | `feat: add moduleSummaries state to useIntakeChat hook` |
| 5 | `feat: thread moduleSummaries from hook through IntakeLayout` |
| 6 | `feat: pass moduleSummaries through ModulesPanel to ModuleCard` |
| 7 | `feat: module cards expand with AI summary, remove X badge from header` |
| 8 | `feat: add TypingIndicator component with rotating single-word labels` |
| 9 | `feat: add Lamba Lab avatar to AI messages, replace dots with TypingIndicator` |
| 10 | Push + verify |
