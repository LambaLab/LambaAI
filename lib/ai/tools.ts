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
        minimum: -30,
        maximum: 30,
        description: 'Change to confidence score this turn (positive or negative, integer, range -30 to 30)',
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
        description: 'The single most important clarifying question to ask next (already embedded in conversational response).',
      },
      product_overview: {
        type: 'string',
        description: 'A plain-language 2–4 sentence paragraph describing the product for a non-technical audience. Written as if pitching to an investor. Start with 1 sentence after turn 1, grow to 3–4 sentences by turn 5. Never use technical jargon. Example: "A marketplace where independent designers sell custom home décor. Buyers browse by style and commission pieces directly from makers. The platform handles payments, messaging, and order tracking."',
      },
      capability_cards: {
        type: 'array',
        items: { type: 'string' },
        description: 'Optional capability card labels to show inline (e.g. "Payments", "Mobile App")',
      },
      quick_replies: {
        type: 'object' as const,
        description: 'Optional. Include only when the question has 3-4 genuinely discrete options. Skip for open-ended questions.',
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
            description: 'true to append a "Type something else..." option. Use unless options are exhaustive.',
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
    },
    required: ['detected_modules', 'confidence_score_delta', 'complexity_multiplier', 'updated_brief', 'follow_up_question', 'product_overview'],
  },
}
