# Chat Onboarding Redesign

**Date:** 2026-03-13
**Status:** Approved

## Summary

Four changes to the intake experience:
1. Move the 3-step onboarding into the chat as seamless message bubbles
2. Fix minimize/restore resetting the chat state
3. Replace Step 3 "scale" question with a business-intent question
4. Hide per-module price ranges until confidence threshold is met

---

## Change 1: Onboarding-in-Chat

### Problem
The current `OnboardingSteps` component replaces the entire overlay with a full-screen flow. It feels like a separate modal, not a conversation.

### Design
Remove `OnboardingSteps.tsx`. Move the 3 hardcoded questions into `useIntakeChat` as the initial state of the `messages` array. The full chat layout (with right column) is visible from the first screen.

**New `useIntakeChat` behaviour:**
- Internal `onboardingStep: 0 | 1 | 2 | 3` state (starts at 0)
- `messages` initialises with Q1 already in the array as an assistant message with `quickReplies` attached
- While `onboardingStep < 3`, `sendMessage` is intercepted locally:
  - Append user message to `messages`
  - Clear `quickReplies` from the previous assistant message
  - Append next hardcoded question as a new assistant message
  - Advance `onboardingStep`
- When `onboardingStep === 3` (all answered), bundle context and send to AI as the real first message

**Hardcoded questions:**

| Step | Question | Style |
|------|----------|-------|
| 0 | What platform are you building for? | icon-cards |
| 1 | What type of product is this? | icon-cards |
| 2 | What's the goal for this product? | icon-cards |

**Step 2 options (new):**
- 🚀 Launch a startup → `'Launch a startup'`
- 🏢 Grow my existing business → `'Grow my existing business'`
- 🛠️ Build a tool for my team → `'Build a tool for my team'`
- 🎯 Something else → `'Other'`

**`OnboardingContext` type update:**
- Rename `scale: string` → `goal: string`
- Update `bundleOnboardingContext` to use `goal` instead of `scale`
- Update label in output from `Expected scale:` → `Goal:`

**Files changed:**
- `hooks/useIntakeChat.ts` — add onboarding state machine
- `lib/intake-types.ts` — rename `scale` → `goal` in `OnboardingContext`
- `lib/intake-utils.ts` — update `bundleOnboardingContext`
- `components/intake/IntakeLayout.tsx` — remove onboarding state, always render chat layout
- `components/intake/OnboardingSteps.tsx` — delete
- `__tests__/intake-utils.test.ts` — update tests for `goal` rename

---

## Change 2: Minimize State Persistence

### Problem
`IntakeOverlay` does `if (minimized) return <MinimizedBar>` — completely unmounts `IntakeLayout` and `useIntakeChat`, destroying all chat state on minimize.

### Design
Keep `IntakeLayout` mounted at all times. Use CSS `hidden` to visually hide it when minimized:

```tsx
{/* Always mounted — preserves all chat state */}
<div className={minimized ? 'hidden' : 'flex-1 flex flex-col overflow-hidden'}>
  <IntakeLayout ... />
</div>

{/* Show bar when minimized */}
{minimized && <MinimizedBar ... />}
```

Tailwind `hidden` = `display: none`. The component tree stays alive; React does not re-render it. Expanding restores the exact chat state.

**Files changed:**
- `components/intake/IntakeOverlay.tsx` — replace conditional unmount with CSS hide

---

## Change 3: Step 3 Business Intent (covered in Change 1)

Replacing "What's the expected scale?" (scale-focused, hobbyist-adjacent) with "What's the goal for this product?" (business-focused). Options signal professional intent: startup, business growth, team tooling.

---

## Change 4: Per-Module Price Hiding

### Problem
`ModuleCard` always shows individual module prices (`$1,000–$2,500`). Only the total estimate panel respects the `pricingVisible` flag. This reveals ballpark numbers before the AI has enough context to be accurate.

### Design
Pass `pricingVisible` into `ModuleCard`. When `false`, show a blurred placeholder instead of real numbers.

**Locked state UI:**
- Price text replaced with `blur-sm select-none` styled `$─ ─ ─` placeholder
- Subtle lock icon (🔒) or "Keep chatting to unlock" label below

**Unlocked state:** existing price range display, unchanged.

`pricingVisible` is already computed by `isPricingVisible(confidenceScore)` in `IntakeLayout` and passed to `ModulesPanel`. Extend it one level deeper to each `ModuleCard`.

**Files changed:**
- `components/intake/ModuleCard.tsx` — accept `pricingVisible` prop, render locked/unlocked state
- `components/intake/ModulesPanel.tsx` — pass `pricingVisible` into each `ModuleCard`

---

## Out of Scope
- Stage question ("What stage are you at?") — to be added to the AI's question bank in a future session, not hardcoded
- Admin-approval price gate — future option; current implementation uses confidence threshold
