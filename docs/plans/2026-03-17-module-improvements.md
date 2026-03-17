# Module Improvements Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add 3 new modules (Monetization, Branding, Integrations), rename ai_features→ai, and fix module activation so modules only turn yellow after the AI has fully discussed them (synced with the green ✓ in the chat checklist).

**Architecture:** Split the single `activeModules` array into `detectedModules` (grey, identified by AI) and `confirmedModules` (yellow, discussed by AI). `confirmedModules` is populated from the existing `completedModules` state which already tracks modules the AI has finished deep-diving. The proposal panel uses `confirmedModules` for yellow styling instead of `activeModules`.

**Tech Stack:** Next.js App Router, TypeScript, Tailwind CSS, Claude API (tool_use)

---

### Task 1: Add New Modules & Rename ai_features → ai in Catalog

**Files:**
- Modify: `lib/modules/catalog.ts`

**Step 1: Update the catalog**

Replace the `ai_features` entry and add 3 new modules at the end of `MODULE_CATALOG`:

```typescript
// Replace existing ai_features (lines 83-92) with:
  {
    id: 'ai',
    name: 'AI',
    description: 'Smart features like chatbots, recommendations, and automation',
    category: 'ai',
    priceMin: 3000,
    priceMax: 8000,
    estimatedWeeks: [2, 5],
    icon: 'Sparkles',
  },
```

Add new category types to the `Module` type (line 5):
```typescript
category: 'core' | 'payments' | 'communication' | 'ai' | 'storage' | 'admin' | 'business'
```

Add 3 new modules after `analytics`:
```typescript
  {
    id: 'monetization',
    name: 'Monetization',
    description: 'How your app makes money — subscriptions, one-time purchase, ads, or freemium',
    category: 'business',
    priceMin: 1500,
    priceMax: 4000,
    estimatedWeeks: [1, 3],
    icon: 'DollarSign',
  },
  {
    id: 'branding',
    name: 'Branding',
    description: 'App name, domain, logo, colors, and visual identity',
    category: 'business',
    priceMin: 1000,
    priceMax: 3000,
    estimatedWeeks: [1, 2],
    icon: 'Palette',
  },
  {
    id: 'integrations',
    name: 'Third-party Integrations',
    description: 'Connecting to other services like social login, maps, and email tools',
    category: 'core',
    priceMin: 1500,
    priceMax: 4000,
    estimatedWeeks: [1, 3],
    icon: 'Plug',
  },
```

**Step 2: Commit**

```bash
git add lib/modules/catalog.ts
git commit -m "feat: add Monetization, Branding, Integrations modules; rename ai_features to ai"
```

---

### Task 2: Update Dependency Graph for New Modules

**Files:**
- Modify: `lib/modules/dependencies.ts`

**Step 1: Update DEPENDENCY_GRAPH**

Replace `ai_features: ['database']` with `ai: ['database']` (line 12).

Add new entries:
```typescript
  monetization: [],
  branding: [],
  integrations: ['database'],
```

**Step 2: Commit**

```bash
git add lib/modules/dependencies.ts
git commit -m "feat: update dependency graph for new modules"
```

---

### Task 3: Update System Prompt — New Modules & Proactive AI/Monetization/Branding

**Files:**
- Modify: `lib/ai/system-prompt.ts`

**Step 1: Update feature-to-module mapping (around line 294)**

Replace the `ai_features` reference:
```
- "Will there be any AI-powered features, like recommendations, smart suggestions, or auto-fill?" leads to ai (+ database)
```

Add new mappings:
```
- "How will this app make money? Subscriptions, ads, one-time purchase, marketplace fees?" leads to monetization
- "Do you have a name, brand colors, or logo for this project?" leads to branding
- "Will you need to connect to any other services like Google Maps, social login, email marketing, or calendar?" leads to integrations
```

**Step 2: Add proactive module consideration rules (after line 306)**

Add a new section:
```
### Always Consider These Modules
For EVERY project, you should proactively ask about these if the user hasn't mentioned them:
- AI: Most modern apps benefit from some smart feature. Ask naturally: "Would any part of this benefit from something smart, like recommendations, auto-sorting, or a chatbot?"
- Monetization: Ask early: "How are you thinking about making money with this?" This helps scope the business model.
- Branding: Ask at some point during deep_dive: "Do you have a name for this yet? Any brand colors or logo in mind?"

Do NOT force these modules. If the user says no or it doesn't apply, move on. But always ask.
```

**Step 3: Add confirmed_modules instruction**

Add after the `## Module Detection Rules` section:

