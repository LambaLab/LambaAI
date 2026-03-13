# Intake Redesign — Rich Chat UX + Gmail-Style Minimize

**Date:** 2026-03-13
**Status:** Approved — ready for implementation

---

## Overview

Two connected improvements to the intake experience:

1. **Gmail-style minimize** — the full-screen overlay can be collapsed to a progress bar at the bottom-right without losing chat state
2. **Rich structured intake** — hardcoded onboarding questions (icon cards) for the first 3 scoping questions, then AI-driven conversation with variable quick-reply styles (list, icon-cards, pills), multi-select, and "Type something else..." support

---

## Section 1: Minimize Bar

### Behavior
- The `Minus` button in `IntakeOverlay`'s top bar collapses the overlay to a fixed bottom-right bar
- The overlay stays **mounted** (not unmounted) — all chat state, messages, and module selections are preserved
- Clicking anywhere on the minimized bar re-expands to full screen

### Minimized Bar Layout
```
┌──────────────────────────────────────────────┐
│ 🔨 LAMBA LAB   3 modules · 45%  ████░░░░  ↑ │
└──────────────────────────────────────────────┘
```
- Fixed `bottom: 1rem; right: 1rem; z-index: 50`
- Shows: brand name · module count · confidence % · mini progress bar · chevron-up icon
- Width: ~320px, height: ~48px, rounded-xl, brand-dark background

### Implementation
- Add `minimized: boolean` state to `IntakeOverlay`
- When `minimized === true`: hide main content with `hidden` class, render `<MinimizedBar>` component
- `MinimizedBar` receives `moduleCount`, `confidenceScore`, `onExpand` props
- No change to parent — `onMinimize` prop is removed and handled internally

---

## Section 2: Hardcoded Onboarding (3 Questions)

### Flow Change
- Landing page CTA no longer shows a text input — it opens the intake overlay directly
- User's idea (typed on landing) is stored but the AI receives it as background context
- The overlay starts with a 3-step onboarding sequence before AI chat begins

### Onboarding Steps

**Step 1 — Platform** (icon-cards, 2×2 grid)
```
[ 🌐 Web App ]      [ 📱 Mobile App ]
[ 🖥️ Both ]         [ 🤔 Not sure yet ]
```

**Step 2 — Product Type** (icon-cards, 2×2 grid)
```
[ 🛒 Marketplace ]   [ 💬 Social / Community ]
[ 🛠️ SaaS / Tool ]   [ 🎯 Something else ]
```

**Step 3 — Expected Scale** (pills, single-select)
```
[ 👤 Just me ]  [ 👥 <100 users ]  [ 🏢 1,000+ users ]  [ 🤷 Not sure ]
```

### Handoff to AI
After all 3 steps, the collected answers are bundled into the AI's first user message as structured context:

```
User idea: "I want to build an app that lets me sell with stories"
Platform: Web App
Product type: Marketplace
Scale: <100 users
```

The AI receives this and immediately begins the discovery conversation with rich quick replies.

### New Component: `OnboardingSteps`
- Lives inside `IntakeLayout` (rendered instead of chat until `onboardingComplete`)
- Tracks `step: 0 | 1 | 2` and collected answers
- On completion: calls `onComplete(context: OnboardingContext)` which triggers `sendMessage` with the bundled context

---

## Section 3: AI Quick Replies

### Tool Schema Update
The `update_proposal` tool gets a new optional `quick_replies` field:

```ts
quick_replies?: {
  style: 'list' | 'icon-cards' | 'pills'
  multiSelect?: boolean    // renders checkboxes + "Continue →" button
  allowCustom?: boolean    // appends "Type something else..." as last item
  options: Array<{
    label: string          // bold title (all styles)
    description?: string   // subtitle text (list style only)
    icon?: string          // emoji prefix
    value: string          // text sent as message when selected
  }>
}
```

### Three Rendering Modes

**`list`** — Exact AskUserQuestion style. Numbered badge on right, bold label, description below. Used for complex choices (monetization, auth model, features).

**`icon-cards`** — 2×2 (or 2×3) grid with large emoji + bold label. Used for platform and product type in onboarding and early AI questions.

**`pills`** — Compact inline chips. Used for binary or short-answer questions (timeline, scale, yes/no).

### Selection Behaviors

**Single-select (default):**
- Tapping an option immediately sends `option.value` as the user's next message
- Quick replies disappear after selection (replaced by the sent message bubble)

**Multi-select (`multiSelect: true`):**
- Checkboxes render on the left of each item
- "Type something else..." row (if `allowCustom`) reveals inline text input when tapped
- A **"Continue →"** button appears after ≥1 selection
- Sends all selected values as comma-joined string: *"iOS, Android, tablet"*

**Custom input (`allowCustom: true` only):**
- Last item is always "Type something else..." with number badge
- Tapping it reveals an inline `<input>` below the options
- Submits on Enter or a send button
- Works in both single and multi-select modes

### MessageBubble Update
`ChatMessage` type adds `quickReplies?: QuickReplies` field. `MessageBubble` renders the appropriate reply UI below the message text. Once an option is selected, `quickReplies` is cleared on that message so only the most recent question shows options.

### System Prompt Update
Claude is instructed to:
1. Always include `quick_replies` on every response
2. Choose `style` based on question complexity (`list` for nuanced, `pills` for simple)
3. Use `multiSelect: true` for "which features do you need?" type questions
4. Always include `allowCustom: true` unless the options are exhaustive
5. Keep option labels short and scannable (≤5 words for label, ≤12 words for description)

---

## Files Affected

| File | Change |
|------|--------|
| `components/intake/IntakeOverlay.tsx` | Add `minimized` state + `MinimizedBar` component |
| `components/intake/MinimizedBar.tsx` | New component |
| `components/intake/OnboardingSteps.tsx` | New component (3-step onboarding) |
| `components/intake/IntakeLayout.tsx` | Render `OnboardingSteps` before chat |
| `components/intake/MessageBubble.tsx` | Render `QuickReplies` UI below message |
| `components/intake/QuickReplies.tsx` | New component (list/icon-cards/pills) |
| `hooks/useIntakeChat.ts` | Add `quickReplies` to `ChatMessage` type; clear after selection |
| `lib/ai/tools.ts` | Add `quick_replies` field to `update_proposal` tool schema |
| `lib/ai/system-prompt.ts` | Update instructions for quick_replies usage |
| `app/page.tsx` | Remove text input from CTA; open overlay directly |

---

## Out of Scope
- Persisting onboarding answers to Supabase (in-memory only for Stage 1)
- Animations between onboarding steps (basic show/hide is sufficient)
- Dark/light theme for quick reply cards
