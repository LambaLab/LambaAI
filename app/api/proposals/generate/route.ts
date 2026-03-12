import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createServiceClient } from '@/lib/supabase/server'
import type { Json } from '@/lib/supabase/types'

const anthropic = new Anthropic()

export async function POST(req: NextRequest) {
  const { proposalId } = await req.json()
  if (!proposalId) return NextResponse.json({ error: 'Missing proposalId' }, { status: 400 })

  const supabase = await createServiceClient()

  const { data: proposal } = await supabase
    .from('proposals')
    .select('*')
    .eq('id', proposalId)
    .single()

  if (!proposal) return NextResponse.json({ error: 'Proposal not found' }, { status: 404 })
  if (proposal.status !== 'draft') return NextResponse.json({ error: 'Proposal already generated' }, { status: 409 })

  const { data: messages } = await supabase
    .from('chat_messages')
    .select('role, content')
    .eq('proposal_id', proposalId)
    .order('created_at', { ascending: true })

  const chatHistory = (messages ?? []).map((m) => `${m.role}: ${m.content}`).join('\n\n')

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    messages: [
      {
        role: 'user',
        content: `Based on the following product discovery conversation, generate a complete project proposal for Lamba Lab's client.

CONVERSATION:
${chatHistory}

DETECTED MODULES: ${JSON.stringify(proposal.modules)}
PROJECT BRIEF: ${proposal.brief}

Generate a structured proposal with these sections:
1. PRD (Product Requirements Document) — goals, users, features, non-goals
2. Technical Architecture — stack choices, data models, API design
3. Task Breakdown — grouped by module, each task with complexity (S/M/L)
4. Timeline — week-by-week milestone plan
5. Milestone Plan — 3-5 major milestones with deliverables

Format as structured JSON.`,
      },
    ],
    tools: [
      {
        name: 'submit_proposal',
        description: 'Submit the completed proposal document',
        input_schema: {
          type: 'object' as const,
          properties: {
            prd: { type: 'string', description: 'Full PRD as markdown' },
            technical_architecture: { type: 'string', description: 'Technical architecture as markdown' },
            task_breakdown: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  module: { type: 'string' },
                  tasks: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        name: { type: 'string' },
                        complexity: { type: 'string', enum: ['S', 'M', 'L'] },
                        description: { type: 'string' },
                      },
                    },
                  },
                },
              },
            },
            timeline: { type: 'string', description: 'Week-by-week timeline as markdown' },
            milestone_plan: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  week: { type: 'number' },
                  deliverables: { type: 'array', items: { type: 'string' } },
                },
              },
            },
          },
          required: ['prd', 'technical_architecture', 'task_breakdown', 'timeline', 'milestone_plan'],
        },
      },
    ],
    tool_choice: { type: 'tool', name: 'submit_proposal' },
  })

  const toolUse = response.content.find((b) => b.type === 'tool_use')
  if (!toolUse || toolUse.type !== 'tool_use') {
    return NextResponse.json({ error: 'Failed to generate proposal' }, { status: 500 })
  }

  const proposalData = toolUse.input as {
    prd: string
    technical_architecture: string
    task_breakdown: Json
    timeline: string
    milestone_plan: Json
  }

  const { error: updateError } = await supabase
    .from('proposals')
    .update({
      prd: proposalData.prd,
      technical_architecture: proposalData.technical_architecture,
      task_breakdown: proposalData.task_breakdown,
      timeline: proposalData.timeline,
      milestone_plan: proposalData.milestone_plan,
    })
    .eq('id', proposalId)

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
