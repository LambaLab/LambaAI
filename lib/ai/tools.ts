import type Anthropic from '@anthropic-ai/sdk'

export const UPDATE_PROPOSAL_TOOL: Anthropic.Tool = {
  name: 'update_proposal',
  description:
    'Called by the AI after every turn to update the detected modules, confidence score, price adjustment, and brief. Always call this tool alongside the conversational response.',
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
      capability_cards: {
        type: 'array',
        items: { type: 'string' },
        description: 'Optional capability card labels to show inline (e.g. "Payments", "Mobile App")',
      },
    },
    required: ['detected_modules', 'confidence_score_delta', 'complexity_multiplier', 'updated_brief', 'follow_up_question'],
  },
}
