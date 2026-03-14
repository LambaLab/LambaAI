# Intake v4 Design — Conversational PM Onboarding

**Date:** 2026-03-14
**Status:** Approved

---

## Problem

The current intake opens by showing 3 hardcoded questions regardless of what the user already told us:

1. "What platform are you building for?" — even if the user said "mobile app"
2. "What type of product is this?" — even if the user said "marketplace"
3. "What's the goal?" — generic, context-free

This feels like filling out a form. The user already shared their idea on the landing page; we're ignoring it and starting from scratch.

**Reset bug:** Clicking Reset re-injects Q1, so the left panel still shows the question cards instead of a clean blank slate.

---

## Goal

Make the intake feel like a real discovery conversation with a world-class Product Manager — someone who listens to what you said, shows they understood it, and asks the *one* question that actually matters next. Not a form. Not a checklist.

---

## Approach: AI-First, No Hardcoded Questions

Remove the 3-question onboarding gate entirely. The user's idea (typed on the landing page) is sent directly to the AI as the first message. The AI acknowledges what it understood, shows PM expertise, and asks one smart follow-up specific to that idea.

---

## Flow

### Opening the overlay
```
User types: "I want to build a mobile app that helps people sell"
             ↓
Overlay opens
             ↓
useIntakeChat auto-sends idea as user message (useEffect on mount)
             ↓
AI streams response...
```

### What the user sees
```
┌─────────────────────────────────────────────────────┐
│  You                                                 │
│  "I want to build a mobile app that helps           │
│   people sell"                                       │
├─────────────────────────────────────────────────────┤
│  Lamba Lab                                           │
│                                                      │
│  Love this — you're describing a mobile             │
│  marketplace. The core idea is clear.               │
│                                                      │
│  One thing that shapes everything early on:         │
│  are sellers listing pre-existing items             │
│  (like a used-goods market), or is this more        │
│  about selling things they make or do               │
│  (services, handmade goods, custom work)?           │
│                                                      │
│  [Existing items]  [Things I make/do]               │
│  [Mix of both]     [Not sure — recommend]           │
└─────────────────────────────────────────────────────┘
```

The AI inferred: mobile platform, marketplace product type. It asks ONE question about what was genuinely ambiguous (seller type), framed with PM context about why it matters.

### Subsequent turns
Normal PM conversation. The AI asks one follow-up per turn, builds the product overview, detects modules, updates confidence. No change from v3 behavior after turn 1.

### Reset (bug fix)
```
User clicks Reset → confirms
        ↓
reset() called: messages = []
initialMessage state cleared in IntakeOverlay
        ↓
Left panel: blank — only the input field visible
Input placeholder: "Describe the idea you want to build..."
        ↓
User types new idea → sent directly to AI → new conversation
```

The blank slate is the natural result of `messages = []` — no Q1 re-injection because there are no hardcoded questions anymore.

---

## Edge Cases

### Off-topic messages
If the user types something unrelated to software/digital products (e.g., "How is the weather?", "I want to build a building", "I want to build a nuclear plant"), the AI handles it gracefully in the conversation — no client-side blocking:

- **Clearly off-topic** ("how is the weather?"): Warm, brief redirect. *"Ha — that's a bit outside my lane! I help teams scope out software products. Do you have a digital product idea in mind?"* Sets `detected_modules: []`, `confidence_score_delta: 0`, `product_overview: ''`.

- **Ambiguous** ("I want to build a building"): Ask if there's a digital component. *"Interesting — is there a software side to this? Like a building management system, a property marketplace, or a tenant-facing app?"*

No hard errors. The conversation stays warm. The AI naturally steers the user toward a real software idea.

---

## Changes Required

### `hooks/useIntakeChat.ts`
- **Delete:** `ONBOARDING_QUESTIONS` constant
- **Delete:** `onboardingStep` state and setter
- **Delete:** `onboardingAnswers` state and setter
- **Delete:** `if (onboardingStep < 3)` branching in `sendMessage`
- **Add:** `useEffect([], [])` — on mount, if `idea` is non-empty, create user message bubble and call `streamAIResponse`
- **Simplify:** `editMessage` — remove onboarding-detection branching (all edits are now uniform corrections)
- **Update:** `reset()` → sets `messages = []` (already cleared other state in v3)
- **Update:** Return type — remove `onboardingStep` (no longer needed by consumers)

### `lib/ai/system-prompt.ts`
Two new sections added to the prompt:

**Turn 1 handling:**
```
## First Turn (Idea as First Message)
When the conversation has only one user message and no prior AI turns:
1. Acknowledge in 1 sentence what you inferred (platform, product type, etc.)
2. Share one PM insight showing you understand their domain (builds trust)
3. Ask the ONE question that matters most given what's still unknown
Do NOT ask about things you can already infer from their message.
```

**Off-topic handling:**
```
## Off-Topic Messages
If the user's message has nothing to do with building a software or digital product:
- Respond warmly and briefly redirect: "That's a bit outside my lane! I help teams
  scope out software products. Do you have a digital product idea in mind?"
- Set detected_modules: [], confidence_score_delta: 0, product_overview: ''
If the message is ambiguous (physical thing that might have a digital component):
- Ask: "Is there a software side to this — like a management tool, booking system,
  or customer-facing app?"
Never be dismissive. Stay warm and curious.
```

### `components/intake/ChatPanel.tsx`
- Dynamic placeholder: `messages.length === 0 ? "Describe the idea you want to build..." : "Tell me more..."`

### `components/intake/IntakeOverlay.tsx`
- Convert `initialMessage` prop to local state (initialized from prop) so reset can clear it
- On confirmed reset: also `setCurrentIdea('')` to prevent ghost re-send after re-session

### `components/intake/IntakeLayout.tsx`
- Pass `currentIdea` (from overlay state) instead of raw prop to `useIntakeChat`

### `lib/intake-utils.ts`
- Delete `bundleOnboardingContext()` function (no longer needed)

---

## What Does NOT Change
- System prompt persona and PM discovery skills (v3)
- `product_overview` field and display (v3)
- Confidence bar, module detection, pricing engine (v3)
- Dark/light mode (v3)
- Magic link auth flow (v3)
- Message edit (simplified but preserved)
- Reset two-step confirm UI (preserved, behavior fixed)

---

## Files Changed Summary

| File | Change |
|------|--------|
| `hooks/useIntakeChat.ts` | Remove onboarding gate, add auto-send effect, simplify editMessage |
| `lib/ai/system-prompt.ts` | Add turn-1 and off-topic handling sections |
| `components/intake/ChatPanel.tsx` | Dynamic input placeholder |
| `components/intake/IntakeOverlay.tsx` | Convert initialMessage to local state |
| `components/intake/IntakeLayout.tsx` | Wire currentIdea from overlay |
| `lib/intake-utils.ts` | Delete bundleOnboardingContext |
