import type Anthropic from '@anthropic-ai/sdk'

export const UPDATE_PROPOSAL_TOOL: Anthropic.Tool = {
  name: 'update_proposal',
  description:
    'Called by the AI after every turn to update the detected modules, confidence score, price adjustment, brief, and product overview. Always call this tool alongside the conversational response.',
  input_schema: {
    type: 'object' as const,
    properties: {
      // follow_up_question MUST be first — the server extracts it from the
      // streaming JSON delta and forwards it to the client as live text events
      // so the user sees the reaction immediately without waiting for the full JSON.
      follow_up_question: {
        type: 'string',
        description: 'Reaction and insight for this turn — NOT the question. Two paragraphs max, separated by \\n\\n. Paragraph 1: 1-sentence reaction, specific to what they said. Paragraph 2: 1-2 sentence insight (comparable product, tension, tradeoff). Skip paragraph 2 only for very vague inputs with nothing to riff on. Do NOT include the question here — put it in the question field.',
      },
      // transition_text is OPTIONAL — only set when pivoting to a new topic area.
      // When present and non-empty, the server streams it into a second chat bubble
      // (via bubble_split event) so topic transitions appear as visually distinct
      // messages rather than being buried inside the reaction paragraph.
      transition_text: {
        type: 'string',
        description: 'Only set when pivoting to a new topic area for the first time (e.g. moving from features to monetization, or from platform to target users). 1-2 sentences max. Reference specific facts the user already stated — use their exact words or numbers (e.g. "you mentioned a 7-day trial", "since you\'re going iOS-first"). Write it as a natural spoken bridge: acknowledge where we just were and orient toward the new territory. Leave as an empty string ("") when staying within the same topic, or when no prior-stated facts are relevant. Never use it for generic transitions like "Now let\'s talk about..." with no callback to their own words. Always leave as "" on suggest_pause turns.',
      },
      // suggest_pause MUST come before question/quick_replies — the server checks it
      // before emitting a partial_result event. When true, partial_result is suppressed
      // so the reaction bubble doesn't receive checkpoint QRs prematurely; the pause
      // checkpoint is created separately in tool_result.
      suggest_pause: {
        type: 'boolean' as const,
        description: 'Set to true when confidence is 60%+ and you have covered: platform, target users, core workflow, and rough monetization. Can fire multiple times as the conversation deepens — for example at 60% and again at 80%. Never trigger two checkpoints back-to-back; wait at least 4 turns between them.',
      },
      // question and quick_replies MUST come after suggest_pause so the server always
      // knows whether this is a pause turn before partial_result fires.
      // They also MUST come before the heavy metadata fields (product_overview,
      // module_summaries) — placing them early eliminates a 5–7 second delay where
      // the user would otherwise see nothing after the text stops streaming.
      question: {
        type: 'string',
        description: 'REQUIRED every turn. Never empty. Ends with ?. On normal turns: one crisp question sentence — the user\'s call to action. On suggest_pause turns: 2-4 sentences covering what\'s been established (use the user\'s exact words/numbers), note that progress is saved, then close with a warm invitation to review, continue, or save.',
      },
      quick_replies: {
        type: 'object' as const,
        description: 'Include on almost every turn (see system prompt). For open-ended or numeric questions, provide 2-3 example options with allowCustom: true so users have a starting point.',
        properties: {
          style: {
            type: 'string' as const,
            enum: ['list', 'pills'],
            description: 'list = numbered items with descriptions (default for most decisions). pills = compact chips (simple/short answers like yes/no or platform choice).',
          },
          multiSelect: {
            type: 'boolean' as const,
            description: 'true if the user can pick multiple answers (e.g. "which features do you need?")',
          },
          allowCustom: {
            type: 'boolean' as const,
            description: 'For list style, always set to true unless options are truly exhaustive. Adds a "Type something else..." row at the bottom.',
          },
          options: {
            type: 'array' as const,
            items: {
              type: 'object' as const,
              properties: {
                label: { type: 'string' as const, description: 'Short bold label (≤5 words)' },
                description: { type: 'string' as const, description: 'Subtitle for list style only (≤12 words)' },
                icon: { type: 'string' as const, description: 'Single emoji' },
                value: { type: 'string' as const, description: 'Text sent as user message when tapped' },
              },
              required: ['label', 'value'],
            },
          },
        },
        required: ['style', 'options'],
      },
      detected_modules: {
        type: 'array',
        items: { type: 'string' },
        description: 'List of module IDs detected so far (from the module catalog)',
      },
      confidence_score_delta: {
        type: 'number',
        minimum: -20,
        maximum: 10,
        description: 'Change to confidence score this turn (positive or negative, integer). Maximum +10 per turn — do not exceed this even if a lot was learned. Range -20 to 10.',
      },
      complexity_multiplier: {
        type: 'number',
        minimum: 0.5,
        maximum: 2.0,
        description: 'Complexity adjustment multiplier (0.5–2.0). 1.0 = no change. Use >1 for complex, <1 for simple.',
      },
      updated_brief: {
        type: 'string',
        description: 'Concise 2–4 sentence brief of the project as understood so far.',
      },
      product_overview: {
        type: 'string',
        description: 'Product description for a non-technical investor. No jargon. Only update when meaningful new information was learned this turn. If nothing significant changed, return an empty string — the previous overview is preserved automatically. When updating — never shorten existing content, only expand. Format:\n- Turn 1-2: 1-2 sentences.\n- Turn 3-4: One 3-5 sentence paragraph.\n- Turn 5+: Labeled sections separated by \\n\\n, 2-3 sentences each. Available sections: "What it is", "Who it\'s for", "How it works", "Key features", "Monetization" (only if known), "Why it matters" (only if competitive angle is clear). Skip sections with no real information. Be specific — every sentence must reflect what was actually discussed.',
      },
      module_summaries: {
        type: 'object' as const,
        description:
          'Optional. Only include entries for modules that were newly detected or had their scope meaningfully clarified this turn. Previously established summaries are preserved automatically — omit unchanged modules. Keys are module IDs (e.g. "auth", "payments"). Values are 1–2 plain sentences specific to this product, no markdown.',
        additionalProperties: { type: 'string' as const },
      },
    },
    required: ['follow_up_question', 'detected_modules', 'confidence_score_delta', 'complexity_multiplier', 'updated_brief', 'question', 'product_overview'],
  },
}
