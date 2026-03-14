# Overlay Close Button & Landing Input Clear Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** When reset is confirmed, clear the landing page input and turn the minimize (–) button into a close (✕) button that fully dismisses the overlay.

**Architecture:** Add `onReset` and `onClose` callback props to `IntakeOverlay`. `HeroSection` provides both. `onReset` clears `initialMessage` and increments a `heroInputResetKey` counter (which force-remounts `HeroInput`, clearing its internal textarea). `onClose` additionally sets `intakeOpen = false`, which unmounts `IntakeOverlay` entirely — including its `MinimizedBar` child. In `IntakeOverlay`, the minimize button conditionally renders `<X />` and calls `onClose` when `currentIdea === ''` (blank state post-reset), and `<Minus />` + minimize otherwise.

**Tech Stack:** Next.js 15 App Router, React, TypeScript, lucide-react

---

## Task 1: Update `IntakeOverlay.tsx` — add props, X button, onReset call

**Files:**
- Modify: `components/intake/IntakeOverlay.tsx`

### Step 1: Add `X` to lucide-react import

Current line 4:
```typescript
import { Minus, Sun, Moon } from 'lucide-react'
```

Change to:
```typescript
import { Minus, Sun, Moon, X } from 'lucide-react'
```

---

### Step 2: Add `onReset` and `onClose` to the Props type

Current `Props` (lines 10–12):
```typescript
type Props = {
  initialMessage: string
}
```

Change to:
```typescript
type Props = {
  initialMessage: string
  onReset?: () => void
  onClose?: () => void
}
```

---

### Step 3: Destructure the new props in the component signature

Current line 14:
```typescript
export default function IntakeOverlay({ initialMessage }: Props) {
```

Change to:
```typescript
export default function IntakeOverlay({ initialMessage, onReset, onClose }: Props) {
```

---

### Step 4: Call `onReset` in the confirmed-reset path

In `handleResetClick`, the confirmed path currently ends at line 76:
```typescript
    getOrCreateSession().then(setSession).catch(() => setSessionError(true))
  }
```

Add `onReset?.()` as the last line before the closing brace:
```typescript
    getOrCreateSession().then(setSession).catch(() => setSessionError(true))
    onReset?.()
  }
```

The full confirmed path (for reference) becomes:
```typescript
  // Confirmed: clear timer first
  if (resetConfirmTimerRef.current) clearTimeout(resetConfirmTimerRef.current)
  // Call reset + clear session
  resetRef.current?.()
  setCurrentIdea('')
  setResetConfirm(false)
  sessionStorage.removeItem('lamba_session')
  setSession(null)
  getOrCreateSession().then(setSession).catch(() => setSessionError(true))
  onReset?.()
```

---

### Step 5: Replace the minimize button with a conditional X / Minus button

Current minimize button (lines 147–153):
```typescript
              <button
                onClick={() => setMinimized(true)}
                className="w-8 h-8 rounded-lg bg-[var(--ov-surface-subtle,rgba(255,255,255,0.05))] hover:bg-[var(--ov-input-bg,rgba(255,255,255,0.10))] flex items-center justify-center text-[var(--ov-text-muted,#727272)] hover:text-[var(--ov-text,#ffffff)] transition-colors"
                aria-label="Minimize"
              >
                <Minus className="w-4 h-4" />
              </button>
```

Replace with:
```typescript
              <button
                onClick={currentIdea === '' ? onClose : () => setMinimized(true)}
                className="w-8 h-8 rounded-lg bg-[var(--ov-surface-subtle,rgba(255,255,255,0.05))] hover:bg-[var(--ov-input-bg,rgba(255,255,255,0.10))] flex items-center justify-center text-[var(--ov-text-muted,#727272)] hover:text-[var(--ov-text,#ffffff)] transition-colors"
                aria-label={currentIdea === '' ? 'Close' : 'Minimize'}
              >
                {currentIdea === '' ? <X className="w-4 h-4" /> : <Minus className="w-4 h-4" />}
              </button>
```

---

### Step 6: Verify TypeScript

```bash
cd "/Users/nagi/Downloads/Lamba Lab/Lamba Lab app" && export PATH="/Users/nagi/.nvm/versions/node/v24.13.1/bin:$PATH" && npx tsc --noEmit 2>&1
```

Expected: no output (clean).

---

### Step 7: Commit

