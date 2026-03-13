# Intake v3 — Design Document

**Date:** 2026-03-13
**Status:** Approved
**Scope:** 9 changes grouped into 6 implementation themes

---

## Overview

A comprehensive upgrade to the intake experience: clean up the left panel to be chat-only, restructure the right panel to show product intelligence, fix the broken magic link auth flow, add dark/light mode, make the AI conversation PM-quality, and add user control (edit, reset, skip).

---

## Theme 1 — Layout Restructure

### Left Panel (55%) — Pure Chat
- `ChatPanel` becomes a clean conversation space: messages + input only
- Remove: `ConfidenceBar`, "View Full Proposal" button, `pricingVisible` prop, `priceRange` prop
- The `ChatPanel` no longer renders anything outside the message list and input

### Right Panel (45%) — Product Intelligence Panel
`ModulesPanel` is restructured into four sections, top to bottom:

1. **YOUR PRODUCT** — product overview paragraph (new)
   - Empty state: subtle "Your product overview will appear here as we learn more" placeholder
   - Populated: 2–4 sentence narrative updated by the AI each turn
   - Animated: fades in / updates smoothly

2. **Estimate Accuracy** — `ConfidenceBar` (moved from ChatPanel)
   - Identical component, now lives here

3. **Technical Modules** — existing module cards (unchanged)
   - Active modules, then catalog

4. **View Full Proposal** button — pinned at bottom
   - Hidden during onboarding (while `onboardingStep < 3`)
   - Visible after the AI's first response (`confidenceScore > 0`)
   - Clicking triggers `AuthGateModal` (magic link flow, see Theme 3)

### IntakeLayout changes
- Thread `proposalId` through to `ModulesPanel` (needed for auth gate)
- Thread `productOverview` from `useIntakeChat` to `ModulesPanel`
- Remove `pricingVisible` and `priceRange` from `ChatPanel` props
- Keep `pricingVisible` on `ModulesPanel` only for per-module price blurring (module cards)
- `pricingVisible` is still controlled by `isPricingVisible(confidenceScore)` — only the **total estimate** is removed, not the individual module blur

### Total Estimate removed from chat
- The `{pricingVisible && <total estimate section>}` block in `ModulesPanel` is deleted
- Total estimate only appears on `/proposal/[id]` page after email verification
- Per-module prices remain blurred until confidence threshold (existing behavior preserved)

---

## Theme 2 — Product Overview (AI-Generated)

### AI Tool Schema change
Add `product_overview: string` to the `update_proposal` tool in `lib/ai/tools.ts`:
- Description: "A clear, non-technical 2–4 sentence paragraph describing what the product is, who it's for, and what problem it solves. Written from the user's perspective. Updated and expanded each turn as more detail emerges."
- The AI writes this in plain language, no jargon, as if explaining the product to an investor

### useIntakeChat changes
- Add `productOverview` state: `const [productOverview, setProductOverview] = useState('')`
- In `tool_result` handler: extract `input?.product_overview` and update state if non-empty
- Return `productOverview` from the hook
- Add `UpdateProposalInput.product_overview?: string` to the type

### ModulesPanel display
- Top section header: `"YOUR PRODUCT"` (font-bebas, same style as "TECHNICAL MODULES")
- Paragraph text: `text-sm text-brand-gray-mid leading-relaxed`
- Empty state: `"Your product overview will appear here as we learn more..."`
- Transition: `transition-all duration-500` when content changes

---

## Theme 3 — Auth: Magic Link Fix

### Root cause
`supabase.auth.signInWithOtp()` sends a **magic link** (click-to-authenticate email) which is what the user sees as "Confirm your mail". The app then waits for a 6-digit OTP code that was never sent. These two auth mechanisms are incompatible.

### Fix: Switch fully to magic link flow

