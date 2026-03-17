# Save for Later — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Let users save their in-progress proposal by verifying their email with a 6-digit OTP, then receive a branded Lamba Lab email with a link back to their proposal.

**Architecture:** Resend handles both emails (OTP code + confirmation link) — bypassing Supabase's poorly-branded built-in email entirely. OTPs are generated server-side, stored in a new `otp_codes` Supabase table, expire in 10 minutes, and are single-use. A 3-state modal (email → OTP → success) is rendered from `IntakeOverlay` and triggered by both the header button and the `PauseCheckpoint` pill.

**Tech Stack:** Next.js App Router, Supabase (service client for DB operations), Resend (`resend` npm package), Tailwind, TypeScript/Vitest

---

## Prerequisites (Manual — do these before touching code)

### P1: Run the DB migration in the Supabase dashboard

Go to **Supabase Dashboard → SQL Editor** and run:

```sql
-- New table for OTP codes
create table otp_codes (
  id          uuid primary key default gen_random_uuid(),
  email       text not null,
  code        text not null,
  proposal_id uuid not null references proposals(id) on delete cascade,
  session_id  uuid not null,
  expires_at  timestamptz not null,
  used        boolean not null default false,
  created_at  timestamptz not null default now()
);

create index on otp_codes (proposal_id, email, used, expires_at);

-- Add email column to proposals
alter table proposals
  add column if not exists email text,
  add column if not exists saved_at timestamptz;
```

### P2: Add env vars

In **Vercel Dashboard → Settings → Environment Variables** AND in your local `.env.local`:

```
RESEND_API_KEY=re_xxxxxxxxxxxx
RESEND_FROM_EMAIL=Lamba Lab <noreply@lambalab.com>
NEXT_PUBLIC_APP_URL=https://your-vercel-url.vercel.app   # fix the localhost value
```

> Get your Resend API key from resend.com. You'll need to verify the `lambalab.com` domain in Resend's dashboard.

---

## Task 1: Update TypeScript types + install Resend

**Files:**
- Modify: `lib/supabase/types.ts`
- Install: `resend` package

### Step 1: Install Resend

```bash
cd "Lamba Lab app"
npm install resend
```

Expected: `resend` appears in `package.json` dependencies.

### Step 2: Add `otp_codes` table and new proposals columns to `lib/supabase/types.ts`

In the `Tables` section, add after the `chat_messages` block:

```typescript
      otp_codes: {
        Row: {
          id: string
          email: string
          code: string
          proposal_id: string
          session_id: string
          expires_at: string
          used: boolean
          created_at: string
        }
        Insert: {
          id?: string
          email: string
          code: string
          proposal_id: string
          session_id: string
          expires_at: string
          used?: boolean
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['otp_codes']['Insert']>
        Relationships: []
      }
```

Also update `proposals.Row` and `proposals.Insert` to add:

```typescript
// In Row:
email: string | null
saved_at: string | null

// In Insert:
email?: string | null
saved_at?: string | null
```

And update the `status` union to include `'saved'`:
```typescript
status: 'draft' | 'saved' | 'pending_review' | 'approved' | 'accepted'
```

### Step 3: Run TypeScript check — should pass with 0 errors

```bash
node node_modules/.bin/tsc --noEmit
```

### Step 4: Commit

```bash
git add lib/supabase/types.ts package.json package-lock.json
git commit -m "chore: add otp_codes type, resend dep, proposals email/saved_at fields"
```

---

## Task 2: Resend client + email templates

**Files:**
- Create: `lib/email/resend.ts`
- Create: `lib/email/templates/otp.ts`
- Create: `lib/email/templates/confirmation.ts`
- Create: `lib/email/__tests__/templates.test.ts`

### Step 1: Write failing tests for templates

