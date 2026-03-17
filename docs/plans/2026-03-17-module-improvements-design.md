# Module Improvements Design

**Date:** 2026-03-17
**Status:** Approved

## Problem

1. Modules turn yellow/active the moment the AI detects them — before any discussion. This makes the proposal look more complete than it is.
2. Missing important modules that non-technical users expect: AI, Monetization, Branding, Third-party Integrations.
3. The AI doesn't proactively surface AI or monetization as considerations.

## Design

### 1. New Modules

Add 4 new modules to the catalog. Replace existing `ai_features` with simpler `ai`.

| Module | ID | Description | Category |
|--------|-----|-------------|----------|
| AI | `ai` | Smart features like chatbots, recommendations, and automation | feature |
| Monetization | `monetization` | How your app makes money — subscriptions, one-time purchase, ads, freemium | business |
| Branding | `branding` | App name, domain, logo, colors, and visual identity | business |
| Third-party Integrations | `integrations` | Connecting to other services like social login, maps, and email tools | feature |

Remove `ai_features` (replaced by `ai`). Update dependency graph accordingly.

### 2. Module Activation Logic

**Two-state module tracking** replacing the single `activeModules` array:

- `detectedModules: string[]` — modules the AI has identified as relevant (shown grey)
- `confirmedModules: string[]` — modules the AI has fully discussed and scoped (shown yellow + ✓)

A module only moves from detected → confirmed when the AI completes its deep-dive questions for that module.

### 3. Visual States

| State | Chat "What we'll cover" list | Proposal Panel (right) |
|-------|------------------------------|------------------------|
| Detected, not yet discussed | ○ circle, white text | Grey card, 50% opacity |
| Currently being discussed | ○ circle, highlighted | Grey card, subtle glow/border |
| Fully discussed & confirmed | ✓ green checkmark | Yellow card, fully active |

Both panels sync from the same state source (`detectedModules` + `confirmedModules`).

### 4. AI System Prompt Changes

- AI response JSON includes both `detected_modules` and `confirmed_modules`
- `detected_modules`: updated whenever AI identifies new relevant modules
- `confirmed_modules`: only updated when AI finishes deep-diving a module
- AI should proactively consider AI, Monetization, and Branding for every project
- Module descriptions in the prompt should use non-technical language

### 5. Manual Module Toggle (Future)

Deferred to a later phase. Users will eventually be able to pick modules from a list, which queues them for the AI to scope. Until then, the AI is the only path to activating modules.

## Files to Change

1. `lib/modules/catalog.ts` — add new modules, remove `ai_features`
2. `lib/modules/dependencies.ts` — update dependency graph for new module IDs
3. `lib/ai/system-prompt.ts` — add `confirmed_modules` to AI output, update module descriptions, instruct AI to proactively consider AI/monetization/branding
4. `hooks/useIntakeChat.ts` — split `activeModules` into `detectedModules` + `confirmedModules`, handle both SSE fields
5. `components/intake/ModulesPanel.tsx` — use `confirmedModules` for yellow, `detectedModules` for grey
6. `components/intake/ModuleCard.tsx` — add "detected but not confirmed" visual state
7. `components/intake/ChatPanel.tsx` — sync ✓ checkmarks with `confirmedModules`
8. `app/api/intake/chat/route.ts` — parse and emit `confirmed_modules` from AI response