**`app/api/auth/send-otp/route.ts`** (rename intent: `send-magic-link`):
- Add `sessionId` to request body (`{ email, proposalId, sessionId }`)
- Set `emailRedirectTo` to include both `proposalId` and `sessionId`:
  ```
  emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback?proposalId=${proposalId}&sessionId=${sessionId}`
  ```
- Keep `shouldCreateUser: true` and `data: { proposal_id: proposalId }`

**New `app/auth/callback/route.ts`** (Next.js Route Handler, GET):
1. Extract `code`, `proposalId`, `sessionId` from search params
2. Exchange code for session via `supabase.auth.exchangeCodeForSession(code)`
3. Validate that `proposalId` belongs to `sessionId` (query proposals table)
4. Update proposal: `user_id = data.user.id`, `status = 'pending_review'`
5. Redirect to `/proposal/${proposalId}?status=pending`

**`components/intake/AuthGateModal.tsx`** — new 3-step UI:
- `'email'` step: Enter email input (unchanged)
- `'sent'` step (replaces `'otp'`): "Check your inbox — we sent a magic link to `${email}`. Click it to view your proposal." No code input needed.
- `'loading'` step: unchanged spinner
- `'success'` step: unchanged
- Remove all OTP-related state (`otp`, `handleVerifyOtp`)
- The `send-otp` API call now also sends `sessionId` (from `getStoredSession()`)

**`app/api/auth/verify-otp/route.ts`** — kept but unused (delete later)

**AuthGateModal gets `proposalId` from**: already passed as prop. Thread `proposalId` and `sessionId` into `ModulesPanel` → `AuthGateModal`.

---

## Theme 4 — Edit Messages & Reset

### Edit user messages

**During onboarding (messages with `id.startsWith('onboarding-')` as predecessor):**
- Each user message rendered in `MessageBubble` shows a small `✏️` edit button (top-right, only visible on hover)
- Clicking triggers `onEdit(message.id)` callback
- `useIntakeChat` exposes `editMessage(messageId: string)` — finds the message index, clears all messages from that index onward, resets `onboardingStep` to the question index, resets `onboardingAnswers` to the slice before that index

**Post-onboarding (normal user messages):**
- Same pencil hover UI
- Clicking opens an inline edit input inside the bubble (replaces the content)
- Saving: replaces the message content, clears all subsequent messages, rebuilds API history, calls AI

### useIntakeChat additions
```ts
editOnboardingMessage(messageIndex: number): void
  // clears messages[messageIndex..], resets onboardingStep, onboardingAnswers

editAIMessage(messageId: string, newContent: string): Promise<void>
  // replaces message, clears subsequent, calls streamAIResponse