Create `lib/email/__tests__/templates.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { buildOtpEmail } from '../templates/otp'
import { buildConfirmationEmail } from '../templates/confirmation'

describe('buildOtpEmail', () => {
  it('includes the 6-digit code in the HTML', () => {
    const { html, subject } = buildOtpEmail({ code: '483102' })
    expect(html).toContain('483102')
    expect(subject).toBe('Your Lamba Lab verification code')
  })

  it('mentions expiry', () => {
    const { html } = buildOtpEmail({ code: '000000' })
    expect(html).toContain('10 minutes')
  })
})

describe('buildConfirmationEmail', () => {
  it('includes the proposal link', () => {
    const { html, subject } = buildConfirmationEmail({
      projectName: 'Mom Task Tracker',
      proposalUrl: 'https://app.lambalab.com/?c=abc-123',
    })
    expect(html).toContain('https://app.lambalab.com/?c=abc-123')
    expect(subject).toBe('Your proposal is saved — Mom Task Tracker')
  })

  it('falls back gracefully when projectName is empty', () => {
    const { subject } = buildConfirmationEmail({
      projectName: '',
      proposalUrl: 'https://app.lambalab.com/?c=abc-123',
    })
    expect(subject).toBe('Your proposal is saved')
  })
})
```

### Step 2: Run tests — expect FAIL (files don't exist yet)

```bash
node node_modules/.bin/vitest run lib/email/__tests__/templates.test.ts
```

Expected: Cannot find module `../templates/otp`

### Step 3: Create `lib/email/resend.ts`

```typescript
import { Resend } from 'resend'

export const resend = new Resend(process.env.RESEND_API_KEY)

export const FROM_EMAIL =
  process.env.RESEND_FROM_EMAIL ?? 'Lamba Lab <noreply@lambalab.com>'
```

### Step 4: Create `lib/email/templates/otp.ts`

```typescript
type OtpEmailInput = { code: string }
type EmailOutput = { subject: string; html: string }

export function buildOtpEmail({ code }: OtpEmailInput): EmailOutput {
  const subject = 'Your Lamba Lab verification code'
  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${subject}</title>
</head>
<body style="margin:0;padding:0;background:#111111;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#111111;padding:48px 16px;">
    <tr><td align="center">
      <table width="480" cellpadding="0" cellspacing="0" style="background:#1a1a1a;border-radius:16px;overflow:hidden;border:1px solid rgba(255,255,255,0.08);">

        <!-- Header -->
        <tr>
          <td style="padding:32px 40px 24px;border-bottom:1px solid rgba(255,255,255,0.06);">
            <span style="font-size:18px;font-weight:700;color:#ffffff;letter-spacing:0.05em;text-transform:uppercase;">LAMBA LAB</span>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:40px 40px 32px;">
            <p style="margin:0 0 8px;font-size:14px;color:#727272;text-transform:uppercase;letter-spacing:0.1em;">Verification code</p>
            <p style="margin:0 0 32px;font-size:14px;color:#a0a0a0;line-height:1.6;">
              Use the code below to save your proposal. It expires in 10 minutes.
            </p>

            <!-- OTP Code -->
            <div style="text-align:center;background:#242424;border-radius:12px;padding:32px;margin:0 0 32px;">
              <span style="font-size:56px;font-weight:700;color:#f5e642;letter-spacing:0.18em;font-family:'Courier New',monospace;">${code}</span>
            </div>

            <p style="margin:0;font-size:12px;color:#555555;line-height:1.6;">
              If you didn't request this, you can ignore this email — your proposal won't be saved without entering the code.
            </p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="padding:20px 40px;border-top:1px solid rgba(255,255,255,0.06);">
            <p style="margin:0;font-size:12px;color:#444444;">
              Lamba Lab · Software Agency
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`

  return { subject, html }
}
```

### Step 5: Create `lib/email/templates/confirmation.ts`

```typescript
type ConfirmationEmailInput = { projectName: string; proposalUrl: string }
type EmailOutput = { subject: string; html: string }

