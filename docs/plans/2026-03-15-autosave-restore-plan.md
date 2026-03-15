# Auto-Save + Return Link — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** After email verification, automatically persist chat messages to Supabase on every turn, and let users return to their full conversation on any device via their unique `?c=<proposalId>` link — no re-auth required.

**Architecture:** Messages currently live only in localStorage. After OTP success, all existing messages are batch-written to `chat_messages` in Supabase and localStorage flags mark the session as synced. Subsequent turns auto-append. On cross-device return, `HeroSection` detects no localStorage match, calls a restore endpoint, hydrates localStorage with the full conversation, and opens the overlay as normal.

**Tech Stack:** Next.js App Router, Supabase (service client), TypeScript, Vitest

---

## Key localStorage keys (read these before touching anything)

| Key | Purpose |
|-----|---------|
| `lamba_session` | `{ sessionId, proposalId, userId }` — session identity |
| `lamba_msgs_<proposalId>` | `ChatMessage[]` — full chat history |
| `lamba_proposal_<proposalId>` | `{ activeModules, confidenceScore, complexityMultiplier, productOverview, moduleSummaries, projectName }` |
| `lamba_idea_<proposalId>` | original idea string |
| `lamba_email_verified_<proposalId>` | `"1"` if OTP was successfully verified |
| `lamba_synced_count_<proposalId>` | number of messages already synced to Supabase |

The last two keys are NEW — they don't exist yet. You'll add them in Tasks 3 and 4.

---

## Task 1: `POST /api/intake/sync-messages` route

**Files:**
- Create: `app/api/intake/sync-messages/route.ts`

### Step 1: Create the route

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

type MessageInput = { role: 'user' | 'assistant'; content: string }

export async function POST(req: NextRequest) {
  const { proposalId, sessionId, messages } = await req.json()

  if (!proposalId || !sessionId || !Array.isArray(messages)) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }

  const supabase = createServiceClient()

  // Validate ownership — same pattern as send-otp
  const { data: proposal } = await supabase
    .from('proposals')
    .select('id')
    .eq('id', proposalId)
    .eq('session_id', sessionId)
    .single()

  if (!proposal) {
    return NextResponse.json({ error: 'Invalid proposal or session' }, { status: 404 })
  }

  if (messages.length > 0) {
    const rows = (messages as MessageInput[]).map((m) => ({
      proposal_id: proposalId,
      role: m.role,
      content: m.content,
    }))

    const { error } = await supabase.from('chat_messages').insert(rows)
    if (error) {
      console.error('sync-messages insert error:', error)
      return NextResponse.json({ error: 'Failed to save messages' }, { status: 500 })
    }
  }

  // Bump saved_at so the proposal shows recent activity
  await supabase
    .from('proposals')
    .update({ saved_at: new Date().toISOString() })
    .eq('id', proposalId)

  return NextResponse.json({ success: true })
}
```

### Step 2: TypeScript check

```bash
cd "/Users/nagi/Downloads/Lamba Lab/Lamba Lab app" && node node_modules/.bin/tsc --noEmit
```

Expected: 0 errors.

### Step 3: Commit

```bash
git add app/api/intake/sync-messages/route.ts
git commit -m "feat: add sync-messages endpoint to persist chat to Supabase"
```

---

## Task 2: `GET /api/proposals/[id]/restore` route

**Files:**
- Create: `app/api/proposals/[id]/restore/route.ts`

Note: `app/api/proposals/[id]/` already exists (the `accept` route is there). Just add a `restore/` subfolder.

### Step 1: Create the route

```typescript
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const proposalId = params.id
  const supabase = createServiceClient()

  const { data: proposal } = await supabase
    .from('proposals')
    .select('id, session_id, user_id, brief, email, modules, confidence_score')
    .eq('id', proposalId)
    .single()

  // Only restore proposals that have a verified email
  if (!proposal || !proposal.email) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const { data: dbMessages } = await supabase
    .from('chat_messages')
    .select('role, content')
    .eq('proposal_id', proposalId)
    .order('created_at', { ascending: true })

  const messages = (dbMessages ?? []).map((m) => ({
    id: crypto.randomUUID(),
    role: m.role as 'user' | 'assistant',
    content: m.content,
  }))

  return NextResponse.json({
    proposalId: proposal.id,
    sessionId: proposal.session_id,
    userId: proposal.user_id ?? '',
    brief: proposal.brief,
    email: proposal.email,
    modules: Array.isArray(proposal.modules) ? proposal.modules : [],
    confidenceScore: typeof proposal.confidence_score === 'number' ? proposal.confidence_score : 0,
    messages,
  })
}
```

### Step 2: TypeScript check

```bash
node node_modules/.bin/tsc --noEmit
```

Expected: 0 errors.

### Step 3: Commit

```bash
git add app/api/proposals/[id]/restore/route.ts
git commit -m "feat: add proposal restore endpoint for cross-device return"
```

---

## Task 3: Update `SaveForLaterModal.tsx` — sync on OTP success

**Files:**
- Modify: `components/intake/SaveForLaterModal.tsx`

### Step 1: Read the current file

Read `components/intake/SaveForLaterModal.tsx` before editing. Focus on `handleVerify` (lines 77–99).

### Step 2: Update `handleVerify`

Find this block (lines 88–90):
```typescript
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Verification failed')
      setStep('success')
