import type Anthropic from '@anthropic-ai/sdk'

export const UPDATE_PROPOSAL_TOOL: Anthropic.Tool = {
  name: 'update_proposal',
  description:
    'Called by the AI after every turn to update the detected modules, confidence score, price adjustment, brief, and product overview. Always call this tool alongside the conversational response.',
  input_schema: {
    type: 'object' as const,
    properties: {
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
      follow_up_question: {
        type: 'string',
        description: 'Reaction and insight for this turn — NOT the question. Two sentences max. Write each as its own paragraph separated by \\n\\n. Example: "Nice, personal task management.\\n\\nThe to-do space is crowded (Todoist, Things 3, Notion) but people keep building new ones because none feel quite right." Do NOT include the question here — put it in the question field.',
      },
      question: {
        type: 'string',
        description: 'REQUIRED every turn. Never empty. The single question for this turn — one crisp sentence ending with ?. This is the user\'s call to action: what they read last and respond to. When quick replies are present it appears as the card header; otherwise it is appended to the message. If the idea is vague, ask what the product does. If the idea is clear, ask the most important architectural unknown.',
      },
      product_overview: {
        type: 'string',
        description: 'Product description for a non-technical investor. No jargon. Grow this every turn — never shorten it. Format:\n- Turn 1-2: 1-2 sentences.\n- Turn 3-4: One 3-5 sentence paragraph.\n- Turn 5+: Labeled sections separated by \\n\\n, 2-3 sentences each. Available sections: "What it is", "Who it\'s for", "How it works", "Key features", "Monetization" (only if known), "Why it matters" (only if competitive angle is clear). Skip sections with no real information. Be specific — every sentence must reflect what was actually discussed.',
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
      module_summaries: {
        type: 'object' as const,
        description:
          'Optional. For each currently active module ID, a 1–2 sentence project-specific note describing what was decided and what the module will contain for this specific product. Keys are module IDs (e.g. "auth", "payments"). Values are plain sentences, no markdown. Update these incrementally — include all active modules, not just newly added ones.',
        additionalProperties: { type: 'string' as const },
      },
    },
    required: ['detected_modules', 'confidence_score_delta', 'complexity_multiplier', 'updated_brief', 'follow_up_question', 'question', 'product_overview'],
  },
}
