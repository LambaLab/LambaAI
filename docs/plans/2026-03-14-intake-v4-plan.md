# Intake v4 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the 3-question hardcoded onboarding gate with an AI-first conversation that auto-sends the user's idea and asks one smart contextual follow-up, and fix the Reset bug that re-injects Q1 instead of clearing the chat.

**Architecture:** Remove `ONBOARDING_QUESTIONS` and all branching in `useIntakeChat`. On mount, a `useEffect` fires once to auto-send the idea as the first user message — Claude then acknowledges, infers, and asks one focused follow-up. `IntakeOverlay` converts its `initialMessage` prop into local state so Reset can clear it, preventing ghost re-sends. `ChatPanel` gets a dynamic placeholder. The system prompt gains two new sections: Turn 1 handling and Off-topic handling.

**Tech Stack:** Next.js 15 App Router, React, TypeScript, Tailwind CSS v4, Anthropic SDK (Claude streaming), Supabase

---

## Task 1: Remove onboarding gate from `useIntakeChat.ts`

**Files:**
- Modify: `hooks/useIntakeChat.ts`

This is the core task. We delete everything onboarding-related and simplify the hook to a single-phase AI conversation.

---

### Step 1: Delete `ONBOARDING_QUESTIONS` constant and onboarding state

Open `hooks/useIntakeChat.ts`. Delete lines 34–71 (the entire `ONBOARDING_QUESTIONS` array).

Delete the `bundleOnboardingContext` import on line 6:
```diff
- import { bundleOnboardingContext } from '@/lib/intake-utils'
```

Change the initial `messages` state from `[Q1]` to `[]`, and delete `onboardingStep` and `onboardingAnswers` state:

```diff
- const [messages, setMessages] = useState<ChatMessage[]>([
-   {
-     id: 'onboarding-0',
-     role: 'assistant',
-     content: ONBOARDING_QUESTIONS[0].content,
-     quickReplies: ONBOARDING_QUESTIONS[0].quickReplies,
-   },
- ])
- const [onboardingStep, setOnboardingStep] = useState(0)
- const [onboardingAnswers, setOnboardingAnswers] = useState<string[]>([])
+ const [messages, setMessages] = useState<ChatMessage[]>([])
```

The `activeModules`, `confidenceScore`, `complexityMultiplier`, `priceRange`, `isStreaming`, `productOverview` states remain unchanged.

---

### Step 2: Replace `sendMessage` — remove onboarding branch

The current `sendMessage` has two phases separated by `if (onboardingStep < 3)`. Delete that entire block. The new `sendMessage` is always the "normal AI phase":

Replace the entire `sendMessage` function with:

```typescript
const sendMessage = useCallback(async (content: string) => {
  if (isStreaming) return

  const userMessage: ChatMessage = { id: crypto.randomUUID(), role: 'user', content }

  const apiMessages: ApiMessage[] = [
    ...messagesRef.current.map((m): ApiMessage => ({ role: m.role, content: m.content })),
    { role: 'user', content },
  ]

  setMessages((prev) => {
    // Clear quickReplies from last assistant message
    const cleared = prev.map((m, i) =>
      i === prev.length - 1 && m.role === 'assistant' ? { ...m, quickReplies: undefined } : m
    )
    return [...cleared, userMessage]
  })

  await streamAIResponse(apiMessages)
}, [isStreaming]) // eslint-disable-line react-hooks/exhaustive-deps
```

---

### Step 3: Simplify `editMessage` — remove onboarding detection

The current `editMessage` has a block that checks `onboardingUserMessages` and resets to an onboarding step. Delete everything from `// Determine which onboarding index` down to the `if (onboardingUserIndex !== -1) { ... return }` block.

Replace the entire `editMessage` function with:

```typescript
const editMessage = useCallback(async (messageId: string, newContent: string) => {
  if (isStreaming) return

  const msgIndex = messagesRef.current.findIndex((m) => m.id === messageId)
  if (msgIndex === -1) return
  if (msgIndex === 0) return // Safety: never edit the very first message

  const correctionMsg: ChatMessage = {
    id: crypto.randomUUID(),
    role: 'user',
    content: `Actually, let me clarify my earlier answer: ${newContent}`,
  }

  const kept = messagesRef.current.slice(0, msgIndex)
  setMessages([...kept, correctionMsg])

  const aiHistory = [...kept, correctionMsg].map(
    (m): ApiMessage => ({ role: m.role, content: m.content })
  )

  await streamAIResponse(aiHistory)
}, [isStreaming]) // eslint-disable-line react-hooks/exhaustive-deps
```

---

### Step 4: Fix `reset()` — blank slate instead of re-injecting Q1

