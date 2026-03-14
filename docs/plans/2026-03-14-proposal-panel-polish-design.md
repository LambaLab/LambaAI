# Design: Proposal Panel Polish

**Date:** 2026-03-14
**Status:** Approved

---

## Scope

Three UI enhancements to the intake experience:

1. Module cards expand with AI-generated summaries (no more X badge)
2. Typing indicator shows rotating single-word labels instead of bouncing dots
3. AI messages display the Lamba Lab logo as an avatar

---

## 1 · Module Card Accordion + AI Summary

### Behaviour

- **Active modules**: card expands smoothly to reveal a 1–2 sentence AI-written note specific to the project. The `X` badge is removed. A small muted `×` lives inside the expanded body (bottom-right) so the user can still deactivate.
- **Inactive modules**: unchanged — collapsed, `+` badge, 50% opacity.
- Expansion animation uses CSS `grid-template-rows: 0fr → 1fr` transition (reliable, no max-height guessing).

### Data Flow

```
AI tool (update_proposal)
  └─ new field: module_summaries?: { [moduleId: string]: string }
       └─ useIntakeChat: moduleSummaries state
            └─ ModulesPanel: receives moduleSummaries prop
                 └─ ModuleCard: receives summary?: string prop
                      └─ renders expanded body when isActive && summary
```

### AI Tool Changes

- Add `module_summaries` to `UPDATE_PROPOSAL_TOOL` input schema (optional object, keys = module IDs, values = strings ≤ 2 sentences)
- Add `module_summaries` to `UpdateProposalInput` type in `useIntakeChat.ts`
- System prompt addition: instruct AI to write a project-specific note for each active module — what was decided and what it will contain for this specific product

### Component Changes

**`lib/ai/tools.ts`**
- Add `module_summaries` property to tool schema

**`hooks/useIntakeChat.ts`**
- Add `moduleSummaries` state: `{ [moduleId: string]: string }`
- On tool call, merge new summaries into existing (so older summaries survive if AI omits them in a later turn)
- Expose `moduleSummaries` from hook return

**`components/intake/ModulesPanel.tsx`**
- Accept `moduleSummaries: { [id: string]: string }` prop
- Pass `summary={moduleSummaries[id]}` to each `ModuleCard`

**`components/intake/ModuleCard.tsx`**
- Accept `summary?: string` prop
- Replace `X` badge with no badge when active
- Render expandable body div using `grid-template-rows` transition
- Small muted `×` deactivate affordance inside expanded body

**`components/intake/IntakeLayout.tsx`** / **`IntakeOverlay.tsx`**
- Thread `moduleSummaries` from hook down to `ModulesPanel`

---

## 2 · Typing Indicator — Rotating Single-Word Labels

### Behaviour

When `isStreaming && !rawContent` (AI has started but no text yet), show a cycling single-word label with a vertical slide-up + fade transition.

Labels (cycle every ~2s):
```
Thinking… → Analyzing… → Planning… → Mapping… → Building…
```

### Component Changes

**New: `components/intake/TypingIndicator.tsx`**
- `setInterval` cycles through labels array
- CSS transition: `opacity` + `translateY` for slide-up effect
- On unmount, clears interval

**`components/intake/MessageBubble.tsx`**
- Replace the 3-dot bounce span with `<TypingIndicator />`

---

## 3 · AI Avatar

### Behaviour

- Lamba Lab logo image (`/public/lamba-icon.png`) shown as `24×24` rounded avatar to the left of every AI message bubble
- User messages: no avatar, stay right-aligned
- Layout: `flex-row gap-2` with avatar column + bubble column

### Asset

- Save attached logo as `/public/lamba-icon.png`

### Component Changes

**`components/intake/MessageBubble.tsx`**
- AI messages: wrap in `flex items-start gap-2`
- Add `<Image src="/lamba-icon.png" width={24} height={24} className="rounded-full flex-shrink-0 mt-0.5" />`
- User messages unchanged

---

## Files Touched

| File | Change |
|------|--------|
| `lib/ai/tools.ts` | Add `module_summaries` to tool schema |
| `hooks/useIntakeChat.ts` | Add `moduleSummaries` state + threading |
| `components/intake/ModuleCard.tsx` | Accordion expansion, remove X, add summary body |
| `components/intake/ModulesPanel.tsx` | Accept + pass `moduleSummaries` prop |
| `components/intake/IntakeLayout.tsx` | Thread `moduleSummaries` |
| `components/intake/IntakeOverlay.tsx` | Thread `moduleSummaries` |
| `components/intake/MessageBubble.tsx` | Avatar + TypingIndicator |
| `components/intake/TypingIndicator.tsx` | New component |
| `public/lamba-icon.png` | New asset |
| `app/api/intake/chat/route.ts` | System prompt update for module summaries |