```

Replace with:
```typescript
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Verification failed')

      // Fire-and-forget: backfill all messages to Supabase now that email is verified
      try {
        const raw = localStorage.getItem(`lamba_msgs_${proposalId}`)
        const storedMessages: { role: string; content: string }[] = raw ? JSON.parse(raw) : []
        const apiMessages = storedMessages.map((m) => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        }))
        fetch('/api/intake/sync-messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ proposalId, sessionId, messages: apiMessages }),
        })
          .then(() => {
            localStorage.setItem(`lamba_email_verified_${proposalId}`, '1')
            localStorage.setItem(`lamba_synced_count_${proposalId}`, String(apiMessages.length))
          })
          .catch((e) => console.error('Initial sync error:', e))
      } catch (e) {
        console.error('Sync setup error:', e)
      }

      setStep('success')
```

### Step 3: TypeScript check

```bash
node node_modules/.bin/tsc --noEmit
```

Expected: 0 errors.

### Step 4: Commit

```bash
git add components/intake/SaveForLaterModal.tsx
git commit -m "feat: backfill messages to Supabase after OTP verification"
```

---

## Task 4: Update `hooks/useIntakeChat.ts` — auto-save on each turn

**Files:**
- Modify: `hooks/useIntakeChat.ts`

### Step 1: Read the current file

Read `hooks/useIntakeChat.ts` before editing. Focus on:
- The imports at the top (line 1–6)
- The localStorage key constants (lines 43–44)
- The messages-persist effect (lines 75–80)

### Step 2: Add the `getStoredSession` import

At line 6, after the existing imports, add:
```typescript
import { getStoredSession } from '@/lib/session'
```

### Step 3: Add the two new localStorage key helpers

After line 44 (`const PROPOSAL_KEY = ...`), add:
```typescript
const EMAIL_VERIFIED_KEY = (pid: string) => `lamba_email_verified_${pid}`
const SYNCED_COUNT_KEY   = (pid: string) => `lamba_synced_count_${pid}`
```

### Step 4: Update the messages-persist effect

Find the existing effect (lines 75–80):
```typescript
  // Persist messages to localStorage after every update
  useEffect(() => {
    if (messages.length > 0 && proposalId) {
      localStorage.setItem(MSGS_KEY(proposalId), JSON.stringify(messages))
    }
  }, [messages, proposalId])
```

Replace with:
```typescript
  // Persist messages to localStorage after every update.
  // Also auto-saves to Supabase when email is verified and streaming is complete.
  useEffect(() => {
    if (messages.length > 0 && proposalId) {
      localStorage.setItem(MSGS_KEY(proposalId), JSON.stringify(messages))

      if (!isStreaming && localStorage.getItem(EMAIL_VERIFIED_KEY(proposalId))) {
        const storedSession = getStoredSession()
        if (storedSession?.sessionId) {
          const syncedCount = parseInt(
            localStorage.getItem(SYNCED_COUNT_KEY(proposalId)) ?? '0',
            10
          )
          const newMessages = messages.slice(syncedCount)
          if (newMessages.length > 0) {
            const newCount = messages.length
            fetch('/api/intake/sync-messages', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                proposalId,
                sessionId: storedSession.sessionId,
                messages: newMessages.map((m) => ({ role: m.role, content: m.content })),
              }),
            })
              .then(() =>
                localStorage.setItem(SYNCED_COUNT_KEY(proposalId), String(newCount))
              )
              .catch((e) => console.error('Auto-save error:', e))
          }
        }
      }
    }
  }, [messages, proposalId, isStreaming]) // eslint-disable-line react-hooks/exhaustive-deps