```

### Reset
- `reset()` function in `useIntakeChat`: resets ALL state to initial values (messages back to Q1, clear everything)
- `IntakeOverlay` adds a "↺ Start over" button in the top bar (between wordmark and minimize)
- Two-phase confirm: first click changes button to "Are you sure? [Yes] [No]"
- On confirm: calls `reset()` from `useIntakeChat` + creates new proposal session (calls `/api/session/create` again)

### MessageBubble changes
- New props: `onEdit?: (messageId: string) => void`, `isEditable?: boolean`
- Edit pencil icon: `opacity-0 group-hover:opacity-100 transition-opacity` (only appears on hover)
- Edit state: replaces bubble content with a textarea + save/cancel

---

## Theme 5 — Dark/Light Mode

### Storage & hook
New `hooks/useTheme.ts`:
```ts
type Theme = 'dark' | 'light'
export function useTheme(): { theme: Theme; toggleTheme: () => void }
```
- Reads from `localStorage` key `'lamba-theme'`
- Default: `'dark'`
- Applies `'dark'` or `'light'` class to the overlay wrapper div (not `<html>`)

### Light mode palette
Applied via Tailwind: components check for `dark:` prefix via parent `.dark` class on the overlay wrapper
- Background: `bg-[#F5F4F0]` (warm off-white)
- Card/section backgrounds: `bg-white`
- Text: `text-gray-900`
- Borders: `border-gray-200`
- Brand yellow: unchanged (`#F5C842`)
- Chat bubbles:
  - Assistant: `bg-white border border-gray-200 text-gray-900`
  - User: `bg-brand-yellow/10 text-gray-900`
- Module cards: `bg-white border-gray-200`
- Input area: `bg-gray-100 border-gray-300`

### Toggle button
In `IntakeOverlay` top bar, between the wordmark and the reset button:
- `☀️` icon when currently dark (click to switch to light)
- `🌙` icon when currently light (click to switch to dark)
- Small `w-8 h-8` button, same style as the minimize button

### Component scope
Dark/Light applies to the entire overlay (`IntakeOverlay` wrapper div). The landing page (HeroSection etc.) is not affected.

---

## Theme 6 — AI Conversation Quality

### Initial 3 questions — style change
In `ONBOARDING_QUESTIONS` in `hooks/useIntakeChat.ts`:
- Change `style: 'icon-cards'` → `style: 'list'` for all 3 questions
- Add `description` to each option explaining what it means in plain language
- Icons move inline to the label: `{ label: '🌐 Web App', description: 'A browser-based product users visit on desktop or mobile', value: 'Web App' }`

### AI System Prompt — PM rewrite
Key changes to `lib/ai/system-prompt.ts`:
1. **Persona**: "Senior product strategist at Lamba Lab — you think like a world-class Product Manager doing a discovery call. You never use technical jargon."
2. **Question framing**: Every question starts with context: "For a product like this, one of the key decisions is [X]. What this means for you is [plain language]. [Question]?"
3. **"Recommend for me" instruction**: "Always include **the last option** in `quick_replies` as: `{ label: 'Not sure — recommend what\'s best', description: 'I\'ll suggest the best fit based on what we\'ve covered', value: '__recommend__' }`. When the user picks this, acknowledge it and state your recommendation before moving on."
4. **Module-specific questions**: After detecting modules, ask follow-up questions that are specific to each module's requirements (auth: email vs social login; payments: subscription vs one-time; etc.)
5. **`product_overview` field guidance**: "The `product_overview` field should be a living paragraph. Start with 1 sentence after the first turn. Grow to 3–4 sentences by turn 5. Write as if describing the product to a non-technical investor."

### Quick Replies — `__recommend__` handling
In `useIntakeChat.sendMessage`: if `content === '__recommend__'`, it's passed to the AI as the user's selection. The AI's system prompt instructs it to handle this gracefully.

---

## Files Changed

| File | Change |
|---|---|
| `hooks/useIntakeChat.ts` | Add productOverview, editOnboardingMessage, editAIMessage, reset. Change 3Q style to 'list' |
| `hooks/useTheme.ts` | NEW — dark/light theme hook |
| `lib/ai/tools.ts` | Add product_overview to schema |
| `lib/ai/system-prompt.ts` | Full PM-style rewrite |
| `components/intake/ChatPanel.tsx` | Remove ConfidenceBar, remove Full Proposal button, simplify props |
| `components/intake/ModulesPanel.tsx` | Add product overview, ConfidenceBar, Full Proposal button; remove total estimate |
| `components/intake/IntakeLayout.tsx` | Thread proposalId, productOverview; remove pricingVisible/priceRange from ChatPanel |
| `components/intake/IntakeOverlay.tsx` | Add Reset button, Dark/Light toggle, dark class on wrapper |
| `components/intake/MessageBubble.tsx` | Add edit icon + inline edit UI |
| `components/intake/AuthGateModal.tsx` | Replace OTP input with 'sent' state (magic link) |
| `app/api/auth/send-otp/route.ts` | Add sessionId param, set emailRedirectTo |
| `app/auth/callback/route.ts` | NEW — exchange code, link proposal to user, redirect |

---

## Implementation Order

1. **Layout + total estimate removal** (ChatPanel + ModulesPanel restructure)
2. **Product overview** (tool schema + hook state + right panel display)
3. **Auth magic link** (send-otp + callback route + AuthGateModal)
4. **Edit + Reset** (MessageBubble + useIntakeChat + IntakeOverlay)
5. **Dark/Light mode** (useTheme + Tailwind classes across all components)
6. **AI quality** (system prompt + 3Q style + quick replies)
7. **Final verification + push**