export function buildConfirmationEmail({ projectName, proposalUrl }: ConfirmationEmailInput): EmailOutput {
  const subject = projectName
    ? `Your proposal is saved — ${projectName}`
    : 'Your proposal is saved'

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${subject}</title>
</head>
<body style="margin:0;padding:0;background:#111111;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#111111;padding:48px 16px;">
    <tr><td align="center">
      <table width="480" cellpadding="0" cellspacing="0" style="background:#1a1a1a;border-radius:16px;overflow:hidden;border:1px solid rgba(255,255,255,0.08);">

        <!-- Header -->
        <tr>
          <td style="padding:32px 40px 24px;border-bottom:1px solid rgba(255,255,255,0.06);">
            <span style="font-size:18px;font-weight:700;color:#ffffff;letter-spacing:0.05em;text-transform:uppercase;">LAMBA LAB</span>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:40px 40px 32px;">
            <p style="margin:0 0 16px;font-size:22px;font-weight:600;color:#ffffff;line-height:1.3;">
              ${projectName ? `Your <span style="color:#f5e642;">${projectName}</span> proposal is saved.` : 'Your proposal is saved.'}
            </p>
            <p style="margin:0 0 32px;font-size:14px;color:#a0a0a0;line-height:1.7;">
              We've saved your progress. Use the button below to come back and continue scoping, or submit when you're ready. The Lamba Lab team will be in touch once you submit.
            </p>

            <!-- CTA Button -->
            <table cellpadding="0" cellspacing="0">
              <tr>
                <td style="border-radius:10px;background:#f5e642;">
                  <a href="${proposalUrl}"
                     style="display:inline-block;padding:14px 28px;font-size:14px;font-weight:600;color:#111111;text-decoration:none;letter-spacing:0.01em;">
                    Open my proposal →
                  </a>
                </td>
              </tr>
            </table>

            <p style="margin:24px 0 0;font-size:12px;color:#555555;line-height:1.6;">
              Or copy this link: <a href="${proposalUrl}" style="color:#f5e642;text-decoration:none;">${proposalUrl}</a>
            </p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="padding:20px 40px;border-top:1px solid rgba(255,255,255,0.06);">
            <p style="margin:0;font-size:12px;color:#444444;">
              Lamba Lab · Software Agency
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`

  return { subject, html }
}
```

### Step 6: Run tests — expect PASS

```bash
node node_modules/.bin/vitest run lib/email/__tests__/templates.test.ts
```

Expected: 4 tests pass.

### Step 7: Commit

```bash
git add lib/email/
git commit -m "feat: add Resend client and branded email templates"
```

---

## Task 3: Refactor `send-otp` route

**Files:**
- Modify: `app/api/auth/send-otp/route.ts`
- Create: `lib/email/__tests__/send-otp.test.ts` (unit test for OTP generation logic)

### Step 1: Write a test for the OTP generation helper

Create `lib/email/__tests__/generate-otp.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { generateOtp } from '../generate-otp'

describe('generateOtp', () => {
  it('returns a 6-digit numeric string', () => {
    const code = generateOtp()
    expect(code).toMatch(/^\d{6}$/)
  })

  it('generates different codes each call (statistically)', () => {
    const codes = new Set(Array.from({ length: 20 }, generateOtp))
    expect(codes.size).toBeGreaterThan(1)
  })
})
```

### Step 2: Run test — expect FAIL

```bash
node node_modules/.bin/vitest run lib/email/__tests__/generate-otp.test.ts
```

Expected: Cannot find module `../generate-otp`

### Step 3: Create `lib/email/generate-otp.ts`

```typescript
/** Generates a cryptographically-random 6-digit string (zero-padded). */
export function generateOtp(): string {
  // Use crypto.getRandomValues for better randomness than Math.random
  const array = new Uint32Array(1)
  crypto.getRandomValues(array)
  return String(array[0] % 1000000).padStart(6, '0')
}
```

### Step 4: Run test — expect PASS

```bash
node node_modules/.bin/vitest run lib/email/__tests__/generate-otp.test.ts
```

### Step 5: Replace `app/api/auth/send-otp/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { generateOtp } from '@/lib/email/generate-otp'
import { resend, FROM_EMAIL } from '@/lib/email/resend'
import { buildOtpEmail } from '@/lib/email/templates/otp'

export async function POST(req: NextRequest) {
  const { email, proposalId, sessionId } = await req.json()
  if (!email || !proposalId || !sessionId) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }

  const supabase = createServiceClient()

  // Validate proposal/session exist
  const { data: proposal } = await supabase
    .from('proposals')
    .select('id')
    .eq('id', proposalId)
    .eq('session_id', sessionId)
    .single()

  if (!proposal) {
    return NextResponse.json({ error: 'Invalid proposal or session' }, { status: 404 })
  }

  // Invalidate any existing unused codes for this proposal
  await supabase
    .from('otp_codes')
    .update({ used: true })
    .eq('proposal_id', proposalId)
    .eq('used', false)

  const code = generateOtp()
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString()

  const { error: insertError } = await supabase.from('otp_codes').insert({
    email,
    code,
    proposal_id: proposalId,
    session_id: sessionId,
    expires_at: expiresAt,
  })

  if (insertError) {
    console.error('OTP insert error:', insertError)
    return NextResponse.json({ error: 'Failed to create code' }, { status: 500 })
  }

  const { subject, html } = buildOtpEmail({ code })

  const { error: emailError } = await resend.emails.send({
    from: FROM_EMAIL,
    to: email,
    subject,
    html,
  })

  if (emailError) {
    console.error('Resend OTP error:', emailError)
    return NextResponse.json({ error: 'Failed to send email' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
```

### Step 6: TypeScript check

```bash
node node_modules/.bin/tsc --noEmit
```

Expected: 0 errors.

### Step 7: Commit

```bash
git add app/api/auth/send-otp/route.ts lib/email/generate-otp.ts lib/email/__tests__/generate-otp.test.ts
git commit -m "feat: send-otp now generates OTP via Resend instead of Supabase magic link"
```

---

## Task 4: Refactor `verify-otp` route

**Files:**
- Modify: `app/api/auth/verify-otp/route.ts`

### Step 1: Replace `app/api/auth/verify-otp/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { resend, FROM_EMAIL } from '@/lib/email/resend'
import { buildConfirmationEmail } from '@/lib/email/templates/confirmation'

export async function POST(req: NextRequest) {
  const { email, otp, proposalId, sessionId, projectName } = await req.json()
  if (!email || !otp || !proposalId || !sessionId) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }

  const supabase = createServiceClient()

  // Look up a valid, unused, unexpired code
  const { data: otpRecord } = await supabase
    .from('otp_codes')
    .select('id, code')
    .eq('email', email)
    .eq('proposal_id', proposalId)
    .eq('session_id', sessionId)
    .eq('used', false)
    .gte('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (!otpRecord) {
    return NextResponse.json({ error: 'Code expired or not found. Request a new one.' }, { status: 400 })
  }

  if (otpRecord.code !== otp) {
    return NextResponse.json({ error: 'Incorrect code. Please try again.' }, { status: 400 })
  }

  // Mark code as used (single-use)
  await supabase.from('otp_codes').update({ used: true }).eq('id', otpRecord.id)

  // Link email to proposal
  const { error: updateError } = await supabase
    .from('proposals')
    .update({ email, saved_at: new Date().toISOString() })
    .eq('id', proposalId)
    .eq('session_id', sessionId)

  if (updateError) {
    console.error('Proposal update error:', updateError)
    return NextResponse.json({ error: 'Failed to save proposal. Please contact support.' }, { status: 500 })
  }

  // Send confirmation email with proposal link
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''
  const proposalUrl = `${appUrl}/?c=${proposalId}`
  const { subject, html } = buildConfirmationEmail({ projectName: projectName ?? '', proposalUrl })

  const { error: emailError } = await resend.emails.send({
    from: FROM_EMAIL,
    to: email,
    subject,
    html,
  })

  if (emailError) {
    // Non-fatal: proposal is saved, email just didn't send
    console.error('Resend confirmation error:', emailError)
  }

  return NextResponse.json({ success: true })
}
```

### Step 2: TypeScript check

```bash
node node_modules/.bin/tsc --noEmit
```

Expected: 0 errors.

### Step 3: Commit

```bash
git add app/api/auth/verify-otp/route.ts
git commit -m "feat: verify-otp validates against otp_codes table and sends Resend confirmation email"
```

---

## Task 5: `SaveForLaterModal` component

**Files:**
- Create: `components/intake/SaveForLaterModal.tsx`

This component manages its own 3-step state machine: `email` → `otp` → `success`.

### Step 1: Create `components/intake/SaveForLaterModal.tsx`

```tsx
'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { X, ArrowRight, Check, RotateCcw } from 'lucide-react'

type Step = 'email' | 'otp' | 'success'

type Props = {
  proposalId: string
  sessionId: string
  projectName?: string
  onClose: () => void
}

export default function SaveForLaterModal({ proposalId, sessionId, projectName, onClose }: Props) {
  const [step, setStep] = useState<Step>('email')
  const [email, setEmail] = useState('')
  const [otp, setOtp] = useState(['', '', '', '', '', ''])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [resendCooldown, setResendCooldown] = useState(0)

  const emailInputRef = useRef<HTMLInputElement>(null)
  const otpRefs = useRef<(HTMLInputElement | null)[]>([])
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Autofocus email input on open
  useEffect(() => {
    emailInputRef.current?.focus()
  }, [])

  // Autofocus first OTP box when step changes to otp
  useEffect(() => {
    if (step === 'otp') {
      setTimeout(() => otpRefs.current[0]?.focus(), 50)
    }
  }, [step])

  // Countdown timer for resend cooldown
  const startCooldown = useCallback(() => {
    setResendCooldown(30)
    cooldownRef.current = setInterval(() => {
      setResendCooldown(prev => {
        if (prev <= 1) {
          clearInterval(cooldownRef.current!)
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }, [])

  useEffect(() => () => { if (cooldownRef.current) clearInterval(cooldownRef.current) }, [])

  const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)

  async function handleSendCode(targetEmail = email) {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: targetEmail, proposalId, sessionId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to send code')
      setStep('otp')
      startCooldown()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  async function handleVerify() {
    const code = otp.join('')
    if (code.length !== 6) return
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp: code, proposalId, sessionId, projectName }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Verification failed')
      setStep('success')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
      // Clear OTP boxes on error so user can re-enter
      setOtp(['', '', '', '', '', ''])
      setTimeout(() => otpRefs.current[0]?.focus(), 50)
    } finally {
      setLoading(false)
    }
  }

  function handleOtpChange(index: number, value: string) {
    // Accept paste: if value is 6 digits, fill all boxes
    if (value.length === 6 && /^\d{6}$/.test(value)) {
      setOtp(value.split(''))
      otpRefs.current[5]?.focus()
      return
    }
    const digit = value.replace(/\D/g, '').slice(-1)
    const next = [...otp]
    next[index] = digit
    setOtp(next)
    if (digit && index < 5) otpRefs.current[index + 1]?.focus()
  }

  function handleOtpKeyDown(index: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus()
    }
  }

  const otpComplete = otp.every(d => d !== '')

  return (
    // Backdrop
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" aria-hidden />

      {/* Modal card */}
      <div className="relative w-full max-w-sm bg-[var(--ov-surface,#1a1a1a)] border border-[var(--ov-border,rgba(255,255,255,0.10))] rounded-2xl shadow-2xl p-6 space-y-5">

        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-7 h-7 flex items-center justify-center rounded-full text-[var(--ov-text-muted,#727272)] hover:text-[var(--ov-text,#fff)] hover:bg-white/10 transition-colors cursor-pointer"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>

        {/* ── STEP: email ── */}
        {step === 'email' && (
          <>
            <div>
              <h2 className="text-base font-semibold text-[var(--ov-text,#ffffff)] mb-1">Save your progress</h2>
              <p className="text-sm text-[var(--ov-text-muted,#727272)] leading-relaxed">
                We'll send a 6-digit code to verify your email, then email you a link to come back anytime.
              </p>
            </div>

            <input
              ref={emailInputRef}
              type="email"
              value={email}
              onChange={e => { setEmail(e.target.value); setError('') }}
              onKeyDown={e => { if (e.key === 'Enter' && isValidEmail && !loading) handleSendCode() }}
              placeholder="your@email.com"
              className="w-full px-4 py-3 rounded-xl bg-[var(--ov-input-bg,rgba(255,255,255,0.05))] border border-[var(--ov-border,rgba(255,255,255,0.10))] text-[var(--ov-text,#ffffff)] placeholder:text-[var(--ov-text-muted,#727272)] text-sm outline-none focus:border-brand-yellow/40 transition-colors"
            />

            {error && <p className="text-xs text-red-400">{error}</p>}

            <button
              onClick={() => handleSendCode()}
              disabled={!isValidEmail || loading}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-brand-yellow text-brand-dark font-semibold text-sm disabled:opacity-40 hover:bg-brand-yellow/90 transition-all cursor-pointer disabled:cursor-not-allowed"
            >
              {loading ? 'Sending…' : <><span>Send code</span><ArrowRight className="w-4 h-4" /></>}
            </button>
          </>
        )}

        {/* ── STEP: otp ── */}
        {step === 'otp' && (
          <>
            <div>
              <h2 className="text-base font-semibold text-[var(--ov-text,#ffffff)] mb-1">Check your inbox</h2>
              <p className="text-sm text-[var(--ov-text-muted,#727272)] leading-relaxed">
                We sent a 6-digit code to{' '}
                <span className="text-[var(--ov-text,#ffffff)]">{email}</span>.{' '}
                <button
                  onClick={() => { setStep('email'); setOtp(['', '', '', '', '', '']); setError('') }}
                  className="underline hover:text-[var(--ov-text,#fff)] transition-colors cursor-pointer"
                >
                  Change
                </button>
              </p>
            </div>

            {/* 6 digit boxes */}
            <div className="flex gap-2 justify-between">
              {otp.map((digit, i) => (
                <input
                  key={i}
                  ref={el => { otpRefs.current[i] = el }}
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={digit}
                  onChange={e => handleOtpChange(i, e.target.value)}
                  onKeyDown={e => handleOtpKeyDown(i, e)}
                  onPaste={e => {
                    const text = e.clipboardData.getData('text')
                    if (/^\d{6}$/.test(text)) {
                      e.preventDefault()
                      handleOtpChange(i, text)
                    }
                  }}
                  className={[
                    'w-11 h-14 text-center text-xl font-bold rounded-xl border outline-none transition-colors',
                    'bg-[var(--ov-input-bg,rgba(255,255,255,0.05))] text-[var(--ov-text,#ffffff)]',
                    digit
                      ? 'border-brand-yellow/60'
                      : 'border-[var(--ov-border,rgba(255,255,255,0.10))] focus:border-brand-yellow/40',
                  ].join(' ')}
                />
              ))}
            </div>

            {/* Separator between groups of 3 */}
            {/* (visual grouping is handled by the gap-2 layout) */}

            {error && <p className="text-xs text-red-400">{error}</p>}

            <button
              onClick={handleVerify}
              disabled={!otpComplete || loading}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-brand-yellow text-brand-dark font-semibold text-sm disabled:opacity-40 hover:bg-brand-yellow/90 transition-all cursor-pointer disabled:cursor-not-allowed"
            >
              {loading ? 'Verifying…' : <><span>Verify</span><ArrowRight className="w-4 h-4" /></>}
            </button>

            <div className="text-center">
              <button
                onClick={() => handleSendCode()}
                disabled={resendCooldown > 0 || loading}
                className="text-xs text-[var(--ov-text-muted,#727272)] hover:text-[var(--ov-text,#fff)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer inline-flex items-center gap-1"
              >
                <RotateCcw className="w-3 h-3" />
                {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend code'}
              </button>
            </div>
          </>
        )}

        {/* ── STEP: success ── */}
        {step === 'success' && (
          <>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-brand-yellow/15 flex items-center justify-center flex-shrink-0">
                <Check className="w-5 h-5 text-brand-yellow" />
              </div>
              <h2 className="text-base font-semibold text-[var(--ov-text,#ffffff)]">You're all set</h2>
            </div>

            <p className="text-sm text-[var(--ov-text-muted,#727272)] leading-relaxed">
              A link to your proposal has been sent to{' '}
              <span className="text-[var(--ov-text,#ffffff)]">{email}</span>. Check your inbox — you can come back and continue anytime.
            </p>

            <button
              onClick={onClose}
              className="w-full py-3 rounded-xl border border-[var(--ov-border,rgba(255,255,255,0.10))] text-[var(--ov-text,#ffffff)] text-sm font-medium hover:border-white/20 transition-colors cursor-pointer"
            >
              Done
            </button>
          </>
        )}

      </div>
    </div>
  )
}
```

### Step 2: TypeScript check

```bash
node node_modules/.bin/tsc --noEmit
```

Expected: 0 errors.

### Step 3: Commit

```bash
git add components/intake/SaveForLaterModal.tsx
git commit -m "feat: add SaveForLaterModal with email/OTP/success states"
```

---

## Task 6: Wire up both "Save for later" entry points

**Files:**
- Modify: `components/intake/IntakeOverlay.tsx`
- Modify: `components/intake/PauseCheckpoint.tsx`

### Step 1: Update `IntakeOverlay.tsx`

Add the modal state and import near the top of the file:

```tsx
// Add import
import SaveForLaterModal from './SaveForLaterModal'

// Add state inside the component (near other useState calls):
const [saveModalOpen, setSaveModalOpen] = useState(false)
```

Wire the header "Save for later" button to open the modal (find the existing button and replace its `onClick`):

```tsx
{/* Save for later — only visible when proposal panel is closed */}
{!proposalOpen && (
  <button
    type="button"
    onClick={() => setSaveModalOpen(true)}
    className="hidden md:flex text-xs text-[var(--ov-text-muted,#727272)] hover:text-[var(--ov-text,#ffffff)] transition-colors cursor-pointer px-2 py-1.5"
  >
    Save for later
  </button>
)}
```

Render the modal at the end of the component (before the closing `</>`):

```tsx
{saveModalOpen && session && (
  <SaveForLaterModal
    proposalId={session.proposalId}
    sessionId={session.sessionId}
    projectName={appName || undefined}
    onClose={() => setSaveModalOpen(false)}
  />
)}
```

Also pass `onSaveLater` down to `IntakeLayout` so `PauseCheckpoint` can trigger it:

In `IntakeOverlay`'s `IntakeLayout` usage, add:
```tsx
onSaveLater={() => setSaveModalOpen(true)}
```

### Step 2: Update `IntakeLayout.tsx` Props and pass to `ChatPanel`

Add `onSaveLater?: () => void` to `IntakeLayout`'s `Props` type and destructuring.
Pass it to `ChatPanel`:
```tsx
onSaveLater={onSaveLater}
```
(both desktop and mobile instances)

### Step 3: Update `ChatPanel.tsx` Props and pass to `PauseCheckpoint`

Add `onSaveLater?: () => void` to `ChatPanel`'s `Props` type.
Pass it to each `PauseCheckpoint`:
```tsx
onSaveLater={onSaveLater}
```

### Step 4: Enable the pill in `PauseCheckpoint.tsx`

Update `CHECKPOINT_PILLS` — change `__save_later__` pill's `disabled` to `false`:

```tsx
{ value: '__save_later__', label: 'Save for later', icon: '🔖', disabled: false, primary: false },
```

Add `onSaveLater?: () => void` to `PauseCheckpoint`'s `Props` type and destructuring.

Update `handleSelect` to call it:
```tsx
} else if (value === '__save_later__') {
  onSaveLater?.()
}
```

### Step 5: TypeScript check

```bash
node node_modules/.bin/tsc --noEmit
```

Expected: 0 errors.

### Step 6: Run all tests

```bash
node node_modules/.bin/vitest run
```

Expected: all pass.

### Step 7: Commit and push

```bash
git add components/intake/IntakeOverlay.tsx components/intake/IntakeLayout.tsx components/intake/ChatPanel.tsx components/intake/PauseCheckpoint.tsx
git commit -m "feat: wire Save for later modal into header button and PauseCheckpoint pill"
git push origin main
```

---

## Smoke Test Checklist (manual, after deploy)

- [ ] Click "Save for later" in header → modal opens at email step
- [ ] Enter invalid email → Send button stays disabled
- [ ] Enter valid email → OTP step appears, OTP email arrives from `noreply@lambalab.com` with 6-digit code in large yellow font
- [ ] Enter wrong code → error message appears, boxes clear
- [ ] Enter correct code → success state appears, confirmation email arrives with yellow "Open my proposal →" button
- [ ] Click "Done" → modal closes, user can keep chatting
- [ ] Click "Save for later" pill in PauseCheckpoint → same flow
- [ ] Click "Change" email link on OTP step → returns to email step
- [ ] "Resend code" button: grayed out for 30s, then clickable again