```
## Module Confirmation Rules

detected_modules is still the full cumulative list of all modules the AI thinks are relevant.

A module is considered "confirmed" ONLY when the AI has completed its deep-dive questions for that module (i.e., module_complete: true is set for it). The UI tracks this automatically via the completedModules state — you do NOT need to output a separate confirmed_modules field.

Important: Modules should appear in detected_modules as soon as you're 70%+ confident they're needed. But they will only show as fully active (yellow) in the proposal panel after you've completed your deep-dive on them. This means:
- On the stage-setting turn: all detected modules appear grey in the proposal panel
- As you complete each module's deep-dive: that module turns yellow with a green ✓
- Users see progress as you work through the queue
```

**Step 4: Commit**

```bash
git add lib/ai/system-prompt.ts
git commit -m "feat: update system prompt with new modules and proactive consideration rules"
```

---

### Task 4: Split activeModules into detectedModules + confirmedModules in useIntakeChat

**Files:**
- Modify: `hooks/useIntakeChat.ts`

**Step 1: Rename activeModules → detectedModules**

This is the core change. The existing `activeModules` state tracks what the AI has detected. The existing `completedModules` state already tracks what the AI has finished discussing. We use `completedModules` as the source of truth for "confirmed" (yellow) modules.

Changes:
- Rename `activeModules` state → `detectedModules` (line 111)
- Rename `activeModulesRef` → `detectedModulesRef` (line 138)
- Rename all internal references from `activeModules` to `detectedModules`
- Update the return object (line 1235): return `detectedModules` instead of `activeModules`, plus keep `completedModules` (already returned)
- The `toggleModule` function (around line 1057) should operate on `detectedModules`
- Update localStorage persistence: save as `detectedModules` (was `activeModules`)
- Restore: read `activeModules` from localStorage for backward compat, map to `detectedModules`

Also update `ai_features` → `ai` in any hardcoded references.

**Step 2: Commit**

```bash
git add hooks/useIntakeChat.ts
git commit -m "feat: rename activeModules to detectedModules in useIntakeChat"
```

---

### Task 5: Update ModulesPanel — Grey for Detected, Yellow for Confirmed

**Files:**
- Modify: `components/intake/ModulesPanel.tsx`

**Step 1: Update Props type (line 10-21)**

```typescript
type Props = {
  detectedModules: string[]
  confirmedModules: string[]   // NEW — modules that have been fully discussed
  confidenceScore: number
  productOverview: string
  proposalId: string
  onToggle: (id: string) => void
  aiStarted: boolean
  theme?: 'dark' | 'light'
  moduleSummaries?: { [id: string]: string }
  onReset?: () => void
  onSaveLater?: () => void
}
```

**Step 2: Update rendering logic (lines 188-218)**

Replace the current two-section layout with three sections:

1. **Confirmed modules** (yellow, fully discussed) — from `confirmedModules`
2. **Detected but not confirmed** (grey with subtle border, detected but not yet discussed) — from `detectedModules` minus `confirmedModules`
3. **Remaining catalog modules** (grey, 50% opacity) — not in `detectedModules` at all

```typescript
{/* Confirmed modules — yellow */}
{confirmedModules.map((id) => (
  <ModuleCard
    key={id}
    moduleId={id}
    status="confirmed"
    detectedModules={detectedModules}
    onToggle={onToggle}
    summary={moduleSummaries[id]}
  />
))}

{/* Detected but not yet discussed — subtle grey with accent border */}
{detectedModules
  .filter((id) => !confirmedModules.includes(id))
  .map((id) => (
    <ModuleCard
      key={id}
      moduleId={id}
      status="detected"
      detectedModules={detectedModules}
      onToggle={onToggle}
    />
  ))}

{/* Remaining catalog — fully grey */}
{detectedModules.length > 0 && (
  <div className="py-2">
    <div className="h-px bg-[var(--ov-border,rgba(255,255,255,0.05))]" />
    <p className="text-xs text-[var(--ov-text-muted,#727272)] mt-2 mb-1">
      Add modules
    </p>
  </div>
)}
{MODULE_CATALOG
  .filter((m) => !detectedModules.includes(m.id))
  .map((m) => (
    <ModuleCard
      key={m.id}
      moduleId={m.id}
      status="inactive"
      detectedModules={detectedModules}
      onToggle={onToggle}
    />
  ))}
```

Update the badge count to show confirmed count:
```typescript
{confirmedModules.length > 0 && (
  <span className="...">
    {confirmedModules.length}
  </span>
)}
```

**Step 3: Commit**

```bash
git add components/intake/ModulesPanel.tsx
git commit -m "feat: show three module states — confirmed (yellow), detected (grey), inactive"
```

---

### Task 6: Update ModuleCard — Three Visual States

**Files:**
- Modify: `components/intake/ModuleCard.tsx`

**Step 1: Update Props and styling**