```bash
cd "/Users/nagi/Downloads/Lamba Lab/Lamba Lab app"
git add components/intake/IntakeOverlay.tsx
git commit -m "feat(intake): add onClose/onReset props, X button when blank, notify parent on reset"
```

---

## Task 2: Update `HeroSection.tsx` — provide callbacks, key HeroInput

**Files:**
- Modify: `components/landing/HeroSection.tsx`

### Step 1: Add `heroInputResetKey` state

Current state declarations (lines 8–9):
```typescript
  const [intakeOpen, setIntakeOpen] = useState(false)
  const [initialMessage, setInitialMessage] = useState('')
```

Add `heroInputResetKey`:
```typescript
  const [intakeOpen, setIntakeOpen] = useState(false)
  const [initialMessage, setInitialMessage] = useState('')
  const [heroInputResetKey, setHeroInputResetKey] = useState(0)
```

---

### Step 2: Add `handleReset` and `handleClose` functions

Add these two functions after `handleFirstMessage` (after line 14):

```typescript
  function handleReset() {
    setInitialMessage('')
    setHeroInputResetKey((k) => k + 1)
  }

  function handleClose() {
    setIntakeOpen(false)
    setInitialMessage('')
    setHeroInputResetKey((k) => k + 1)
  }
```

---

### Step 3: Pass `key` to `HeroInput` to enable force-remount on reset

Current `HeroInput` usage (line 39):
```typescript
          <HeroInput onFirstMessage={handleFirstMessage} />
```

Change to:
```typescript
          <HeroInput key={heroInputResetKey} onFirstMessage={handleFirstMessage} />
```

> `HeroInput` manages its own `value` state internally and does not clear on submit. Incrementing `heroInputResetKey` force-remounts `HeroInput`, resetting its textarea to empty.

---

### Step 4: Pass `onReset` and `onClose` to `IntakeOverlay`

Current `IntakeOverlay` usage (lines 43–47):
```typescript
      {intakeOpen && (
        <IntakeOverlay
          initialMessage={initialMessage}
        />
      )}
```

Change to:
```typescript
      {intakeOpen && (
        <IntakeOverlay
          initialMessage={initialMessage}
          onReset={handleReset}
          onClose={handleClose}
        />
      )}
```

---

### Step 5: Verify TypeScript

```bash
cd "/Users/nagi/Downloads/Lamba Lab/Lamba Lab app" && export PATH="/Users/nagi/.nvm/versions/node/v24.13.1/bin:$PATH" && npx tsc --noEmit 2>&1
```

Expected: no output (clean).

---

### Step 6: Commit

```bash
cd "/Users/nagi/Downloads/Lamba Lab/Lamba Lab app"
git add components/landing/HeroSection.tsx
git commit -m "feat(landing): clear HeroInput and close overlay on reset/close callbacks"
```

---

## Task 3: Manual verification + deploy

### Step 1: Start dev server

```bash
cd "/Users/nagi/Downloads/Lamba Lab/Lamba Lab app" && export PATH="/Users/nagi/.nvm/versions/node/v24.13.1/bin:$PATH" && npm run dev
```

### Step 2: Test reset → input cleared

1. Type idea on landing page → Submit → overlay opens
2. Chat for at least one turn
3. Click ↺ Reset → confirm Yes
4. **Expected:**
   - Chat goes blank ✓
   - `–` button becomes `✕` ✓
   - Click `–` on top bar to minimize
   - Landing page input is **empty** ✓

### Step 3: Test X button closes everything

1. Type idea → Submit → overlay opens
2. Click Reset → Yes → blank overlay
3. Click `✕` button
4. **Expected:**
   - Overlay unmounts ✓
   - MinimizedBar is gone ✓
   - Landing page is clean with empty input ✓
   - Can type a new idea and start fresh ✓

### Step 4: Test minimize without reset (should NOT clear input)

1. Type idea → Submit → overlay opens
2. Click `–` (without resetting) → overlay minimizes
3. **Expected:**
   - MinimizedBar visible bottom-right ✓
   - Landing page input is **still empty** (it was cleared on submit — correct) ✓
   - MinimizedBar click expands overlay ✓

### Step 5: Deploy

```bash
cd "/Users/nagi/Downloads/Lamba Lab/Lamba Lab app" && export PATH="/Users/nagi/.nvm/versions/node/v24.13.1/bin:$PATH" && npx vercel --prod --yes 2>&1
```

Expected: `Aliased: https://lamba-ai-tau.vercel.app`
