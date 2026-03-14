# Design: Overlay Close Button & Landing Input Clear on Reset

**Date:** 2026-03-14

## Problem

Two UX gaps after the v4 intake refactor:

1. **Landing input not cleared on reset** — after confirming Reset, the old idea text persists in the `HeroSection` input on the landing page behind the overlay. When the user minimizes after resetting, they see stale text.

2. **No close path from blank state** — after reset, the overlay is empty but the only button to leave is `–` (minimize), which keeps the MinimizedBar visible in the corner. There's no way to fully dismiss back to a clean landing page.

## Design

### Feature 1: Clear landing input on reset

**Signal flow:** `IntakeOverlay` → `HeroSection`

Add `onReset?: () => void` prop to `IntakeOverlay`. When reset is confirmed (the `handleResetClick` Yes path), call `onReset?.()` after the existing reset logic.

`HeroSection` provides:
```typescript
onReset={() => {
  setInitialMessage('')
  setHeroInputResetKey(k => k + 1)   // force-remounts HeroInput, clearing its textarea
}}
```

`heroInputResetKey` is a new `useState<number>(0)` in `HeroSection`, passed as `key` to `HeroInput`:
```tsx
<HeroInput key={heroInputResetKey} onFirstMessage={handleFirstMessage} />
```

This force-remounts `HeroInput`, clearing its internal textarea state without making it controlled.

---

### Feature 2: – → X when blank; X closes everything

**Condition:** `currentIdea === ''` in `IntakeOverlay` (already tracks blank state post-reset)

**Behavior:**
- `currentIdea !== ''` → `<Minus />` icon, `onClick={setMinimized(true)}` — unchanged
- `currentIdea === ''` → `<X />` icon, `onClick={onClose?.()}` — new

Add `onClose?: () => void` prop to `IntakeOverlay`. `HeroSection` provides:
```typescript
onClose={() => {
  setIntakeOpen(false)
  setInitialMessage('')
  setHeroInputResetKey(k => k + 1)
}}
```

Setting `intakeOpen = false` unmounts `IntakeOverlay` entirely — including its `MinimizedBar` child — so the minimized bar disappears automatically. Landing page is fully clean.

**Import change:** Add `X` to lucide-react imports in `IntakeOverlay`.

---

## Full UX Flow After This Change

1. User types idea on landing page → overlay opens
2. User chats (– button is visible)
3. User clicks Reset → Yes → chat clears, `currentIdea = ''`, landing input clears
4. – button becomes X
5. User clicks X → `intakeOpen = false` → overlay + MinimizedBar unmount → clean landing page with blank input

---

## Files Changed

| File | Change |
|------|--------|
| `components/intake/IntakeOverlay.tsx` | Add `onClose`, `onReset` props; conditional X/Minus button; call `onReset` on confirmed reset; import `X` from lucide-react |
| `components/landing/HeroSection.tsx` | Add `heroInputResetKey` state; provide `onReset` and `onClose` to `IntakeOverlay`; pass `key={heroInputResetKey}` to `HeroInput` |

**Not changed:** `HeroInput.tsx`, `IntakeLayout.tsx`, `useIntakeChat.ts`, `MinimizedBar.tsx`

---

## Verification

1. Type idea → submit → overlay opens
2. Chat for a few turns
3. Click Reset → Yes → verify:
   - Chat is blank ✓
   - – has become X ✓
   - Minimize overlay → landing page input is empty ✓
4. From blank overlay, click X → verify:
   - Overlay unmounts ✓
   - MinimizedBar gone ✓
   - Landing page input is blank ✓
   - Can type a new idea and start fresh ✓
