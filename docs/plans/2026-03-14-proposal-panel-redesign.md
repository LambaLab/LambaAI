# Proposal Panel Redesign Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Restructure the right-side proposal panel with Estimate Accuracy at top, collapsible Product Overview and Technical Modules accordions, expand-only module cards, and a bottom action bar (Save / Submit / Reset) replacing the scattered header Reset button.

**Architecture:** Five sequential file changes. `ModuleCard` gains local `isExpanded` state and loses price display. `IntakeOverlay` extracts its reset handler into a plain callback. `IntakeLayout` + `MobileBottomDrawer` thread the new `onReset` prop down. `ModulesPanel` is fully restructured with new layout, two accordion sections, and a bottom bar with two-step Reset confirm.

**Tech Stack:** Next.js App Router, React, Tailwind CSS v4, Lucide icons, `grid-template-rows` CSS accordion pattern

---

## Task 1: Redesign `ModuleCard` — remove price, expand/collapse only for active modules

**Files:**
- Modify: `components/intake/ModuleCard.tsx`

**Context:**
- Currently: active module header click calls `onToggle` (removes module). Price shown in header.
- New: active module header click = expand/collapse only (`isExpanded` local state, default `false`). Inactive module click still calls `onToggle` (adds module). Price removed entirely. `pricingVisible` prop removed.

**Step 1: Replace the entire file**