Replace the current `reset` function:

```diff
- const reset = useCallback(() => {
-   const initialMessages: ChatMessage[] = [
-     {
-       id: 'onboarding-0',
-       role: 'assistant',
-       content: ONBOARDING_QUESTIONS[0].content,
-       quickReplies: ONBOARDING_QUESTIONS[0].quickReplies,
-     },
-   ]
-   // Reset refs synchronously
-   messagesRef.current = initialMessages
-   confidenceRef.current = 0
-   activeModulesRef.current = []
-   complexityRef.current = 1.0
-   // Reset state
-   setMessages(initialMessages)
-   setOnboardingStep(0)
-   setOnboardingAnswers([])
-   setActiveModules([])
-   setConfidenceScore(0)
-   setComplexityMultiplier(1.0)
-   setPriceRange({ min: 0, max: 0 })
-   setIsStreaming(false)
-   setProductOverview('')
- }, [])

+ const reset = useCallback(() => {
+   // Reset refs synchronously
+   messagesRef.current = []
+   confidenceRef.current = 0
+   activeModulesRef.current = []
+   complexityRef.current = 1.0
+   // Reset state — blank slate
+   setMessages([])
+   setActiveModules([])
+   setConfidenceScore(0)
+   setComplexityMultiplier(1.0)
+   setPriceRange({ min: 0, max: 0 })
+   setIsStreaming(false)
+   setProductOverview('')
+ }, [])
```

---

### Step 5: Add auto-send `useEffect` on mount

Add this effect after the existing sync effects (the four `useEffect` hooks that sync state to refs). It fires once on mount and auto-sends the `idea` as the first user message:

```typescript
// Auto-send the idea on mount (fires once)
useEffect(() => {
  if (!idea.trim()) return

  const userMessage: ChatMessage = { id: crypto.randomUUID(), role: 'user', content: idea }
  messagesRef.current = [userMessage]
  setMessages([userMessage])

  streamAIResponse([{ role: 'user', content: idea }])
}, []) // eslint-disable-line react-hooks/exhaustive-deps
```