Replace `isActive: boolean` with `status: 'confirmed' | 'detected' | 'inactive'`:

```typescript
type Props = {
  moduleId: string
  status: 'confirmed' | 'detected' | 'inactive'
  detectedModules: string[]
  onToggle: (id: string) => void
  summary?: string
}
```

Update the card styling:
```typescript
const cardStyles = {
  confirmed: 'bg-[var(--ov-accent-bg,rgba(255,252,0,0.05))] border-[var(--ov-accent-border,rgba(255,252,0,0.30))]',
  detected: 'bg-[var(--ov-surface-subtle,rgba(255,255,255,0.03))] border-[var(--ov-border,rgba(255,255,255,0.10))] border-dashed',
  inactive: 'bg-[var(--ov-surface-subtle,rgba(255,255,255,0.02))] border-[var(--ov-border,rgba(255,255,255,0.05))] opacity-50',
}

const iconStyles = {
  confirmed: 'bg-[var(--ov-accent-bg,rgba(255,252,0,0.15))]',
  detected: 'bg-[var(--ov-surface-subtle,rgba(255,255,255,0.05))]',
  inactive: 'bg-[var(--ov-surface-subtle,rgba(255,255,255,0.05))]',
}

const iconColorStyles = {
  confirmed: 'text-[var(--ov-accent-strong,#fffc00)]',
  detected: 'text-[var(--ov-text-muted,#727272)]',
  inactive: 'text-[var(--ov-text-muted,#727272)]',
}

const textStyles = {
  confirmed: 'text-[var(--ov-text,#ffffff)]',
  detected: 'text-[var(--ov-text,#ffffff)]/70',
  inactive: 'text-[var(--ov-text-muted,#727272)]',
}
```

The `detected` state uses a **dashed border** to visually communicate "coming soon / pending". Not yellow, not fully grey — a middle ground.

**Step 2: Commit**

```bash
git add components/intake/ModuleCard.tsx
git commit -m "feat: add three visual states to ModuleCard — confirmed, detected, inactive"
```

---

### Task 7: Update Parent Component (ChatPanel) to Pass New Props

**Files:**
- Modify: `components/intake/ChatPanel.tsx` (or wherever ModulesPanel is rendered)

**Step 1: Find where ModulesPanel is rendered and update props**

Change:
```typescript
<ModulesPanel
  activeModules={activeModules}
  ...
/>
```

To:
```typescript
<ModulesPanel
  detectedModules={detectedModules}
  confirmedModules={completedModules}
  ...
/>
```

The key insight: `completedModules` from `useIntakeChat` IS the confirmed modules list. It's already being tracked — we just need to pass it through.

**Step 2: Commit**

```bash
git add components/intake/ChatPanel.tsx
git commit -m "feat: pass detectedModules and confirmedModules to ModulesPanel"
```

---

### Task 8: Update Any Other References to activeModules / ai_features

**Files:**
- Search and update all files referencing `activeModules` or `ai_features`

**Step 1: Search codebase**

```bash
grep -rn "activeModules\|ai_features" --include="*.ts" --include="*.tsx" lib/ components/ app/ hooks/
```

Update all references:
- `activeModules` → `detectedModules` in hook consumers
- `ai_features` → `ai` in any hardcoded strings
- Update localStorage keys for backward compatibility (read old `activeModules` key, write as `detectedModules`)

Key files likely affected:
- `app/api/intake/chat/route.ts` — receives `currentModules` from client
- `components/intake/ModuleProgressCard.tsx` — if it references activeModules
- `components/proposal/ProposalView.tsx` — reads modules from DB (no change needed, DB stores final modules)
- Supabase save logic in useIntakeChat — where it saves to proposals table

**Step 2: Commit**

```bash
git add -A
git commit -m "feat: update all references from activeModules to detectedModules, ai_features to ai"
```

---

### Task 9: Test End-to-End & Verify

**Step 1: Run dev server**
```bash
npm run dev
```

**Step 2: Test the flow**
1. Start a new intake chat
2. Type a product idea (e.g., "I want to build a food delivery app")
3. Verify: modules appear in the proposal panel as **grey/dashed** (detected, not confirmed)
4. Work through the deep-dive questions for each module
5. Verify: as each module completes (✓ green check in chat), it turns **yellow** in the proposal panel
6. Verify: the AI proactively asks about AI features, monetization, and branding
7. Verify: new modules (Monetization, Branding, Integrations) appear in the catalog

**Step 3: Run build**
```bash
npm run build
```

**Step 4: Commit if any fixes needed**

---

### Task 10: Push & Deploy

**Step 1: Push to GitHub**
```bash
git push origin main
```

**Step 2: Verify Vercel deployment succeeds**

Check the Vercel dashboard for a green deployment.
