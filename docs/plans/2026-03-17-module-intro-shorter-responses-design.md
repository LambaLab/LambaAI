# Module Introduction + Shorter Responses Design

**Goal:** Two changes to the AI intake conversation:
1. Responses are too verbose — enforce 2 sentences max in `follow_up_question`
2. No "stage-setting" moment before module deep-dives — add a brief intro line before the ModuleProgressCard renders

**Files to change:** `lib/ai/system-prompt.ts` (system prompt only — no component/hook changes needed)

---

## Change 1: 2 Sentence Max

Current rule allows 1 sentence reaction + 1-2 sentence insight = up to 3 sentences. Users find this too wordy.

**New rule:** `follow_up_question` is hard-capped at 2 sentences total. First sentence reacts, second optionally shares an insight. If the reaction already contains the insight, one sentence is fine.

Update:
- The "Pattern: Every Single Turn" section
- All worked examples that exceed 2 sentences

## Change 2: Module Introduction Turn

When transitioning from discovery to deep_dive, the AI should set the stage before the ModuleProgressCard appears.

**AI text (follow_up_question):**
- Sentence 1: React to the last discovery answer
- Line break (`\n\n`)
- Sentence 2: Short setup like "Here's what we'll scope out, a few questions each."

The ModuleProgressCard (visual checklist with icons, current/upcoming states) renders automatically below the bubble — the hook already inserts it when `current_module` is first set. No component changes needed.

**System prompt update:** Rewrite the discovery-to-deep-dive transition instructions to emphasize the intro moment and line break formatting.