> **Why `[]` deps?** We intentionally want this to fire once only at mount, not on every re-render. `idea` is stable (it's from the landing page input). The eslint-disable comment prevents warnings.

---

### Step 6: Update the return type — remove `onboardingStep`

The current return includes `onboardingStep`. Remove it:

```diff
- return { messages, activeModules, confidenceScore, priceRange, isStreaming, sendMessage, toggleModule, productOverview, onboardingStep, editMessage, reset }
+ return { messages, activeModules, confidenceScore, priceRange, isStreaming, sendMessage, toggleModule, productOverview, editMessage, reset }
```

---

### Step 7: Verify the file compiles cleanly

Run the TypeScript compiler:
```bash
cd "/Users/nagi/Downloads/Lamba Lab/Lamba Lab app" && npx tsc --noEmit 2>&1 | head -50
```

Expected: No errors in `hooks/useIntakeChat.ts`. If `onboardingStep` is referenced somewhere else, the compiler will tell you — fix those usages.

---

### Step 8: Commit

```bash
cd "/Users/nagi/Downloads/Lamba Lab/Lamba Lab app"
git add hooks/useIntakeChat.ts
git commit -m "feat(intake): remove onboarding gate, add auto-send effect, fix reset"
```

---

## Task 2: Update system prompt — Turn 1 and off-topic handling

**Files:**
- Modify: `lib/ai/system-prompt.ts`

---

### Step 1: Add the Turn 1 handling section

Open `lib/ai/system-prompt.ts`. Locate the `## Your Job Each Turn` section (around line 27). Insert a new section **before** it:

```diff
+ ## First Turn (Idea as First Message)
+ When the conversation has only one user message and no prior AI turns:
+ 1. Acknowledge in 1 sentence what you inferred (platform, product type, key domain — e.g. "Love this — sounds like a mobile marketplace for peer-to-peer selling.")
+ 2. Share one PM insight showing you understand their domain (builds trust, shows expertise)
+ 3. Ask the ONE question that matters most given what's still unknown
+ Do NOT ask about things you can already infer from their message.
+ Do NOT ask a generic follow-up — make it specific to their idea.
+
```

The section goes after `## PM Discovery Skills` and before `## Available Modules`. Add it as a new `##` heading.

---

### Step 2: Add the off-topic handling section

Add this section **after** the `## Brief Rules` section (the last section before "Remember:"):

```diff
+ ## Off-Topic Messages
+ If the user's message has nothing to do with building a software or digital product:
+ - Respond warmly and briefly redirect: "Ha — that's a bit outside my lane! I help teams scope out software products. Do you have a digital product idea in mind?"
+ - Set detected_modules: [], confidence_score_delta: 0, product_overview: ''
+ If the message is ambiguous (physical thing that might have a digital component — e.g. "I want to build a building"):
+ - Ask: "Interesting — is there a software side to this? Like a building management system, a property marketplace, or a tenant-facing app?"
+ Never be dismissive. Stay warm and curious.
+
```

---

### Step 3: Review the full prompt for coherence

Read the entire `SYSTEM_PROMPT` string to make sure the new sections flow naturally. The order should be:

1. Personality
2. PM Discovery Skills
3. **First Turn (new)**
4. Available Modules
5. Your Job Each Turn
6. Quick Replies
7. Handling "__recommend__"
8. Confidence Score Rules
9. Module Detection Rules
10. Product Overview Rules
11. Brief Rules
12. **Off-Topic Messages (new)**
13. Remember

---

### Step 4: Commit

```bash
cd "/Users/nagi/Downloads/Lamba Lab/Lamba Lab app"
git add lib/ai/system-prompt.ts
git commit -m "feat(intake): add turn-1 and off-topic handling to system prompt"
```

---

## Task 3: Dynamic placeholder in `ChatPanel.tsx`

**Files:**
- Modify: `components/intake/ChatPanel.tsx`

---

### Step 1: Add dynamic placeholder

The `messages` prop is already available in `ChatPanel`. Change line 73:

```diff
- placeholder="Tell me more..."
+ placeholder={messages.length === 0 ? "Describe the idea you want to build..." : "Tell me more..."}
```

That's the only change needed. `messages` is already in scope from props.

---

### Step 2: Verify no TypeScript errors

```bash
cd "/Users/nagi/Downloads/Lamba Lab/Lamba Lab app" && npx tsc --noEmit 2>&1 | head -30
```

Expected: No new errors.

---

### Step 3: Commit

```bash
cd "/Users/nagi/Downloads/Lamba Lab/Lamba Lab app"
git add components/intake/ChatPanel.tsx
git commit -m "feat(intake): dynamic chat input placeholder based on message count"
```

---

## Task 4: Convert `initialMessage` to local state in `IntakeOverlay.tsx`

**Files:**
- Modify: `components/intake/IntakeOverlay.tsx`

This is the reset bug fix at the overlay level. After reset, the `initialMessage` prop is still set to the original idea, so if the overlay re-renders, `IntakeLayout` would receive the old idea and `useIntakeChat`'s auto-send effect would fire again. Converting to local state and clearing it on reset prevents this ghost re-send.

---

### Step 1: Add `currentIdea` local state

At the top of the component, after the `useTheme` import, add:

```diff
+ import { useState } from 'react' // already imported — check, don't duplicate
```

Add this state declaration right after the existing state declarations (line ~16):

```diff
  const [session, setSession] = useState<SessionData | null>(null)
  const [sessionError, setSessionError] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [minimized, setMinimized] = useState(false)
  const [liveModuleCount, setLiveModuleCount] = useState(0)
  const [liveConfidenceScore, setLiveConfidenceScore] = useState(0)
+ const [currentIdea, setCurrentIdea] = useState(initialMessage)
```

> `useState(initialMessage)` initializes from the prop once. After that, `currentIdea` is independent — clearing it on reset doesn't affect the original prop.

---

### Step 2: Clear `currentIdea` on confirmed reset

In `handleResetClick`, after `resetRef.current?.()`, add `setCurrentIdea('')`:

```diff
  // Confirmed: clear timer first
  if (resetConfirmTimerRef.current) clearTimeout(resetConfirmTimerRef.current)
  // Call reset + clear session
  resetRef.current?.()
+ setCurrentIdea('')
  setResetConfirm(false)
  sessionStorage.removeItem('lamba_session')
  setSession(null)
  getOrCreateSession().then(setSession).catch(() => setSessionError(true))
```

---

### Step 3: Pass `currentIdea` to `IntakeLayout`

In the JSX, update the `IntakeLayout` usage:

```diff
  <IntakeLayout
    proposalId={session.proposalId}
-   initialMessage={initialMessage}
+   initialMessage={currentIdea}
    onStateChange={handleStateChange}
    onResetRef={resetRef}
    theme={theme}
  />
```

---

### Step 4: Verify TypeScript

```bash
cd "/Users/nagi/Downloads/Lamba Lab/Lamba Lab app" && npx tsc --noEmit 2>&1 | head -30
```

Expected: No errors.

---

### Step 5: Commit

```bash
cd "/Users/nagi/Downloads/Lamba Lab/Lamba Lab app"
git add components/intake/IntakeOverlay.tsx
git commit -m "fix(intake): convert initialMessage to local state to prevent ghost re-send on reset"
```

---

## Task 5: Clean up `lib/intake-utils.ts` and `lib/intake-types.ts`

**Files:**
- Modify: `lib/intake-utils.ts`
- Modify: `lib/intake-types.ts`

---

### Step 1: Delete `bundleOnboardingContext` from `intake-utils.ts`

The file currently has two exports. Delete `bundleOnboardingContext` and its import. The file should become:

```typescript
export function serializeMultiSelect(values: string[]): string {
  return values.join(', ')
}
```

Also delete line 1 (`import type { OnboardingContext } from './intake-types'`) since that import is only needed for `bundleOnboardingContext`.

---

### Step 2: Delete `OnboardingContext` from `intake-types.ts`

Delete lines 15–20 (the `OnboardingContext` type). The file should become:

```typescript
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
```

---

### Step 3: Verify no dangling references

Run a grep to confirm nothing else imports `OnboardingContext` or `bundleOnboardingContext`:

```bash
cd "/Users/nagi/Downloads/Lamba Lab/Lamba Lab app"
grep -r "OnboardingContext\|bundleOnboardingContext" --include="*.ts" --include="*.tsx" .
```

Expected: No results. If any appear, remove those references too.

---

### Step 4: Verify TypeScript

```bash
cd "/Users/nagi/Downloads/Lamba Lab/Lamba Lab app" && npx tsc --noEmit 2>&1 | head -30
```

Expected: No errors.

---

### Step 5: Commit

```bash
cd "/Users/nagi/Downloads/Lamba Lab/Lamba Lab app"
git add lib/intake-utils.ts lib/intake-types.ts
git commit -m "chore(intake): delete bundleOnboardingContext and OnboardingContext (no longer used)"
```

---

## Task 6: Manual verification

**No files changed — this is a verification-only task.**

---

### Step 1: Start the dev server

```bash
cd "/Users/nagi/Downloads/Lamba Lab/Lamba Lab app" && npm run dev
```

---

### Step 2: Test the happy path

1. Open the app at `http://localhost:3000`
2. Type an idea in the landing page input: `"I want to build a mobile app that helps people sell"`
3. Click Submit (or press Enter)
4. The overlay opens
5. **Expected:** Left panel shows your message bubble immediately, then the AI streams a response that:
   - Acknowledges what it understood (mobile, selling/marketplace)
   - Asks ONE smart follow-up question
   - Shows quick reply options
6. Continue the conversation — confirm it feels like a PM discovery call, not a form

---

### Step 3: Test off-topic input

1. Reload the page
2. Type: `"How is the weather?"`
3. **Expected:** AI responds warmly but redirects — no hard errors

---

### Step 4: Test the reset fix

1. Have a conversation with a few turns
2. Click `↺ Reset`
3. Confirm dialog appears ("Start over?")
4. Click Yes
5. **Expected:** Left panel goes completely blank — only the input field is visible
6. Input placeholder says `"Describe the idea you want to build..."`
7. Type a new idea — a fresh conversation starts

---

### Step 5: Test edit message

1. Have a conversation with at least 2 user turns
2. Hover over an earlier user message — the edit pencil appears
3. Click it, change the text, submit
4. **Expected:** Correction message appears (`"Actually, let me clarify..."`) and AI responds to the corrected context

---

### Step 6: Final commit if any polish edits were made

```bash
cd "/Users/nagi/Downloads/Lamba Lab/Lamba Lab app"
git add -p  # stage only what you changed
git commit -m "fix(intake): polish from manual verification"
```

---

## Summary of all changed files

| File | Change |
|------|--------|
| `hooks/useIntakeChat.ts` | Delete onboarding gate, initial messages, onboardingStep/Answers state; add auto-send effect; simplify sendMessage and editMessage; fix reset to `[]` |
| `lib/ai/system-prompt.ts` | Add "First Turn" and "Off-Topic Messages" sections |
| `components/intake/ChatPanel.tsx` | Dynamic placeholder based on `messages.length` |
| `components/intake/IntakeOverlay.tsx` | Convert `initialMessage` to `currentIdea` local state; clear on reset |
| `lib/intake-utils.ts` | Delete `bundleOnboardingContext` |
| `lib/intake-types.ts` | Delete `OnboardingContext` |

**Files NOT changed:** `IntakeLayout.tsx`, `ModulesPanel.tsx`, `MessageBubble.tsx`, `AuthGateModal.tsx`, `ConfidenceBar.tsx`, pricing engine, magic link auth, Supabase layer
