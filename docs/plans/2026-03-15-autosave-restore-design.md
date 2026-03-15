# Auto-Save + Return Link — Design Doc

**Date:** 2026-03-15

## Goal

After a user verifies their email via the Save for Later flow, automatically persist their chat conversation to Supabase on every turn. When they return via their unique link (`?c=<proposalId>`) on any device/browser, restore the full chat history and let them continue where they left off — no re-authentication required.

---

## Approved Approach: Backfill at save time, auto-save after

Messages live in localStorage until email is verified. At verification, all existing messages are batch-written to Supabase (`chat_messages` table). From that point forward, every completed AI turn appends the two new messages (user + assistant) to Supabase. `proposals.saved_at` is bumped on each save.

On return, if `?c=<proposalId>` is in the URL and there is no matching localStorage session, the app fetches the full proposal + messages from a restore endpoint, hydrates localStorage, and opens the overlay normally. No special "restore mode" needed.

---

## Architecture

### New API Endpoints

**`POST /api/intake/sync-messages`**
- Auth: `sessionId` validates ownership (same pattern as the rest of the intake API)
- Body: `{ proposalId, sessionId, messages: { role, content }[] }`
- Action: inserts the provided messages into `chat_messages` in order; bumps `proposals.saved_at`
- Called twice: once for backfill (all messages) at OTP success, then incrementally (new messages only) after each turn

**`GET /api/proposals/[id]/restore`**
- Auth: none — the UUID is the access key (full trust model)
- Returns: `{ proposalId, sessionId, brief, email, modules, confidenceScore, projectName, messages[] }`
- Called by `HeroSection` when `?c=` URL param is present but no localStorage match exists

---

### Frontend Changes

**`SaveForLaterModal.tsx`**
After OTP verifies:
1. Call `POST /api/intake/sync-messages` with all current localStorage messages
2. On success: set `lamba_email_verified_<proposalId> = "1"` and `lamba_synced_count_<proposalId> = <message count>` in localStorage
3. Show success screen as normal

**`hooks/useIntakeChat.ts`**
After each `tool_result` event (end of every AI turn):
1. Check `localStorage.getItem('lamba_email_verified_<proposalId>')`
2. If set: read `syncedCount` from `lamba_synced_count_<proposalId>`
3. POST `messages.slice(syncedCount)` to `sync-messages`
4. On success: update `lamba_synced_count_<proposalId>` to `messages.length`
5. Fire-and-forget — errors are logged but do not block the UI

**`components/landing/HeroSection.tsx`**
Existing `?c=` URL param handling:
1. Read `?c=<proposalId>` from URL
2. Check localStorage for matching session — if found, open overlay as today
3. **New fallback:** if not found, call `GET /api/proposals/<proposalId>/restore`
4. On success: write returned data into localStorage using the exact keys `useIntakeChat` reads:
   - `lamba_session` → `{ proposalId, sessionId }`
   - `lamba_msgs_<proposalId>` → messages array
   - `lamba_proposal_<proposalId>` → `{ activeModules, confidenceScore, projectName, ... }`
   - `lamba_email_verified_<proposalId>` → `"1"`
   - `lamba_synced_count_<proposalId>` → `messages.length`
5. Open overlay — hook loads from localStorage, renders full history

---

## Data Flow

### Save flow (at OTP verification)
```
OTP modal → verify-otp success
  → POST /api/intake/sync-messages (all messages)
  → localStorage: emailVerified=1, syncedCount=N
  → modal shows success screen
```

### Auto-save flow (each subsequent turn)
```
User sends message → localStorage
AI responds → tool_result event fires
  → check emailVerified flag
  → POST /api/intake/sync-messages (messages[syncedCount:])
  → syncedCount updated
```

### Return flow (cross-device)
```
User opens /?c=<proposalId>
  → HeroSection reads ?c= param
  → No localStorage match
  → GET /api/proposals/<proposalId>/restore
  → Hydrate localStorage
  → Open overlay
  → useIntakeChat loads from localStorage as normal
  → Full chat history visible, user can continue
```

---

## Edge Cases

| Scenario | Behaviour |
|----------|-----------|
| Same device return | localStorage match found — restore endpoint never called |
| Auto-save network error | Logged silently, UI unaffected, synced count not incremented, next save catches up |
| User never verified email | `emailVerified` flag absent, auto-save never fires, link only works on same device |
| Return before any auto-save | Restore endpoint returns messages up to last sync point |
| Link shared to another person | Full trust — anyone with UUID can view (intentional) |
| Duplicate messages on backfill | `synced_count` ensures only `messages[syncedCount:]` is ever sent |
