'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { Save, Check, Plus, X } from 'lucide-react'
import type { Database } from '@/lib/supabase/types'
import { MODULE_CATALOG } from '@/lib/modules/catalog'
import { Button } from '@/components/ui/button'

type Proposal = Database['public']['Tables']['proposals']['Row']

type Props = {
  proposal: Proposal
  onUpdate: (updated: Proposal) => void
}

type TaskItem = { name: string; complexity: string; description: string }
type TaskBreakdown = { module: string; tasks: TaskItem[] }[]

// Status options removed — status is shown in the header badge

export default function ProposalEditor({ proposal, onUpdate }: Props) {
  const [saving, setSaving] = useState(false)
  const [lastSaved, setLastSaved] = useState<number | null>(null)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Local form state
  const meta = (proposal.metadata ?? {}) as Record<string, unknown>
  const [projectName, setProjectName] = useState((meta.projectName as string) ?? '')
  const [brief, setBrief] = useState(proposal.brief ?? '')
  const [productOverview, setProductOverview] = useState((meta.productOverview as string) ?? '')
  const [adminNotes, setAdminNotes] = useState(proposal.admin_notes ?? '')
  const [prd, setPrd] = useState(proposal.prd ?? '')
  const [techArch, setTechArch] = useState(proposal.technical_architecture ?? '')
  const [timeline, setTimeline] = useState(proposal.timeline ?? '')
  const [modules, setModules] = useState<string[]>((proposal.modules ?? []) as string[])

  // Reset form when proposal changes
  useEffect(() => {
    const m = (proposal.metadata ?? {}) as Record<string, unknown>
    setProjectName((m.projectName as string) ?? '')
    setBrief(proposal.brief ?? '')
    setProductOverview((m.productOverview as string) ?? '')
    setAdminNotes(proposal.admin_notes ?? '')
    setPrd(proposal.prd ?? '')
    setTechArch(proposal.technical_architecture ?? '')
    setTimeline(proposal.timeline ?? '')
    setModules((proposal.modules ?? []) as string[])
  }, [proposal.id])

  const saveChanges = useCallback(async (updates: Record<string, unknown>) => {
    setSaving(true)
    const res = await fetch(`/api/admin/proposals/${proposal.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    })
    if (res.ok) {
      const updated = await res.json()
      onUpdate(updated)
      setLastSaved(Date.now())
    }
    setSaving(false)
  }, [proposal.id, onUpdate])

  // Debounced auto-save
  function debounceSave(updates: Record<string, unknown>) {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => saveChanges(updates), 1000)
  }

  function handleFieldChange(field: string, value: string) {
    switch (field) {
      case 'brief':
        setBrief(value)
        debounceSave({ brief: value })
        break
      case 'admin_notes':
        setAdminNotes(value)
        debounceSave({ admin_notes: value })
        break
      case 'prd':
        setPrd(value)
        debounceSave({ prd: value })
        break
      case 'technical_architecture':
        setTechArch(value)
        debounceSave({ technical_architecture: value })
        break
      case 'timeline':
        setTimeline(value)
        debounceSave({ timeline: value })
        break
      case 'projectName':
        setProjectName(value)
        debounceSave({ metadata: { ...meta, projectName: value } })
        break
      case 'productOverview':
        setProductOverview(value)
        debounceSave({ metadata: { ...meta, productOverview: value } })
        break
    }
  }

  function handleToggleModule(moduleId: string) {
    const updated = modules.includes(moduleId)
      ? modules.filter((m) => m !== moduleId)
      : [...modules, moduleId]
    setModules(updated)
    saveChanges({ modules: updated })
  }

  return (
    <div className="px-6 md:px-8 py-5 space-y-5">
      {/* Save indicator */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {saving && <span className="flex items-center gap-1"><Save className="w-3 h-3 animate-pulse" /> Saving...</span>}
        {!saving && lastSaved && (
          <span className="flex items-center gap-1 text-green-500"><Check className="w-3 h-3" /> Saved</span>
        )}
      </div>

      {/* Project Name */}
      <Field label="Project name">
        <input
          value={projectName}
          onChange={(e) => handleFieldChange('projectName', e.target.value)}
          placeholder="e.g., FitTrack Pro"
          className="w-full text-lg font-medium bg-transparent outline-none placeholder:text-muted-foreground/40 text-foreground"
        />
      </Field>

      {/* Brief */}
      <Field label="Brief">
        <textarea
          value={brief}
          onChange={(e) => handleFieldChange('brief', e.target.value)}
          className="w-full min-h-[80px] resize-y bg-transparent outline-none text-sm leading-relaxed placeholder:text-muted-foreground/40 text-foreground"
          placeholder="2-4 sentence summary"
        />
      </Field>

      {/* Product Overview */}
      <Field label="Product overview">
        <textarea
          value={productOverview}
          onChange={(e) => handleFieldChange('productOverview', e.target.value)}
          className="w-full min-h-[120px] resize-y bg-transparent outline-none text-sm leading-relaxed placeholder:text-muted-foreground/40 text-foreground"
          placeholder="Detailed product description"
        />
      </Field>

      {/* Modules */}
      <Field label="Modules">
        <div className="flex flex-wrap gap-2">
          {MODULE_CATALOG.map((mod) => {
            const active = modules.includes(mod.id)
            return (
              <Button
                key={mod.id}
                variant={active ? 'default' : 'outline'}
                size="sm"
                className="rounded-full cursor-pointer"
                onClick={() => handleToggleModule(mod.id)}
              >
                {active ? <X className="w-3 h-3 mr-1" /> : <Plus className="w-3 h-3 mr-1" />}
                {mod.name}
              </Button>
            )
          })}
        </div>
      </Field>

      {/* PRD */}
      <Field label="PRD">
        <textarea
          value={prd}
          onChange={(e) => handleFieldChange('prd', e.target.value)}
          className="w-full min-h-[200px] resize-y bg-transparent outline-none font-mono text-xs leading-relaxed placeholder:text-muted-foreground/40 text-foreground"
          placeholder="Product requirements document"
        />
      </Field>

      {/* Technical Architecture */}
      <Field label="Technical architecture">
        <textarea
          value={techArch}
          onChange={(e) => handleFieldChange('technical_architecture', e.target.value)}
          className="w-full min-h-[150px] resize-y bg-transparent outline-none font-mono text-xs leading-relaxed placeholder:text-muted-foreground/40 text-foreground"
          placeholder="Architecture details"
        />
      </Field>

      {/* Timeline */}
      <Field label="Timeline">
        <textarea
          value={timeline}
          onChange={(e) => handleFieldChange('timeline', e.target.value)}
          className="w-full min-h-[100px] resize-y bg-transparent outline-none text-sm leading-relaxed placeholder:text-muted-foreground/40 text-foreground"
          placeholder="Project timeline"
        />
      </Field>

      {/* Admin Notes */}
      <Field label="Admin notes" sublabel="Internal only — not visible to client">
        <textarea
          value={adminNotes}
          onChange={(e) => handleFieldChange('admin_notes', e.target.value)}
          className="w-full min-h-[100px] resize-y bg-amber-50/50 dark:bg-amber-500/5 rounded-lg p-3 outline-none text-sm leading-relaxed placeholder:text-muted-foreground/40 text-foreground"
          placeholder="Internal notes, not visible to client"
        />
      </Field>
    </div>
  )
}

function Field({ label, sublabel, children }: { label: string; sublabel?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <div>
        <p className="text-[11px] uppercase tracking-widest font-medium text-muted-foreground/70">{label}</p>
        {sublabel && <p className="text-[10px] text-muted-foreground/50 mt-0.5">{sublabel}</p>}
      </div>
      {children}
    </div>
  )
}
