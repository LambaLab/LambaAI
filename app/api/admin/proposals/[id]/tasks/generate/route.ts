import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { verifyAdmin } from '@/lib/admin/auth'
import { createServiceClient } from '@/lib/supabase/server'
import { MODULE_CATALOG } from '@/lib/modules/catalog'

const anthropic = new Anthropic()

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await verifyAdmin()
  if (!auth.admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const supabase = createServiceClient()
  const { id } = await params

  // Fetch proposal data
  const { data: proposal, error: propError } = await supabase
    .from('proposals')
    .select('modules, brief, prd, metadata')
    .eq('id', id)
    .single()

  if (propError || !proposal) return NextResponse.json({ error: 'Proposal not found' }, { status: 404 })

  const modules = (proposal.modules ?? []) as string[]
  const moduleNames = modules.map(mid => MODULE_CATALOG.find(m => m.id === mid)?.name ?? mid)
  const meta = (proposal.metadata ?? {}) as Record<string, unknown>
  const productOverview = (meta.productOverview as string) ?? ''

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    messages: [
      {
        role: 'user',
        content: `You are a senior software project manager breaking down a project into tasks.

PROJECT BRIEF: ${proposal.brief ?? 'No brief available'}

PRODUCT OVERVIEW: ${productOverview}

PRD: ${proposal.prd ?? 'No PRD available'}

MODULES (with IDs): ${modules.map((mid, i) => `${mid} (${moduleNames[i]})`).join(', ')}

For each module, generate 3-6 specific, actionable subtasks that a development team would need to complete. Each subtask should be a concrete deliverable, not vague.

Examples of GOOD subtasks:
- "Set up Supabase auth with email/password"
- "Build login and signup screens"
- "Implement session persistence"

Examples of BAD subtasks:
- "Handle authentication" (too vague)
- "Do the backend" (not specific)

Return the breakdown as structured JSON.`,
      },
    ],
    tools: [
      {
        name: 'submit_task_breakdown',
        description: 'Submit the task breakdown for all modules',
        input_schema: {
          type: 'object' as const,
          properties: {
            modules: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  module_id: { type: 'string', description: 'The module ID from the catalog (e.g. auth, database, mobile_app)' },
                  module_name: { type: 'string', description: 'Human-readable module name' },
                  tasks: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        title: { type: 'string', description: 'Specific task title' },
                        description: { type: 'string', description: 'Brief description of what this task involves' },
                        complexity: { type: 'string', enum: ['S', 'M', 'L'] },
                      },
                      required: ['title', 'description', 'complexity'],
                    },
                  },
                },
                required: ['module_id', 'module_name', 'tasks'],
              },
            },
          },
          required: ['modules'],
        },
      },
    ],
    tool_choice: { type: 'tool', name: 'submit_task_breakdown' },
  })

  const toolUse = response.content.find(b => b.type === 'tool_use')
  if (!toolUse || toolUse.type !== 'tool_use') {
    return NextResponse.json({ error: 'AI generation failed' }, { status: 500 })
  }

  const breakdown = toolUse.input as {
    modules: Array<{
      module_id: string
      module_name: string
      tasks: Array<{ title: string; description: string; complexity: string }>
    }>
  }

  // Delete existing tasks for this proposal (regeneration)
  await supabase.from('project_tasks').delete().eq('proposal_id', id)

  // Insert parent modules and their subtasks
  const allTasks = []
  for (let i = 0; i < breakdown.modules.length; i++) {
    const mod = breakdown.modules[i]

    // Insert parent (module row)
    const { data: parent } = await supabase
      .from('project_tasks')
      .insert({
        proposal_id: id,
        parent_id: null,
        title: mod.module_name,
        module_id: mod.module_id,
        sort_order: i,
        status: 'todo' as const,
      })
      .select()
      .single()

    if (parent) {
      allTasks.push(parent)

      // Insert subtasks
      const subtasks = mod.tasks.map((task, j) => ({
        proposal_id: id,
        parent_id: parent.id,
        title: task.title,
        description: task.description,
        complexity: task.complexity,
        sort_order: j,
        status: 'todo' as const,
      }))

      const { data: children } = await supabase
        .from('project_tasks')
        .insert(subtasks)
        .select()

      if (children) allTasks.push(...children)
    }
  }

  return NextResponse.json(allTasks)
}
