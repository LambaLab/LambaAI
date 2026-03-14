# Design: Proposal Panel Redesign

**Date:** 2026-03-14
**Status:** Approved

---

## Goal

Restructure the right-side proposal panel with a cleaner hierarchy, collapsible sections, better module interaction, and a proper bottom action bar — replacing the scattered Reset button and placeholder CTAs.

---

## Panel Layout (top → bottom)

```
┌─────────────────────────────┐
│  Estimate Accuracy bar      │  fixed, always visible
├─────────────────────────────┤
│  ▸ Product Overview         │  accordion, open by default
│    labeled sections...      │
├─────────────────────────────┤
│  ▸ Technical Modules (N)    │  accordion, open by default
│    active module cards...   │
│    ── Add modules ──        │
│    inactive module cards... │
├─────────────────────────────┤
│  [Save Proposal]            │  ghost button, placeholder
│  [Submit Proposal →]        │  yellow primary, placeholder
│  [↺ Reset]                  │  two-step confirm
└─────────────────────────────┘
```

---

## Section 1: Estimate Accuracy

- Always visible at the top, no accordion
- Uses existing `<ConfidenceBar>` component
- No changes to the component itself

---

## Section 2: Product Overview (Accordion)

- Header: "PRODUCT OVERVIEW" label + chevron icon (rotates on toggle)
- Default state: **open**
- Content: existing `<ProductOverview>` text renderer (labeled sections / plain paragraphs)
- When no content yet: placeholder italic text, section still shows
- Accordion uses `grid-template-rows: 0fr → 1fr` CSS transition (same pattern as ModuleCard)
- State: `productOpen` boolean in `ModulesPanel`

---

## Section 3: Technical Modules (Accordion)

- Header: "TECHNICAL MODULES" label + module count badge + chevron
- Default state: **open**
- Content: active module cards + "Add modules" divider + inactive module cards (unchanged layout)
- Accordion wraps the entire scrollable module list
- State: `modulesOpen` boolean in `ModulesPanel`

---

## Section 4: Bottom Action Bar

Three stacked elements inside a `flex-shrink-0` footer:

### Save Proposal
- Full-width ghost button (border, transparent bg)
- Placeholder — `onClick` is a no-op for now
- Label: "Save Proposal"

### Submit Proposal
- Full-width yellow primary button (replaces "View Full Proposal →")
- Wires up to existing `AuthGateModal` (same as before, just renamed)
- Label: "Submit Proposal →"
- Only shown when `aiStarted` is true (same condition as old "View Full Proposal")

### Reset
- Text-only button, muted color
- Two-step confirm implemented locally in `ModulesPanel`:
  - First click: shows inline "Start over? Yes / No" (same UX as current header behavior)
  - Yes click: calls `onReset()` prop
  - Auto-reverts after 3s if no confirmation
- Label: "↺ Reset"

---

## ModuleCard Changes

### Active modules (have summary)
- Header click: **expand/collapse only** — no `onToggle` call
- `isExpanded` local state, default **false** (collapsed)
- Show a `ChevronDown` icon (rotates 180° when open) in the header right side
- "Remove module" button stays inside expanded body (unchanged)
- Price display removed entirely — both the visible `$X–$Y` line and the blurred placeholder

### Inactive modules (no summary)
- Behavior unchanged: click header → `onToggle` (adds module)
- `+` badge unchanged
- Price display removed (same as active)

### Prop changes
- `pricingVisible` prop **removed** from `ModuleCard`
- `pricingVisible` prop **removed** from `ModulesPanel` (no longer needed anywhere in the panel)

---

## IntakeOverlay Header Changes

- Remove the Reset button, `resetConfirm` state, `resetConfirmTimerRef`, and all associated handlers from `IntakeOverlay`
- Add `onReset` prop to `IntakeOverlay` (already partially wired — just expose the handler)
- Actually: `IntakeOverlay` already owns the actual reset logic (`handleResetClick` calls `window.location.href = '/'`). Pass this down as a callback to `ModulesPanel` via `IntakeLayout`.

---

## Prop Threading

```
IntakeOverlay
  handleResetClick (already exists — does localStorage clear + redirect)
    ↓ onReset prop
  IntakeLayout
    ↓ onReset prop
  ModulesPanel
    ↓ onReset prop
  (also via MobileBottomDrawer → ModulesPanel)
```

`IntakeLayout` already passes many props to `ModulesPanel`. Add `onReset`.
`MobileBottomDrawer` already forwards props to `ModulesPanel`. Add `onReset`.

---

## Files Changed

| File | Change |
|------|--------|
| `components/intake/ModulesPanel.tsx` | Full restructure: new layout, accordions, bottom bar, local reset confirm state |
| `components/intake/ModuleCard.tsx` | Remove price, active card = expand/collapse only, add ChevronDown, default collapsed |
| `components/intake/IntakeOverlay.tsx` | Remove Reset button + confirm state from header; expose `handleResetClick` as prop passed to IntakeLayout |
| `components/intake/IntakeLayout.tsx` | Accept `onReset` prop; pass it to ModulesPanel (both instances) |
| `components/intake/MobileBottomDrawer.tsx` | Accept + forward `onReset` prop to ModulesPanel |
