# Admin Panel Design

**Date**: 2026-03-17
**Status**: Approved
**Scope**: Admin dashboard, real-time chat, admin takeover, budget proposals, proposal editing
**Out of scope**: Project tracker (separate phase)

---

## 1. Admin Authentication

- **Route**: `/admin/login` — magic link login
- Server validates email against `ADMIN_EMAILS` env var before sending magic link
- If not in allowlist → generic "Access denied" (no info leak)
- All `/admin/*` routes protected: authenticated session + email in `ADMIN_EMAILS`
- Auto-redirect to `/admin` if already authenticated

## 2. Dashboard Layout (Gmail-style 2-Panel)

**Route**: `/admin`

### List Panel (left, ~320px)
- Each card: project name, status badge, confidence %, time ago, price range
- **Filters**: Status dropdown (all, draft, pending_review, approved, budget_proposed, accepted), date range
- **Sort**: Newest (default), oldest, confidence desc, price desc
- **Search**: Fuzzy on project name, brief, email
- Selected proposal highlighted

### 1-Column Mode
- No proposal selected → list expands full width
- Narrow screens → same behavior
- Click proposal → detail opens, list becomes sidebar
- Back arrow → return to full-width list

### Detail Panel (right)
- Header: project name, status badge + dropdown, confidence bar, module tags
- **3 tabs**: Chat, Proposal, Budget

## 3. Real-Time Chat & Admin Takeover

**Tech**: Supabase Realtime (Postgres Changes + Broadcast)

### Observation Mode (default)
- Load past messages from `chat_messages` table
- Subscribe to Realtime `chat_messages` changes for `proposal_id`
- Messages labeled: "User", "AI", "[Admin]"
- Banner: "Watching live chat" when user is active
- Read-only, no input field

### Takeover Mode
- Admin clicks **"Join Chat"** → Broadcast on `proposal:{id}`: `{ type: 'admin_joined' }`
- **User side** (`useIntakeChat`):
  - Receives `admin_joined` → `isAdminActive = true`
  - System message: "[Admin] has joined the chat"
  - AI paused — API returns early when `admin_mode: true`
  - User can still type, messages saved with `role: 'user'`
- **Admin side**:
  - Input field appears
  - Messages saved with `role: 'admin'`
  - Both sides see messages via Realtime subscription

### Resuming AI
- Admin clicks **"Resume AI"** → Broadcast `{ type: 'admin_left' }`
- User sees: "[Admin] has left the chat"
- AI resumes on next user message

### DB Change
- Add `'admin'` to `chat_messages.role` (currently `'user' | 'assistant'`)

## 4. Budget Proposal & User Response

### New Table: `budget_proposals`
```
id             UUID PK
proposal_id    UUID FK proposals
amount         INT (USD)
client_notes   TEXT (visible to user)
internal_notes TEXT (admin-only)
status         'pending' | 'accepted' | 'countered' | 'call_requested'
counter_amount INT nullable
counter_notes  TEXT nullable
created_at     TIMESTAMPTZ
responded_at   TIMESTAMPTZ nullable
```

### Admin Flow (Budget tab)
- Form: proposed price, notes to client, internal notes
- Submit → creates `budget_proposals` row, sends branded email via Resend, updates proposal status to `budget_proposed`
- In-app notification via Supabase Realtime

### User Flow (`/proposal/{slug}/budget`)
- Shows: amount, admin notes, project summary
- Actions:
  - **Accept** → `status: 'accepted'`, admin notified
  - **Counter** → counter-offer input (amount + note) → `status: 'countered'`, admin notified
  - **Request a Call** → time preference + note → `status: 'call_requested'`, admin notified

### New Proposal Statuses
- Add `'budget_proposed'` and `'budget_accepted'` to proposal status enum

## 5. Proposal Editing (Admin)

**Proposal tab** — full editable form:
- Project overview (name, brief, product overview)
- App type tags (mobile, web, desktop)
- Modules: expandable cards, add/remove, edit summaries
- PRD (rich text)
- Technical architecture (text area)
- Task breakdown (editable list per module)
- Timeline / milestone plan
- Admin notes (internal-only)

**Auto-save**: Debounced save on change via PATCH `/api/admin/proposals/[id]`

**Status control**: Dropdown in header to change status manually

## 6. Email Notifications

Using existing Resend setup. Simple branded HTML templates (Lamba Lab logo + colors + CTA button):
- **Budget proposed**: Amount, notes, link to `/proposal/{slug}/budget`
- **Budget response**: Admin notified when user accepts/counters/requests call
- **Admin joined chat**: Optional notification if user is not actively in chat

## 7. Database Changes Summary

1. Add `'admin'` to `chat_messages.role` enum
2. Create `budget_proposals` table
3. Add `'budget_proposed'` and `'budget_accepted'` to `proposals.status` enum
4. Add RLS policies for admin access (service role for admin operations)