```

### Step 5: TypeScript check

```bash
node node_modules/.bin/tsc --noEmit
```

Expected: 0 errors.

### Step 6: Commit

```bash
git add hooks/useIntakeChat.ts
git commit -m "feat: auto-save messages to Supabase after each turn when email is verified"
```

---

## Task 5: Update `HeroSection.tsx` — cross-device restore

**Files:**
- Modify: `components/landing/HeroSection.tsx`

### Step 1: Read the current file

Read `components/landing/HeroSection.tsx` before editing. Focus on the `useEffect` (lines 13–37) and the existing imports (lines 1–6).

### Step 2: Add `storeSession` and `storeIdeaForSession` to the import

Line 6 currently reads:
```typescript
import { getStoredSession, getIdeaForSession } from '@/lib/session'
```

Replace with:
```typescript
import { getStoredSession, getIdeaForSession, storeSession, storeIdeaForSession } from '@/lib/session'
```

### Step 3: Update the restore `useEffect`

Find the current `useEffect` (lines 13–37):
```typescript
  // Restore conversation from localStorage/URL on mount
  useEffect(() => {
    // Check URL for a conversation ID first
    const params = new URLSearchParams(window.location.search)
    const c = params.get('c')
    if (c) {
      const storedSession = getStoredSession()
      const idea = storedSession?.proposalId === c ? getIdeaForSession(c) : null
      if (idea) {
        // Only restore if there's a real idea (not a blank post-reset session)
        setInitialMessage(idea)
        setIntakeOpen(true)
        return
      }
    }
    // No URL param — check localStorage for any active session with a real idea
    const storedSession = getStoredSession()
    if (storedSession) {
      const idea = getIdeaForSession(storedSession.proposalId)
      if (idea) {
        setInitialMessage(idea)
        setIntakeOpen(true)
      }
    }
  }, [])
```

Replace with:
```typescript
  // Restore conversation from localStorage/URL on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const c = params.get('c')

    if (c) {
      // Same-device: localStorage matches the URL param
      const storedSession = getStoredSession()
      const idea = storedSession?.proposalId === c ? getIdeaForSession(c) : null
      if (idea) {
        setInitialMessage(idea)
        setIntakeOpen(true)
        return
      }

      // Cross-device: no localStorage match — fetch from Supabase
      fetch(`/api/proposals/${c}/restore`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (!data || !data.brief) return

          // Hydrate localStorage so useIntakeChat loads the restored state
          storeSession({
            sessionId: data.sessionId,
            proposalId: data.proposalId,
            userId: data.userId ?? '',
          })
          storeIdeaForSession(data.proposalId, data.brief)

          if (Array.isArray(data.messages) && data.messages.length > 0) {
            localStorage.setItem(`lamba_msgs_${data.proposalId}`, JSON.stringify(data.messages))
          }

          localStorage.setItem(
            `lamba_proposal_${data.proposalId}`,
            JSON.stringify({
              activeModules: Array.isArray(data.modules) ? data.modules : [],
              confidenceScore: typeof data.confidenceScore === 'number' ? data.confidenceScore : 0,
              complexityMultiplier: 1.0,
              productOverview: '',
              moduleSummaries: {},
              projectName: '',
            })
          )

          // Mark as email-verified so auto-save continues from where it left off
          localStorage.setItem(`lamba_email_verified_${data.proposalId}`, '1')
          localStorage.setItem(
            `lamba_synced_count_${data.proposalId}`,
            String(data.messages?.length ?? 0)
          )

          setInitialMessage(data.brief)
          setIntakeOpen(true)
        })
        .catch((e) => console.error('Restore error:', e))
      return
    }

    // No URL param — check localStorage for any active session with a real idea
    const storedSession = getStoredSession()
    if (storedSession) {
      const idea = getIdeaForSession(storedSession.proposalId)
      if (idea) {
        setInitialMessage(idea)
        setIntakeOpen(true)
      }
    }
  }, [])
```

### Step 4: TypeScript check

```bash
node node_modules/.bin/tsc --noEmit
```

Expected: 0 errors.

### Step 5: Run all tests

```bash
node node_modules/.bin/vitest run
```

Expected: all 36 tests pass.

### Step 6: Commit and push

```bash
git add components/landing/HeroSection.tsx
git commit -m "feat: restore full conversation from Supabase when returning via link on a new device"
git push origin main
```

---

## Manual Smoke Test (after deploy)

1. **Start a new intake** — chat for 4–5 turns
2. **Click "Save for later"** — enter email, verify OTP — success screen appears
3. **Continue chatting** for 2 more turns
4. **Open a private/incognito window** and paste your `?c=<proposalId>` URL
5. Confirm the **full chat history is restored** — all turns visible, user can continue chatting
6. **Check Supabase** (SQL Editor): `select count(*) from chat_messages where proposal_id = '<id>'` — should equal your total turn count

---

## Rollback Plan

If something breaks in production:
- The `?c=` URL param flow gracefully falls back — if the restore endpoint returns a non-OK response, `HeroSection` does nothing (user sees the normal landing page)
- Auto-save is fire-and-forget — errors are logged, UI is unaffected
- No DB schema changes required (all tables already exist)
