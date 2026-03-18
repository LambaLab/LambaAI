# Project Tracker — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a "Tracker" tab in ProposalDetail that breaks down each module into AI-generated subtasks with statuses and auto-calculated progress — the foundation for the client-facing project tracker.

**Architecture:** New `project_tasks` Supabase table stores tasks with parent/child relationships (modules are parents, subtasks are children). A new API route calls Claude to generate task breakdowns from the proposal's modules + brief + PRD. The Tracker tab renders an expandable table like the reference design (collapsible module rows with subtask rows underneath). Status transitions (To Do → In Progress → Done) update via PATCH. Progress bars on parent modules auto-calculate from child task completion.

**Tech Stack:** Next.js App Router, Supabase (PostgreSQL), Anthropic Claude API (claude-sonnet-4-6), Tailwind CSS, Lucide React icons.

---

## Data Model

### `project_tasks` table schema

```sql
CREATE TABLE project_tasks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  proposal_id UUID NOT NULL REFERENCES proposals(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES project_tasks(id) ON DELETE CASCADE,  -- NULL = module-level parent
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'done')),
  sort_order INTEGER NOT NULL DEFAULT 0,
  complexity TEXT CHECK (complexity IN ('S', 'M', 'L')),  -- only on subtasks
  module_id TEXT,  -- references MODULE_CATALOG id, only on parent rows
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX idx_project_tasks_proposal ON project_tasks(proposal_id);
CREATE INDEX idx_project_tasks_parent ON project_tasks(parent_id);

-- RLS
ALTER TABLE project_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access" ON project_tasks FOR ALL USING (true);
```

---

## Task 1: Database Migration

**Files:**
- Create: `supabase/migrations/009_project_tasks.sql`

**Step 1: Write the migration SQL**

Create the file with the exact SQL from the Data Model section above.

**Step 2: Run the migration against Supabase**

Run via Supabase dashboard SQL editor or CLI:
```bash
# If using Supabase CLI:
npx supabase db push
# Otherwise paste SQL into Supabase Dashboard > SQL Editor and execute
```

**Step 3: Update TypeScript types**

Modify: `lib/supabase/types.ts`

Add to the `Tables` section inside `public`:

```typescript
project_tasks: {
  Row: {
    id: string
    proposal_id: string
    parent_id: string | null
    title: string
    description: string | null
    status: 'todo' | 'in_progress' | 'done'
    sort_order: number
    complexity: string | null
    module_id: string | null
    created_at: string
    updated_at: string
  }
  Insert: {
    id?: string
    proposal_id: string
    parent_id?: string | null
    title: string
    description?: string | null
    status?: 'todo' | 'in_progress' | 'done'
    sort_order?: number
    complexity?: string | null
    module_id?: string | null
    created_at?: string
    updated_at?: string
  }
  Update: {
    id?: string
    proposal_id?: string
    parent_id?: string | null
    title?: string
    description?: string | null
    status?: 'todo' | 'in_progress' | 'done'
    sort_order?: number
    complexity?: string | null
    module_id?: string | null
    created_at?: string
    updated_at?: string
  }
  Relationships: [
    {
      foreignKeyName: "project_tasks_proposal_id_fkey"
      columns: ["proposal_id"]
      isOneToOne: false
      referencedRelation: "proposals"
      referencedColumns: ["id"]
    },
    {
      foreignKeyName: "project_tasks_parent_id_fkey"
      columns: ["parent_id"]
      isOneToOne: false
      referencedRelation: "project_tasks"
      referencedColumns: ["id"]
    }
  ]
}
```

**Step 4: Commit**

```bash
git add supabase/migrations/009_project_tasks.sql lib/supabase/types.ts
git commit -m "feat: add project_tasks table for tracker"
```

---

## Task 2: API — CRUD for Project Tasks

**Files:**
- Create: `app/api/admin/proposals/[id]/tasks/route.ts`

**Step 1: Create the tasks API route**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin } from '@/lib/admin/auth'
import { createServiceClient } from '@/lib/supabase/server'

