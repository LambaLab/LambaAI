'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { Save, Check, Plus, X } from 'lucide-react'
import type { Database } from '@/lib/supabase/types'
import { MODULE_CATALOG } from '@/lib/modules/catalog'

type Proposal = Database['public']['Tables']['proposals']['Row']

type Props = {
  proposal: Proposal
  onUpdate: (updated: Proposal) => void
}

type TaskItem = { name: string; complexity: string; description: string }
type TaskBreakdown = { module: string; tasks: TaskItem[] }[]

const STATUS_OPTIONS: Proposal['status'][] = [
  'draft', 'saved', 'pending_review', 'approved', 'accepted', 'budget_proposed', 'budget_accepted',
]

export default function ProposalEditor({ proposal, onUpdate }: Props) {
  const [saving, setSaving] = useState(false)
  const [lastSaved, setLastSaved] = useState<number | null>(null)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Local form state
  const meta = (proposal.metadata ?? {}) as Record<string, unknown>
  const [projectName, setProjectName] = useState((meta.projectName as string) ?? '')
  const [brief, setBrief] = useState(proposal.brief ?? '')
  const [productOverview, setProductOverview] = useState((meta.productOverview as string) ?? '')
  const [status, setStatus] = useState(proposal.status)
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
    setStatus(proposal.status)
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

  function handleStatusChange(newStatus: Proposal['status']) {
    setStatus(newStatus)
    saveChanges({ status: newStatus })
  }

  function handleToggleModule(moduleId: string) {
    const updated = modules.includes(moduleId)
      ? modules.filter((m) => m !== moduleId)
      : [...modules, moduleId]
    setModules(updated)
    saveChanges({ modules: updated })
  }

  return (
    <div className="p-6 space-y-6">
      {/* Save indicator */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs text-brand-gray-mid">
          {saving && <span className="flex items-center gap-1"><Save className="w-3 h-3 animate-pulse" /> Saving...</span>}
          {!saving && lastSaved && (
            <span className="flex items-center gap-1"><Check className="w-3 h-3 text-brand-green" /> Saved</span>
          )}
        </div>

        {/* Status selector */}
        <select
          value={status}
          onChange={(e) => handleStatusChange(e.target.value as Proposal['status'])}
          className="text-xs bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-brand-white outline-none cursor-pointer"
        >
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s} className="bg-brand-dark">{s.replace(/_/g, ' ')}</option>
          ))}
        </select>
      </div>

      {/* Project Name */}
      <Field label="Project name">
        <input
          value={projectName}
          onChange={(e) => handleFieldChange('projectName', e.target.value)}
          className="field-input"
          placeholder="e.g., FitTrack Pro"
        />
      </Field>

      {/* Brief */}
      <Field label="Brief">
        <textarea
          value={brief}
          onChange={(e) => handleFieldChange('brief', e.target.value)}
          className="field-input min-h-[80px] resize-y"
          placeholder="2-4 sentence summary"
        />
      </Field>

      {/* Product Overview */}
      <Field label="Product overview">
        <textarea
          value={productOverview}
          onChange={(e) => handleFieldChange('productOverview', e.target.value)}
          className="field-input min-h-[120px] resize-y"
          placeholder="Detailed product description"
        />
      </Field>

      {/* Modules */}
      <Field label="Modules">
        <div className="flex flex-wrap gap-2">
          {MODULE_CATALOG.map((mod) => {
            const active = modules.includes(mod.id)
            return (
              <button
                key={mod.id}
                onClick={() => handleToggleModule(mod.id)}
                className={`text-xs px-3 py-1.5 rounded-full transition-colors cursor-pointer ${
                  active
                    ? 'bg-brand-yellow/10 text-brand-yellow border border-brand-yellow/30'
                    : 'bg-white/5 text-brand-gray-mid border border-white/10 hover:border-white/20'
                }`}
              >
                {active ? <X className="w-3 h-3 inline mr-1" /> : <Plus className="w-3 h-3 inline mr-1" />}
                {mod.name}
              </button>
            )
          })}
        </div>
      </Field>

      {/* PRD */}
      <Field label="PRD">
        <textarea
          value={prd}
          onChange={(e) => handleFieldChange('prd', e.target.value)}
          className="field-input min-h-[200px] resize-y font-mono text-xs"
          placeholder="Product requirements document"
        />
      </Field>

      {/* Technical Architecture */}
      <Field label="Technical architecture">
        <textarea
          value={techArch}
          onChange={(e) => handleFieldChange('technical_architecture', e.target.value)}
          className="field-input min-h-[150px] resize-y font-mono text-xs"
          placeholder="Architecture details"
        />
      </Field>

      {/* Timeline */}
      <Field label="Timeline">
        <textarea
          value={timeline}
          onChange={(e) => handleFieldChange('timeline', e.target.value)}
          className="field-input min-h-[100px] resize-y"
          placeholder="Project timeline"
        />
      </Field>

      {/* Admin Notes */}
      <Field label="Admin notes (internal only)">
        <textarea
          value={adminNotes}
          onChange={(e) => handleFieldChange('admin_notes', e.target.value)}
          className="field-input min-h-[100px] resize-y border-brand-yellow/20"
          placeholder="Internal notes, not visible to client"
        />
      </Field>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-[11px] text-brand-gray-mid uppercase tracking-wider">{label}</label>
      {children}

      <style jsx global>{`
        .field-input {
          width: 100%;
          padding: 10px 14px;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 10px;
          font-size: 14px;
          color: #ffffff;
          outline: none;
          transition: border-color 0.15s;
          line-height: 1.6;
        }
        .field-input:focus {
          border-color: rgba(255, 252, 0, 0.3);
        }
        .field-input::placeholder {
          color: rgba(114, 114, 114, 0.5);
        }
      `}</style>
    </div>
  )
}