```tsx
'use client'

import { useState } from 'react'
import { getModuleById, validateModuleRemoval } from '@/lib/modules/dependencies'
import * as Icons from 'lucide-react'
import { Plus, X, ChevronDown } from 'lucide-react'

type Props = {
  moduleId: string
  isActive: boolean
  activeModules: string[]
  onToggle: (id: string) => void
  summary?: string
}

export default function ModuleCard({ moduleId, isActive, activeModules, onToggle, summary }: Props) {
  const [isExpanded, setIsExpanded] = useState(false)
  const mod = getModuleById(moduleId)
  if (!mod) return null

  const { canRemove, blockedBy } = validateModuleRemoval(moduleId, activeModules)

  const IconComponent = (Icons as unknown as Record<string, React.ComponentType<{ className?: string }>>)[mod.icon] ?? Icons.Box

  function handleHeaderClick() {
    if (isActive) {
      // Active modules: only expand/collapse, never add/remove on header click
      if (summary) setIsExpanded(e => !e)
    } else {
      // Inactive modules: clicking adds to proposal
      onToggle(moduleId)
    }
  }

  return (
    <div
      className={`w-full rounded-xl border transition-all text-left overflow-hidden ${
        isActive
          ? 'bg-brand-yellow/5 border-brand-yellow/30'
          : 'bg-[var(--ov-surface-subtle,rgba(255,255,255,0.02))] border-[var(--ov-border,rgba(255,255,255,0.05))] opacity-50'
      }`}
    >
      {/* Header row */}
      <button
        type="button"
        onClick={handleHeaderClick}
        disabled={isActive && !summary}
        className={`w-full p-3 text-left ${
          isActive
            ? summary
              ? 'cursor-pointer hover:bg-white/[0.03]'
              : 'cursor-default'
            : 'cursor-pointer hover:bg-white/[0.03]'
        }`}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
              isActive
                ? 'bg-brand-yellow/15'
                : 'bg-[var(--ov-surface-subtle,rgba(255,255,255,0.05))]'
            }`}>
              <IconComponent className={`w-4 h-4 ${isActive ? 'text-brand-yellow' : 'text-brand-gray-mid'}`} />
            </div>
            <p className={`text-sm font-medium truncate ${
              isActive ? 'text-[var(--ov-text,#ffffff)]' : 'text-[var(--ov-text-muted,#727272)]'
            }`}>
              {mod.name}
            </p>
          </div>

          {/* Right icon */}
          {isActive && summary ? (
            <ChevronDown
              className={`w-4 h-4 text-[var(--ov-text-muted,#727272)] flex-shrink-0 transition-transform duration-200 ${
                isExpanded ? 'rotate-180' : ''
              }`}
            />
          ) : !isActive ? (
            <span className="flex-shrink-0 w-5 h-5 rounded-full bg-[var(--ov-surface-subtle,rgba(255,255,255,0.05))] text-[var(--ov-text-muted,#727272)] flex items-center justify-center">
              <Plus className="w-3 h-3" />
            </span>
          ) : null}
        </div>
      </button>

      {/* Expandable body — only for active modules with a summary */}
      <div
        className="grid transition-[grid-template-rows] duration-300 ease-in-out"
        style={{ gridTemplateRows: isExpanded && summary ? '1fr' : '0fr' }}
      >
        <div className="overflow-hidden">
          <div className="px-3 pb-3">
            <div className="h-px bg-brand-yellow/10 mb-3" />
            <p className="text-xs text-[var(--ov-text-muted,#727272)] leading-relaxed">
              {summary}
            </p>
            {canRemove ? (
              <button
                type="button"
                onClick={() => onToggle(moduleId)}
                className="mt-2 flex items-center gap-1 text-[10px] text-[var(--ov-text-muted,#727272)]/50 hover:text-[var(--ov-text-muted,#727272)] transition-colors cursor-pointer"
              >
                <X className="w-2.5 h-2.5" />
                Remove module
              </button>
            ) : (
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

**Step 2: TypeScript check**

```bash
cd "/Users/nagi/Downloads/Lamba Lab/Lamba Lab app" && npx tsc --noEmit 2>&1 | head -20
```

Expected: Errors about `pricingVisible` being passed to `ModuleCard` where it no longer exists. These will be resolved in later tasks. No new errors in `ModuleCard` itself.

**Step 3: Commit**

```bash
cd "/Users/nagi/Downloads/Lamba Lab/Lamba Lab app"
git add components/intake/ModuleCard.tsx
git commit -m "feat: module card expand/collapse only, remove price display"
```

---

## Task 2: Extract reset handler from `IntakeOverlay`, remove from header

**Files:**
- Modify: `components/intake/IntakeOverlay.tsx`

**Context:**
- Currently: `resetConfirm` state + timer + confirm UI lives in the header. `handleResetClick` does a two-step confirm before redirecting.
- New: Extract the *actual reset action* (clearing localStorage + redirect) into a standalone `doReset` function. Remove `resetConfirm` state + timer + header button entirely. Pass `doReset` as `onReset` prop to `IntakeLayout`. The confirm UX moves to `ModulesPanel` in Task 5.

**Step 1: Read the file first**

Read `components/intake/IntakeOverlay.tsx` before editing.

**Step 2: Remove `resetConfirm` state + timer (3 items)**

Remove these lines entirely:
```tsx
const [resetConfirm, setResetConfirm] = useState(false)
const resetRef = useRef<(() => void) | null>(null)
const resetConfirmTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
```

Also remove the cleanup `useEffect` for `resetConfirmTimerRef`:
```tsx
useEffect(() => {
  return () => {
    if (resetConfirmTimerRef.current) clearTimeout(resetConfirmTimerRef.current)
  }
}, [])
```

And remove the `onResetRef` wiring (the effect that sets `resetRef.current`):
```tsx
// remove this if present — it was for the old approach
```

**Step 3: Replace `handleResetClick` with `doReset`**

Replace the entire `handleResetClick` function with:
```tsx
function doReset() {
  if (session) {
    localStorage.removeItem(`lamba_idea_${session.proposalId}`)
    localStorage.removeItem(`lamba_msgs_${session.proposalId}`)
  }
  localStorage.removeItem('lamba_session')
  onReset?.()
  window.location.href = '/'
}
```

**Step 4: Remove reset button + confirm UI from header**

Find and remove this entire block from the header JSX:
```tsx
{resetConfirm ? (
  <div className="flex items-center gap-2">
    <span className="text-xs text-brand-gray-mid">Start over?</span>
    <button
      onClick={handleResetClick}
      className="text-xs text-red-400 hover:text-red-300 transition-colors px-2 py-1 rounded-lg hover:bg-white/5 cursor-pointer"
    >
      Yes
    </button>
    <button
      onClick={() => setResetConfirm(false)}
      className="text-xs text-brand-gray-mid hover:text-brand-white transition-colors px-2 py-1 rounded-lg hover:bg-white/5 cursor-pointer"
    >
      No
    </button>
  </div>
) : (
  <button
    onClick={handleResetClick}
    className="text-xs text-brand-gray-mid hover:text-brand-white transition-colors px-2 py-1 rounded-lg hover:bg-white/5 cursor-pointer"
    aria-label="Reset conversation"
  >
    ↺ Reset
  </button>
)}
```

**Step 5: Pass `doReset` to `IntakeLayout`**

Find the `<IntakeLayout` render and add `onReset={doReset}`:
```tsx
<IntakeLayout
  proposalId={session.proposalId}
  initialMessage={currentIdea}
  onStateChange={handleStateChange}
  onResetRef={resetRef}
  theme={theme}
  proposalOpen={proposalOpen}
  onProposalToggle={() => setProposalOpen(p => !p)}
  onReset={doReset}
/>
```

Note: `onResetRef={resetRef}` — `resetRef` is still needed by `IntakeLayout` to wire up the `useIntakeChat` reset function. Keep `resetRef` declared as `useRef<(() => void) | null>(null)`. Only remove `resetConfirmTimerRef` and `resetConfirm` state.

**Step 6: TypeScript check**

```bash
cd "/Users/nagi/Downloads/Lamba Lab/Lamba Lab app" && npx tsc --noEmit 2>&1 | head -20
```

Expected: Error about `onReset` not being in `IntakeLayout` Props — resolved in Task 3.

**Step 7: Commit**

```bash
git add components/intake/IntakeOverlay.tsx
git commit -m "feat: extract reset handler from IntakeOverlay header, pass as onReset prop"
```

---

## Task 3: Thread `onReset` through `IntakeLayout`

**Files:**
- Modify: `components/intake/IntakeLayout.tsx`

**Context:**
- Add `onReset?: () => void` to `IntakeLayout` Props. Pass it to both `ModulesPanel` instances (desktop + via `MobileBottomDrawer`). Also stop passing `pricingVisible` to both since `ModulesPanel` no longer needs it after Task 5 (add the prop now but `ModulesPanel` won't accept it yet — TypeScript will catch this after Task 5).

**Step 1: Read the file first**

Read `components/intake/IntakeLayout.tsx`.

**Step 2: Add `onReset` to Props type**

Find the `type Props = {` block. Add:
```typescript
onReset?: () => void
```

**Step 3: Destructure `onReset` from props**

Find the `export default function IntakeLayout({` line. Add `onReset` to the destructure:
```typescript
export default function IntakeLayout({
  proposalId,
  initialMessage,
  onStateChange,
  onResetRef,
  theme,
  proposalOpen,
  onProposalToggle,
  onReset,
}: Props) {
```

**Step 4: Pass `onReset` to desktop `ModulesPanel`**

Find the desktop `<ModulesPanel` block and add `onReset={onReset}`:
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
  moduleSummaries={moduleSummaries}
  onReset={onReset}
/>
```

**Step 5: Pass `onReset` to `MobileBottomDrawer`**

Find the `<MobileBottomDrawer` block and add `onReset={onReset}`:
```tsx
<MobileBottomDrawer
  summary={summaryText}
  activeModules={activeModules}
  confidenceScore={confidenceScore}
  pricingVisible={pricingVisible}
  productOverview={productOverview}
  proposalId={proposalId}
  aiStarted={aiStarted}
  onToggle={toggleModule}
  moduleSummaries={moduleSummaries}
  onReset={onReset}
/>
```

**Step 6: TypeScript check**

```bash
cd "/Users/nagi/Downloads/Lamba Lab/Lamba Lab app" && npx tsc --noEmit 2>&1 | head -20
```

Expected: Errors about `onReset` not in `ModulesPanel` / `MobileBottomDrawer` Props — resolved in Tasks 4 and 5.

**Step 7: Commit**

```bash
git add components/intake/IntakeLayout.tsx
git commit -m "feat: thread onReset prop through IntakeLayout to ModulesPanel and MobileBottomDrawer"
```

---

## Task 4: Thread `onReset` through `MobileBottomDrawer`

**Files:**
- Modify: `components/intake/MobileBottomDrawer.tsx`

**Step 1: Read the file first**

Read `components/intake/MobileBottomDrawer.tsx`.

**Step 2: Add `onReset` to Props type**

```typescript
type Props = {
  summary: string
  activeModules: string[]
  confidenceScore: number
  pricingVisible: boolean
  productOverview: string
  proposalId: string
  aiStarted: boolean
  onToggle: (id: string) => void
  moduleSummaries?: { [id: string]: string }
  onReset?: () => void   // ← add
}
```

**Step 3: Destructure `onReset` with default**

```typescript
export default function MobileBottomDrawer({
  summary,
  activeModules,
  confidenceScore,
  pricingVisible,
  productOverview,
  proposalId,
  aiStarted,
  onToggle,
  moduleSummaries = {},
  onReset,   // ← add
}: Props) {
```

**Step 4: Forward `onReset` to `ModulesPanel`**

In the `<ModulesPanel` inside `MobileBottomDrawer`, add `onReset={onReset}`:
```tsx
<ModulesPanel
  activeModules={activeModules}
  confidenceScore={confidenceScore}
  pricingVisible={pricingVisible}
  productOverview={productOverview}
  proposalId={proposalId}
  aiStarted={aiStarted}
  onToggle={onToggle}
  moduleSummaries={moduleSummaries}
  onReset={onReset}
/>
```

**Step 5: TypeScript check**

```bash
cd "/Users/nagi/Downloads/Lamba Lab/Lamba Lab app" && npx tsc --noEmit 2>&1 | head -20
```

Expected: Error about `onReset` not in `ModulesPanel` Props — resolved in Task 5.

**Step 6: Commit**

```bash
git add components/intake/MobileBottomDrawer.tsx
git commit -m "feat: thread onReset through MobileBottomDrawer to ModulesPanel"
```

---

## Task 5: Restructure `ModulesPanel` — new layout, accordions, bottom bar

**Files:**
- Modify: `components/intake/ModulesPanel.tsx`

**Context:** This is the biggest change. Full file replacement. Key changes:
1. Reorder: Estimate Accuracy → Product Overview (accordion) → Technical Modules (accordion)
2. Both sections use `grid-template-rows` accordion pattern, open by default
3. Remove `pricingVisible` from Props (no longer needed — ModuleCard doesn't use it)
4. Add `onReset?: () => void` prop
5. Add local reset confirm state + timer
6. Bottom bar: Save Proposal (placeholder) + Submit Proposal (replaces View Full Proposal) + Reset

**Step 1: Replace the entire file**

```tsx
'use client'

import { useState, useRef, useEffect } from 'react'
import { ChevronDown } from 'lucide-react'
import ModuleCard from './ModuleCard'
import ConfidenceBar from './ConfidenceBar'
import AuthGateModal from './AuthGateModal'
import { MODULE_CATALOG } from '@/lib/modules/catalog'

type Props = {
  activeModules: string[]
  confidenceScore: number
  productOverview: string
  proposalId: string
  onToggle: (id: string) => void
  aiStarted: boolean
  theme?: 'dark' | 'light'
  moduleSummaries?: { [id: string]: string }
  onReset?: () => void
}

// Renders product overview text — supports labeled sections and plain paragraphs
function ProductOverview({ text }: { text: string }) {
  const paragraphs = text.split('\n\n').filter(Boolean)
  return (
    <div className="space-y-3">
      {paragraphs.map((para, i) => {
        const labelMatch = para.match(/^([^:\n]{1,30}):\s+([\s\S]+)$/)
        if (labelMatch) {
          return (
            <div key={i}>
              <p className="text-[10px] font-semibold text-[var(--ov-text-muted,#727272)] uppercase tracking-widest mb-1">
                {labelMatch[1]}
              </p>
              <p className="text-sm text-[var(--ov-text,#ffffff)] leading-relaxed">
                {labelMatch[2]}
              </p>
            </div>
          )
        }
        return (
          <p key={i} className="text-sm text-[var(--ov-text,#ffffff)] leading-relaxed">
            {para}
          </p>
        )
      })}
    </div>
  )
}

export default function ModulesPanel({
  activeModules,
  confidenceScore,
  productOverview,
  proposalId,
  onToggle,
  aiStarted,
  theme,
  moduleSummaries = {},
  onReset,
}: Props) {
  const [showAuthGate, setShowAuthGate] = useState(false)
  const [productOpen, setProductOpen] = useState(true)
  const [modulesOpen, setModulesOpen] = useState(true)
  const [resetConfirm, setResetConfirm] = useState(false)
  const resetConfirmTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (resetConfirmTimerRef.current) clearTimeout(resetConfirmTimerRef.current)
    }
  }, [])

  function handleResetClick() {
    if (!resetConfirm) {
      setResetConfirm(true)
      resetConfirmTimerRef.current = setTimeout(() => setResetConfirm(false), 3000)
    }
  }

  function handleResetConfirm() {
    if (resetConfirmTimerRef.current) clearTimeout(resetConfirmTimerRef.current)
    setResetConfirm(false)
    onReset?.()
  }

  function handleResetCancel() {
    if (resetConfirmTimerRef.current) clearTimeout(resetConfirmTimerRef.current)
    setResetConfirm(false)
  }

  return (
    <div className="flex flex-col h-full">

      {/* 1. Estimate Accuracy — always visible at top */}
      <div className="px-4 py-3 border-b border-[var(--ov-border,rgba(255,255,255,0.05))] flex-shrink-0">
        <ConfidenceBar score={confidenceScore} />
      </div>

      {/* Scrollable middle */}
      <div className="flex-1 overflow-y-auto">

        {/* 2. Product Overview accordion */}
        <div className="border-b border-[var(--ov-border,rgba(255,255,255,0.05))]">
          <button
            type="button"
            onClick={() => setProductOpen(o => !o)}
            className="w-full flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-white/[0.02] transition-colors"
          >
            <h2 className="font-bebas text-xs tracking-[0.15em] text-[var(--ov-text-muted,#727272)]">
              PRODUCT OVERVIEW
            </h2>
            <ChevronDown
              className={`w-4 h-4 text-[var(--ov-text-muted,#727272)] transition-transform duration-200 ${
                productOpen ? 'rotate-180' : ''
              }`}
            />
          </button>
          <div
            className="grid transition-[grid-template-rows] duration-300 ease-in-out"
            style={{ gridTemplateRows: productOpen ? '1fr' : '0fr' }}
          >
            <div className="overflow-hidden">
              <div className="px-4 pb-4">
                {productOverview ? (
                  <ProductOverview text={productOverview} />
                ) : (
                  <p className="text-sm text-[var(--ov-text-muted,#727272)]/50 leading-relaxed italic">
                    Your product overview will appear here as we learn more...
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* 3. Technical Modules accordion */}
        <div>
          <button
            type="button"
            onClick={() => setModulesOpen(o => !o)}
            className="w-full flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-white/[0.02] transition-colors"
          >
            <div className="flex items-center gap-2">
              <h2 className="font-bebas text-xs tracking-[0.15em] text-[var(--ov-text-muted,#727272)]">
                TECHNICAL MODULES
              </h2>
              {activeModules.length > 0 && (
                <span className="text-[10px] bg-brand-yellow/15 text-brand-yellow px-1.5 py-0.5 rounded-full font-medium">
                  {activeModules.length}
                </span>
              )}
            </div>
            <ChevronDown
              className={`w-4 h-4 text-[var(--ov-text-muted,#727272)] transition-transform duration-200 ${
                modulesOpen ? 'rotate-180' : ''
              }`}
            />
          </button>
          <div
            className="grid transition-[grid-template-rows] duration-300 ease-in-out"
            style={{ gridTemplateRows: modulesOpen ? '1fr' : '0fr' }}
          >
            <div className="overflow-hidden">
              <div className="px-4 pb-4 space-y-2">
                {activeModules.map((id) => (
                  <ModuleCard
                    key={id}
                    moduleId={id}
                    isActive={true}
                    activeModules={activeModules}
                    onToggle={onToggle}
                    summary={moduleSummaries[id]}
                  />
                ))}

                {activeModules.length > 0 && (
                  <div className="py-2">
                    <div className="h-px bg-[var(--ov-border,rgba(255,255,255,0.05))]" />
                    <p className="text-xs text-[var(--ov-text-muted,#727272)] mt-2 mb-1">
                      Add modules
                    </p>
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
                    />
                  ))}
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* 4. Bottom action bar */}
      <div className="flex-shrink-0 border-t border-[var(--ov-border,rgba(255,255,255,0.05))] px-4 py-4 space-y-2">

        {/* Save Proposal — placeholder */}
        <button
          type="button"
          className="w-full py-2.5 rounded-xl border border-[var(--ov-border,rgba(255,255,255,0.10))] text-[var(--ov-text,#ffffff)] text-sm font-medium hover:bg-white/[0.03] transition-colors cursor-pointer"
        >
          Save Proposal
        </button>

        {/* Submit Proposal — replaces "View Full Proposal", shown once AI has started */}
        {aiStarted && (
          <button
            type="button"
            onClick={() => setShowAuthGate(true)}
            className="w-full py-2.5 bg-brand-yellow text-brand-dark font-medium rounded-xl hover:bg-brand-yellow/90 transition-all active:scale-[0.98] text-sm cursor-pointer"
          >
            Submit Proposal →
          </button>
        )}

        {/* Reset — two-step confirm */}
        <div className="flex items-center justify-center pt-1">
          {resetConfirm ? (
            <div className="flex items-center gap-3">
              <span className="text-xs text-[var(--ov-text-muted,#727272)]">Start over?</span>
              <button
                type="button"
                onClick={handleResetConfirm}
                className="text-xs text-red-400 hover:text-red-300 transition-colors px-2 py-1 rounded-lg hover:bg-white/5 cursor-pointer"
              >
                Yes
              </button>
              <button
                type="button"
                onClick={handleResetCancel}
                className="text-xs text-[var(--ov-text-muted,#727272)] hover:text-[var(--ov-text,#ffffff)] transition-colors px-2 py-1 rounded-lg hover:bg-white/5 cursor-pointer"
              >
                No
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleResetClick}
              className="text-xs text-[var(--ov-text-muted,#727272)] hover:text-[var(--ov-text,#ffffff)] transition-colors px-2 py-1 rounded-lg hover:bg-white/5 cursor-pointer"
            >
              ↺ Reset
            </button>
          )}
        </div>

      </div>

      {showAuthGate && (
        <AuthGateModal
          proposalId={proposalId}
          onClose={() => setShowAuthGate(false)}
          theme={theme}
        />
      )}

    </div>
  )
}
```

**Step 2: TypeScript check — expect clean**

```bash
cd "/Users/nagi/Downloads/Lamba Lab/Lamba Lab app" && npx tsc --noEmit 2>&1 | head -20
```

Expected: Errors about `pricingVisible` still being passed from `IntakeLayout` and `MobileBottomDrawer` to `ModulesPanel` (prop no longer exists). Fix in Step 3.

**Step 3: Remove `pricingVisible` from callers**

`IntakeLayout.tsx` — remove `pricingVisible={pricingVisible}` from the desktop `<ModulesPanel` call.

`MobileBottomDrawer.tsx` — remove `pricingVisible={pricingVisible}` from its `<ModulesPanel` call. Also remove `pricingVisible` from `MobileBottomDrawer`'s own Props type and destructure, since it no longer uses it.

`IntakeLayout.tsx` — remove `pricingVisible={pricingVisible}` from `<MobileBottomDrawer` call too.

**Step 4: TypeScript check — expect clean**

```bash
cd "/Users/nagi/Downloads/Lamba Lab/Lamba Lab app" && npx tsc --noEmit 2>&1 | head -10
```

Expected: Zero errors.

**Step 5: Commit**

```bash
git add components/intake/ModulesPanel.tsx components/intake/MobileBottomDrawer.tsx components/intake/IntakeLayout.tsx
git commit -m "feat: restructure proposal panel with accordions, bottom bar, move Reset"
```

---

## Task 6: Smoke test + push

**Step 1: Start dev server (if not running)**

```bash
# Already configured in .claude/launch.json
# Uses: node node_modules/.bin/next dev --webpack --port 3001
```

**Step 2: Visual smoke test checklist**

Open `localhost:3001`, enter an idea, wait for AI response, open the Proposal panel (desktop). Verify:

- [ ] Estimate Accuracy bar is at the very top
- [ ] "PRODUCT OVERVIEW" section below it, with chevron, open by default
- [ ] Clicking "PRODUCT OVERVIEW" header collapses/expands with animation
- [ ] "TECHNICAL MODULES" section below product overview, with module count badge + chevron
- [ ] Clicking "TECHNICAL MODULES" header collapses/expands
- [ ] Active module cards are collapsed by default (no auto-expansion)
- [ ] Clicking an active module card header expands it (shows summary + "Remove module")
- [ ] Clicking an active module card header again collapses it
- [ ] Clicking "Remove module" inside expanded card removes the module
- [ ] Inactive module cards still add modules when clicked
- [ ] No price display (`$X–$Y`) anywhere in module cards
- [ ] Bottom bar shows: "Save Proposal" (ghost), "Submit Proposal →" (yellow, when AI started), "↺ Reset"
- [ ] Reset shows "Start over? Yes / No" on first click, fires `doReset` on Yes, cancels on No
- [ ] No Reset button in the top header

**Step 3: Push to Vercel**

```bash
cd "/Users/nagi/Downloads/Lamba Lab/Lamba Lab app" && git push origin main
```

---

## Commit Summary

| # | Message |
|---|---------|
| 1 | `feat: module card expand/collapse only, remove price display` |
| 2 | `feat: extract reset handler from IntakeOverlay header, pass as onReset prop` |
| 3 | `feat: thread onReset prop through IntakeLayout to ModulesPanel and MobileBottomDrawer` |
| 4 | `feat: thread onReset through MobileBottomDrawer to ModulesPanel` |
| 5 | `feat: restructure proposal panel with accordions, bottom bar, move Reset` |
| 6 | push |