// GET — fetch all tasks for a proposal (parents + children)
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await verifyAdmin()
  if (!auth.admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const supabase = createServiceClient()
  const { id } = await params

  const { data, error } = await supabase
    .from('project_tasks')
    .select('*')
    .eq('proposal_id', id)
    .order('sort_order', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

// POST — create a new task (parent or subtask)
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await verifyAdmin()
  if (!auth.admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const supabase = createServiceClient()
  const { id } = await params
  const body = await req.json()

  const { data, error } = await supabase
    .from('project_tasks')
    .insert({ ...body, proposal_id: id })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// PATCH — bulk update tasks (status changes, reorder)
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await verifyAdmin()
  if (!auth.admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const supabase = createServiceClient()
  const { id } = await params
  const { taskId, updates } = await req.json()

  const allowedFields = ['title', 'description', 'status', 'sort_order', 'complexity']
  const filtered = Object.fromEntries(
    Object.entries(updates).filter(([key]) => allowedFields.includes(key))
  )

  const { data, error } = await supabase
    .from('project_tasks')
    .update(filtered)
    .eq('id', taskId)
    .eq('proposal_id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// DELETE — remove a task (and children via CASCADE)
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await verifyAdmin()
  if (!auth.admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const supabase = createServiceClient()
  const { id } = await params
  const { taskId } = await req.json()

  const { error } = await supabase
    .from('project_tasks')
    .delete()
    .eq('id', taskId)
    .eq('proposal_id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
```

**Step 2: Commit**

```bash
git add app/api/admin/proposals/[id]/tasks/route.ts
git commit -m "feat: add CRUD API for project tasks"
```

---

## Task 3: API — AI Task Generation

**Files:**
- Create: `app/api/admin/proposals/[id]/tasks/generate/route.ts`

**Step 1: Create the AI generation endpoint**

```typescript
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

MODULES: ${moduleNames.join(', ')}

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
                  module_id: { type: 'string', description: 'The module ID from the catalog' },
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
        status: 'todo',
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
```

**Step 2: Commit**

```bash
git add app/api/admin/proposals/[id]/tasks/generate/route.ts
git commit -m "feat: add AI task generation endpoint"
```

---

## Task 4: TrackerTab Component

**Files:**
- Create: `components/admin/TrackerTab.tsx`

This is the main UI component. It renders:
- A table-like layout with TASK, STATUS, PROGRESS columns
- Collapsible module rows (parent tasks) with chevron toggle
- Subtask rows indented under each module with colored status dots
- Status badges: To Do (gray), In Progress (amber), Done (green)
- Auto-calculated progress bars on parent modules
- "Generate Tasks" button + auto-generate on first open
- Inline status change via dropdown on each task row
- "+ Add subtask" button under each module

**Step 1: Create the TrackerTab component**

```typescript
'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { ChevronRight, ChevronDown, Plus, Sparkles, Loader2, MoreHorizontal, Trash2 } from 'lucide-react'
import type { Database } from '@/lib/supabase/types'
import { MODULE_CATALOG } from '@/lib/modules/catalog'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

type ProjectTask = Database['public']['Tables']['project_tasks']['Row']
type TaskStatus = 'todo' | 'in_progress' | 'done'

type Props = {
  proposalId: string
}

const STATUS_CONFIG: Record<TaskStatus, { label: string; bg: string; text: string; dot: string }> = {
  todo: { label: 'To Do', bg: 'bg-zinc-100 dark:bg-zinc-800', text: 'text-zinc-600 dark:text-zinc-400', dot: 'bg-zinc-400' },
  in_progress: { label: 'In Progress', bg: 'bg-amber-50 dark:bg-amber-500/10', text: 'text-amber-700 dark:text-amber-400', dot: 'bg-amber-500' },
  done: { label: 'Done', bg: 'bg-emerald-50 dark:bg-emerald-500/10', text: 'text-emerald-700 dark:text-emerald-400', dot: 'bg-emerald-500' },
}

const COMPLEXITY_COLORS: Record<string, string> = {
  S: 'bg-green-500',
  M: 'bg-amber-500',
  L: 'bg-red-500',
}

export default function TrackerTab({ proposalId }: Props) {
  const [tasks, setTasks] = useState<ProjectTask[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set())
  const [addingSubtask, setAddingSubtask] = useState<string | null>(null)
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('')
  const hasAutoGenerated = useRef(false)

  // Fetch tasks
  const fetchTasks = useCallback(async () => {
    const res = await fetch(`/api/admin/proposals/${proposalId}/tasks`)
    if (res.ok) {
      const data = await res.json()
      setTasks(data)
      return data as ProjectTask[]
    }
    return []
  }, [proposalId])

  // Initial load + auto-generate if empty
  useEffect(() => {
    async function init() {
      const data = await fetchTasks()
      setLoading(false)

      // Auto-generate if no tasks exist and haven't tried yet
      if (data.length === 0 && !hasAutoGenerated.current) {
        hasAutoGenerated.current = true
        await handleGenerate()
      }
    }
    init()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proposalId])

  // Generate tasks via AI
  const handleGenerate = async () => {
    setGenerating(true)
    try {
      const res = await fetch(`/api/admin/proposals/${proposalId}/tasks/generate`, { method: 'POST' })
      if (res.ok) {
        const data = await res.json()
        setTasks(data)
        // Auto-expand all modules
        const parentIds = (data as ProjectTask[]).filter(t => !t.parent_id).map(t => t.id)
        setExpandedModules(new Set(parentIds))
      }
    } catch { /* ignore */ }
    setGenerating(false)
  }

  // Update task status
  const handleStatusChange = async (taskId: string, newStatus: TaskStatus) => {
    // Optimistic update
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus } : t))

    await fetch(`/api/admin/proposals/${proposalId}/tasks`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ taskId, updates: { status: newStatus } }),
    })
  }

  // Add subtask
  const handleAddSubtask = async (parentId: string) => {
    if (!newSubtaskTitle.trim()) return

    const siblings = tasks.filter(t => t.parent_id === parentId)
    const res = await fetch(`/api/admin/proposals/${proposalId}/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        parent_id: parentId,
        title: newSubtaskTitle.trim(),
        sort_order: siblings.length,
        status: 'todo',
      }),
    })

    if (res.ok) {
      const newTask = await res.json()
      setTasks(prev => [...prev, newTask])
      setNewSubtaskTitle('')
      setAddingSubtask(null)
    }
  }

  // Delete task
  const handleDelete = async (taskId: string) => {
    setTasks(prev => prev.filter(t => t.id !== taskId && t.parent_id !== taskId))

    await fetch(`/api/admin/proposals/${proposalId}/tasks`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ taskId }),
    })
  }

  // Toggle module expand/collapse
  const toggleModule = (moduleId: string) => {
    setExpandedModules(prev => {
      const next = new Set(prev)
      if (next.has(moduleId)) next.delete(moduleId)
      else next.add(moduleId)
      return next
    })
  }

  // Organize tasks into parent/child structure
  const parentTasks = tasks.filter(t => !t.parent_id).sort((a, b) => a.sort_order - b.sort_order)
  const getChildren = (parentId: string) => tasks.filter(t => t.parent_id === parentId).sort((a, b) => a.sort_order - b.sort_order)

  // Calculate progress for a parent module
  const getProgress = (parentId: string) => {
    const children = getChildren(parentId)
    if (children.length === 0) return 0
    const done = children.filter(c => c.status === 'done').length
    return Math.round((done / children.length) * 100)
  }

  // Get progress bar color based on percentage
  const getProgressColor = (pct: number) => {
    if (pct === 100) return 'bg-emerald-500'
    if (pct > 50) return 'bg-amber-500'
    return 'bg-zinc-300 dark:bg-zinc-600'
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (generating) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <Loader2 className="w-6 h-6 animate-spin text-yellow-500" />
        <p className="text-sm text-muted-foreground">Generating task breakdown...</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header with regenerate button */}
      <div className="flex items-center justify-between px-6 md:px-8 py-3 border-b">
        <div className="text-xs text-muted-foreground">
          {parentTasks.length} module{parentTasks.length !== 1 ? 's' : ''} &middot; {tasks.filter(t => t.parent_id).length} tasks
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleGenerate}
          disabled={generating}
          className="text-xs cursor-pointer gap-1.5"
        >
          <Sparkles className="w-3.5 h-3.5" />
          Regenerate
        </Button>
      </div>

      {/* Table header */}
      <div className="grid grid-cols-[1fr_140px_120px] gap-2 px-6 md:px-8 py-2 text-[11px] uppercase tracking-widest font-medium text-muted-foreground/70 border-b">
        <span>Task</span>
        <span>Status</span>
        <span>Progress</span>
      </div>

      {/* Task rows */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {parentTasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <p className="text-sm text-muted-foreground">No tasks yet</p>
            <Button onClick={handleGenerate} className="gap-2 cursor-pointer">
              <Sparkles className="w-4 h-4" />
              Generate Tasks
            </Button>
          </div>
        ) : (
          parentTasks.map((parent) => {
            const children = getChildren(parent.id)
            const isOpen = expandedModules.has(parent.id)
            const progress = getProgress(parent.id)
            const parentStatus = children.length > 0
              ? children.every(c => c.status === 'done') ? 'done'
                : children.some(c => c.status === 'in_progress' || c.status === 'done') ? 'in_progress'
                : 'todo'
              : parent.status
            const statusCfg = STATUS_CONFIG[parentStatus as TaskStatus]

            return (
              <div key={parent.id}>
                {/* Parent module row */}
                <div
                  className="grid grid-cols-[1fr_140px_120px] gap-2 items-center px-6 md:px-8 py-3 hover:bg-muted/30 cursor-pointer border-b transition-colors"
                  onClick={() => toggleModule(parent.id)}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {isOpen ? <ChevronDown className="w-4 h-4 shrink-0 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 shrink-0 text-muted-foreground" />}
                    <span className="font-semibold text-sm truncate">{parent.title}</span>
                    <span className="text-xs text-muted-foreground shrink-0">({children.length})</span>
                  </div>

                  <span className={`inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-full w-fit ${statusCfg.bg} ${statusCfg.text}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${statusCfg.dot}`} />
                    {statusCfg.label}
                  </span>

                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${getProgressColor(progress)}`}
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                    <span className="text-xs text-muted-foreground w-8 text-right">{progress}%</span>
                  </div>
                </div>

                {/* Subtask rows */}
                {isOpen && (
                  <>
                    {children.map((child) => {
                      const childStatus = STATUS_CONFIG[child.status as TaskStatus]
                      return (
                        <div
                          key={child.id}
                          className="grid grid-cols-[1fr_140px_120px] gap-2 items-center pl-12 pr-6 md:pl-14 md:pr-8 py-2.5 hover:bg-muted/20 border-b border-dashed transition-colors group"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span className={`w-2 h-2 rounded-full shrink-0 ${childStatus.dot}`} />
                            <span className="text-sm truncate">{child.title}</span>
                            {child.complexity && (
                              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded text-white shrink-0 ${COMPLEXITY_COLORS[child.complexity] ?? 'bg-zinc-400'}`}>
                                {child.complexity}
                              </span>
                            )}
                          </div>

                          <Select value={child.status} onValueChange={(v) => handleStatusChange(child.id, v as TaskStatus)}>
                            <SelectTrigger className="h-7 text-[11px] border-0 shadow-none px-0 w-fit gap-1.5 cursor-pointer [&>svg:last-child]:hidden">
                              <span className={`inline-flex items-center gap-1.5 font-medium px-2.5 py-0.5 rounded-full ${childStatus.bg} ${childStatus.text}`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${childStatus.dot}`} />
                                {childStatus.label}
                              </span>
                            </SelectTrigger>
                            <SelectContent>
                              {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
                                <SelectItem key={key} value={key} className="text-xs">
                                  <span className="flex items-center gap-2">
                                    <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                                    {cfg.label}
                                  </span>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>

                          <div className="flex justify-end">
                            <button
                              onClick={() => handleDelete(child.id)}
                              className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive cursor-pointer p-1"
                              title="Delete task"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      )
                    })}

                    {/* Add subtask */}
                    {addingSubtask === parent.id ? (
                      <div className="flex items-center gap-2 pl-12 pr-6 md:pl-14 md:pr-8 py-2 border-b">
                        <input
                          value={newSubtaskTitle}
                          onChange={(e) => setNewSubtaskTitle(e.target.value)}
                          placeholder="New task title..."
                          className="flex-1 text-sm bg-transparent outline-none placeholder:text-muted-foreground/40"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleAddSubtask(parent.id)
                            if (e.key === 'Escape') { setAddingSubtask(null); setNewSubtaskTitle('') }
                          }}
                        />
                        <Button size="sm" variant="ghost" onClick={() => handleAddSubtask(parent.id)} className="text-xs cursor-pointer h-7">
                          Add
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => { setAddingSubtask(null); setNewSubtaskTitle('') }} className="text-xs cursor-pointer h-7">
                          Cancel
                        </Button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setAddingSubtask(parent.id)}
                        className="flex items-center gap-1.5 pl-12 md:pl-14 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer border-b"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Add subtask
                      </button>
                    )}
                  </>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add components/admin/TrackerTab.tsx
git commit -m "feat: add TrackerTab component with collapsible modules"
```

---

## Task 5: Wire TrackerTab into ProposalDetail

**Files:**
- Modify: `components/admin/ProposalDetail.tsx`

**Step 1: Add the Tracker tab**

1. Add import at top:
```typescript
import TrackerTab from './TrackerTab'
```

2. Update the `DetailTab` type:
```typescript
type DetailTab = 'proposal' | 'tracker' | 'chat'
```

3. Update the `tabs` array:
```typescript
const tabs: { value: DetailTab; label: string }[] = [
  { value: 'proposal', label: 'Proposal' },
  { value: 'tracker', label: 'Tracker' },
  { value: 'chat', label: 'Chat' },
]
```

4. Add the TrackerTab render in the tab content section, alongside the existing `activeTab === 'proposal'` and `activeTab === 'chat'` blocks:
```typescript
{activeTab === 'tracker' && (
  <TrackerTab proposalId={proposal.id} />
)}
```

**Step 2: Commit and push**

```bash
git add components/admin/ProposalDetail.tsx
git commit -m "feat: wire Tracker tab into ProposalDetail"
git push origin main
```

---

## Task 6: Polish & Edge Cases

**Files:**
- Modify: `components/admin/TrackerTab.tsx`

**Step 1: Handle expanded mode styling**

The TrackerTab should respect the `max-w-4xl mx-auto` centering when in expanded mode. Add an optional `isExpanded` prop:

```typescript
type Props = {
  proposalId: string
  isExpanded?: boolean
}
```

Wrap the content div with the expanded class when needed.

**Step 2: Pass isExpanded through from ProposalDetail**

In ProposalDetail, pass the prop:
```typescript
{activeTab === 'tracker' && (
  <TrackerTab proposalId={proposal.id} isExpanded={isExpanded} />
)}
```

Note: The `isExpanded` centering is already handled by the parent `max-w-4xl mx-auto` wrapper in ProposalDetail, so TrackerTab may not need its own wrapper — verify and adjust.

**Step 3: Commit and push**

```bash
git add components/admin/TrackerTab.tsx components/admin/ProposalDetail.tsx
git commit -m "feat: polish tracker tab, handle expanded mode"
git push origin main
```

---

## Summary

| Task | What | Files |
|------|------|-------|
| 1 | Database migration + types | `009_project_tasks.sql`, `types.ts` |
| 2 | CRUD API routes | `proposals/[id]/tasks/route.ts` |
| 3 | AI generation endpoint | `proposals/[id]/tasks/generate/route.ts` |
| 4 | TrackerTab component | `TrackerTab.tsx` |
| 5 | Wire into ProposalDetail | `ProposalDetail.tsx` |
| 6 | Polish & edge cases | Multiple |
