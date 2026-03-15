# Save for Later — Design Doc
**Date**: 2026-03-15
**Status**: Approved

---

## Overview

"Save for later" lets a user in the intake flow bookmark their in-progress proposal by verifying their email. After verification they receive a branded email with a direct link back to their proposal.

Both entry points trigger the same modal:
- Header button (visible when the proposal panel is closed)
- "Save for later" pill in `PauseCheckpoint`

---

## Architecture

### Email Strategy: Resend for everything

Supabase's built-in email is bypassed entirely. Both the OTP email and the post-verification confirmation email are sent via **Resend** with full HTML control and `Lamba Lab <noreply@lambalab.com>` as the sender.

This avoids:
- "Supabase Auth" sender name
- Supabase dashboard template limitations
- The broken `localhost` redirect URL in the existing magic link flow

### OTP Storage

A new `otp_codes` table in Supabase holds short-lived codes:

```sql
otp_codes (
  id          uuid primary key default gen_random_uuid(),
  email       text not null,
  code        text not null,          -- 6-digit string
  proposal_id uuid not null,
  session_id  uuid not null,
  expires_at  timestamptz not null,   -- now() + 10 minutes
  used        boolean default false
)
```

Codes expire after 10 minutes. Used codes are marked `used = true` immediately on first valid verification.

---

## Data Flow

```
User clicks "Save for later"
  → SaveForLaterModal opens (step: email)

User enters email → clicks "Send code"
  → POST /api/auth/send-otp { email, proposalId, sessionId }
    → Generate random 6-digit code
    → Insert into otp_codes table
    → Send OTP email via Resend
  → Modal advances to step: otp

User enters 6-digit code → clicks "Verify"
  → POST /api/auth/verify-otp { email, otp, proposalId, sessionId }
    → Look up unexpired, unused code in otp_codes
    → Validate match
    → Mark code as used
    → Link proposal: update proposals set email = email, status = 'saved'
    → Send confirmation email via Resend (proposal link)
    → Return { success: true }
  → Modal advances to step: success

User sees success state → closes modal
```

---

## Modal States

### State 1 — Email entry
- Headline: "Save your progress"
- Body: "We'll send a 6-digit code to verify your email, then send you a link to come back anytime."
- Input: email field, autofocused
- CTA: "Send code →" (disabled until valid email)
- Loading state while API call is in flight

### State 2 — OTP entry
- Headline: "Check your inbox"
- Body: "We sent a 6-digit code to **{email}**" with a "change" link that goes back to step 1
- Input: 6 individual digit boxes (auto-advance, paste support)
- CTA: "Verify →"
- Secondary: "Resend code" (with 30-second cooldown)
- Error state: inline error below input on wrong code
- Loading state while API call is in flight

### State 3 — Success
- Headline: "✓ You're all set"
- Body: "A link to your proposal has been sent to **{email}**. Check your inbox — you can come back and continue anytime."
- No CTA needed; modal can be dismissed with the × button

---

## Emails

### OTP Email
- **From**: `Lamba Lab <noreply@lambalab.com>`
- **Subject**: `Your Lamba Lab verification code`
- **Design**: Dark background (#1a1a1a), Lamba Lab logo/icon at top, 6-digit code in ~56px monospace bold font, yellow accent, "Expires in 10 minutes" note below code, minimal footer

### Confirmation Email (sent after OTP verified)
- **From**: `Lamba Lab <noreply@lambalab.com>`
- **Subject**: `Your proposal is saved — {projectName}`
- **Design**: Same brand treatment, project name as headline, big yellow "Open my proposal →" button linking to `{NEXT_PUBLIC_APP_URL}/?c={proposalId}`, short note that the Lamba Lab team will be in touch

---

## API Route Changes

### `POST /api/auth/send-otp`
**New behaviour** — replaces magic link with custom OTP:
- Accept `{ email, proposalId, sessionId }`
- Generate `Math.floor(100000 + Math.random() * 900000).toString()`
- Insert into `otp_codes` table (expires in 10 minutes)
- Send OTP email via Resend
- Return `{ success: true }`

### `POST /api/auth/verify-otp`
**New behaviour** — validates against `otp_codes` table:
- Accept `{ email, otp, proposalId, sessionId }`
- Query: `otp_codes WHERE email = ? AND proposal_id = ? AND session_id = ? AND used = false AND expires_at > now()`
- Compare `code === otp`
- On match: mark `used = true`, update `proposals` (set `email`, `status = 'saved'`), send confirmation email via Resend
- Return `{ success: true }` or `{ error: '...' }`

---

## New Files

| File | Purpose |
|---|---|
| `components/intake/SaveForLaterModal.tsx` | 3-state modal component |
| `lib/email/resend.ts` | Resend client singleton |
| `lib/email/templates/otp.ts` | OTP email HTML template |
| `lib/email/templates/confirmation.ts` | Confirmation email HTML template |

## Modified Files

| File | Change |
|---|---|
| `app/api/auth/send-otp/route.ts` | Replace Supabase magic link with Resend OTP |
| `app/api/auth/verify-otp/route.ts` | Validate against otp_codes table, send confirmation email |
| `components/intake/IntakeOverlay.tsx` | Wire "Save for later" button to open modal |
| `components/intake/PauseCheckpoint.tsx` | Enable the "Save for later" pill, pass `onSaveLater` prop |

## New Environment Variables

| Variable | Description |
|---|---|
| `RESEND_API_KEY` | Resend API key |
| `RESEND_FROM_EMAIL` | `Lamba Lab <noreply@lambalab.com>` |

---

## Database Migration

```sql
create table otp_codes (
  id          uuid primary key default gen_random_uuid(),
  email       text not null,
  code        text not null,
  proposal_id uuid not null references proposals(id),
  session_id  uuid not null,
  expires_at  timestamptz not null,
  used        boolean not null default false,
  created_at  timestamptz not null default now()
);

-- Clean up expired codes automatically
create index on otp_codes (expires_at);
```

Also add `email` column to `proposals` table to store the verified email:

```sql
alter table proposals add column if not exists email text;
```

---

## Out of Scope

- Returning users logging back in via the saved link (separate feature)
- Rate limiting on OTP requests (Resend/Supabase handle basic abuse prevention)
- Supabase Auth user creation is removed from this flow (proposals are linked by email only for now)
