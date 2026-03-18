'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { Save, Check, Plus, X, ChevronRight } from 'lucide-react'
import * as Icons from 'lucide-react'
import type { Database } from '@/lib/supabase/types'
import { MODULE_CATALOG } from '@/lib/modules/catalog'

type Proposal = Database['public']['Tables']['proposals']['Row']

type Props = {
  proposal: Proposal
  onUpdate: (updated: Proposal) => void
}

type SectionKey = 'brief' | 'overview' | 'modules' | 'prd' | 'techArch' | 'timeline' | 'adminNotes'

const SECTIONS: { key: SectionKey; label: string; sublabel?: string }[] = [
  { key: 'brief', label: 'Brief' },
  { key: 'overview', label: 'Overview' },
  { key: 'modules', label: 'Modules' },
  { key: 'prd', label: 'PRD' },
  { key: 'techArch', label: 'Architecture' },
  { key: 'timeline', label: 'Timeline' },
  { key: 'adminNotes', label: 'Admin Notes', sublabel: 'Internal only' },
]

export default function ProposalEditor({ proposal, onUpdate }: Props) {
  const [saving, setSaving] = useState(false)
  const [showSaved, setShowSaved] = useState(false)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const savedDismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

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
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set())
  const moduleSummaries = (meta.moduleSummaries ?? {}) as Record<string, string>

  // Desktop: vertical tab selection
  const [activeSection, setActiveSection] = useState<SectionKey>('brief')

  // Mobile: collapsible sections — default all open
  const [openSections, setOpenSections] = useState<Set<SectionKey>>(
    new Set(['brief', 'overview', 'modules', 'prd', 'techArch', 'timeline', 'adminNotes'])
  )

  const toggleSection = (key: SectionKey) => {
    setOpenSections(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

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
      setShowSaved(true)
      if (savedDismissTimer.current) clearTimeout(savedDismissTimer.current)
      savedDismissTimer.current = setTimeout(() => setShowSaved(false), 2000)
    }
    setSaving(false)
  }, [proposal.id, onUpdate])

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

  function toggleModuleExpand(moduleId: string) {
    setExpandedModules(prev => {
      const next = new Set(prev)
      if (next.has(moduleId)) next.delete(moduleId)
      else next.add(moduleId)
      return next
    })
  }

  // Section content renderer
  function renderSectionContent(key: SectionKey) {
    switch (key) {
      case 'brief':
        return (
          <textarea
            value={brief}
            onChange={(e) => handleFieldChange('brief', e.target.value)}
            className="w-full min-h-[120px] resize-y bg-transparent outline-none text-sm leading-relaxed placeholder:text-muted-foreground/40 text-foreground"
            placeholder="2-4 sentence summary"
          />
        )
      case 'overview':
        return (
          <textarea
            value={productOverview}
            onChange={(e) => handleFieldChange('productOverview', e.target.value)}
            className="w-full min-h-[160px] resize-y bg-transparent outline-none text-sm leading-relaxed placeholder:text-muted-foreground/40 text-foreground"
            placeholder="Detailed product description"
          />
        )
      case 'modules':
        return <ModulesContent modules={modules} moduleSummaries={moduleSummaries} expandedModules={expandedModules} onToggleModule={handleToggleModule} onToggleExpand={toggleModuleExpand} />
      case 'prd':
        return (
          <textarea
            value={prd}
            onChange={(e) => handleFieldChange('prd', e.target.value)}
            className="w-full min-h-[250px] resize-y bg-transparent outline-none font-mono text-xs leading-relaxed placeholder:text-muted-foreground/40 text-foreground"
            placeholder="Product requirements document"
          />
        )
      case 'techArch':
        return (
          <textarea
            value={techArch}
            onChange={(e) => handleFieldChange('technical_architecture', e.target.value)}
            className="w-full min-h-[200px] resize-y bg-transparent outline-none font-mono text-xs leading-relaxed placeholder:text-muted-foreground/40 text-foreground"
            placeholder="Architecture details"
          />
        )
      case 'timeline':
        return (
          <textarea
            value={timeline}
            onChange={(e) => handleFieldChange('timeline', e.target.value)}
            className="w-full min-h-[120px] resize-y bg-transparent outline-none text-sm leading-relaxed placeholder:text-muted-foreground/40 text-foreground"
            placeholder="Project timeline"
          />
        )
      case 'adminNotes':
        return (
          <textarea
            value={adminNotes}
            onChange={(e) => handleFieldChange('admin_notes', e.target.value)}
            className="w-full min-h-[120px] resize-y bg-amber-50/50 dark:bg-amber-500/5 rounded-lg p-3 outline-none text-sm leading-relaxed placeholder:text-muted-foreground/40 text-foreground"
            placeholder="Internal notes, not visible to client"
          />
        )
    }
  }

  // Get preview text for a section
  function getPreview(key: SectionKey): string | undefined {
    switch (key) {
      case 'brief': return brief ? truncate(brief, 60) : undefined
      case 'overview': return productOverview ? truncate(productOverview, 60) : undefined
      case 'modules': return modules.length > 0 ? modules.map(id => MODULE_CATALOG.find(m => m.id === id)?.name ?? id).join(', ') : undefined
      case 'prd': return prd ? truncate(prd, 60) : undefined
      case 'techArch': return techArch ? truncate(techArch, 60) : undefined
      case 'timeline': return timeline ? truncate(timeline, 60) : undefined
      case 'adminNotes': return adminNotes ? truncate(adminNotes, 60) : undefined
    }
  }

  const activeSectionDef = SECTIONS.find(s => s.key === activeSection)!

  return (
    <div>
      {/* Project Name — always visible */}
      <div className="px-6 md:px-8 py-3 border-b border-border/40">
        <div className="flex items-center gap-2">
          <input
            value={projectName}
            onChange={(e) => handleFieldChange('projectName', e.target.value)}
            placeholder="e.g., FitTrack Pro"
            className="w-full text-lg font-medium bg-transparent outline-none placeholder:text-muted-foreground/40 text-foreground flex-1"
          />
          <div className="shrink-0 text-xs h-5 flex items-center">
            {saving && (
              <span className="flex items-center gap-1 text-muted-foreground animate-pulse">
                <Save className="w-3 h-3" /> Saving
              </span>
            )}
            {!saving && showSaved && (
              <span className="flex items-center gap-1 text-emerald-500 animate-in fade-in duration-200">
                <Check className="w-3 h-3" /> Saved
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ─── Desktop: Vertical tabs layout ─── */}
      <div className="hidden md:flex min-h-[400px]">
        {/* Tab list — left side */}
        <div className="w-44 shrink-0 border-r border-border/40 py-1">
          {SECTIONS.map((section) => {
            const isActive = activeSection === section.key
            const preview = getPreview(section.key)
            return (
              <button
                key={section.key}
                type="button"
                onClick={() => setActiveSection(section.key)}
                className={`w-full text-left px-4 py-2.5 text-sm transition-colors cursor-pointer relative ${
                  isActive
                    ? 'text-foreground font-medium bg-muted/40'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/20'
                }`}
              >
                {/* Active indicator */}
                {isActive && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-yellow-500 dark:bg-yellow-400 rounded-r" />
                )}
                <span className="block">{section.label}</span>
                {!isActive && preview && (
                  <span className="block text-[10px] text-muted-foreground/40 truncate mt-0.5">{preview}</span>
                )}
                {section.sublabel && (
                  <span className="block text-[10px] text-amber-500/70 mt-0.5">{section.sublabel}</span>
                )}
              </button>
            )
          })}
        </div>

        {/* Content — right side */}
        <div className="flex-1 min-w-0 overflow-y-auto">
          <div className="px-6 py-4">
            <p className="text-[11px] uppercase tracking-widest font-medium text-muted-foreground/70 mb-3">
              {activeSectionDef.label}
              {activeSectionDef.sublabel && (
                <span className="normal-case tracking-normal text-muted-foreground/50 ml-2">— {activeSectionDef.sublabel}</span>
              )}
            </p>
            {renderSectionContent(activeSection)}
          </div>
        </div>
      </div>

      {/* ─── Mobile: Collapsible sections (unchanged) ─── */}
      <div className="md:hidden px-6 py-4 space-y-0">
        {SECTIONS.map((section) => (
          <CollapsibleSection
            key={section.key}
            label={section.key === 'modules' ? `Modules (${modules.length})` : section.label}
            sublabel={section.sublabel}
            isOpen={openSections.has(section.key)}
            onToggle={() => toggleSection(section.key)}
            preview={getPreview(section.key)}
            variant={section.key === 'adminNotes' ? 'warning' : undefined}
          >
            {renderSectionContent(section.key)}
          </CollapsibleSection>
        ))}
      </div>
    </div>
  )
}

// ─── Modules content ───
function ModulesContent({
  modules,
  moduleSummaries,
  expandedModules,
  onToggleModule,
  onToggleExpand,
}: {
  modules: string[]
  moduleSummaries: Record<string, string>
  expandedModules: Set<string>
  onToggleModule: (id: string) => void
  onToggleExpand: (id: string) => void
}) {
  return (
    <div className="space-y-2">
      {/* Selected modules */}
      {modules.map((moduleId) => {
        const mod = MODULE_CATALOG.find((m) => m.id === moduleId)
        if (!mod) return null
        const IconComponent = (Icons as unknown as Record<string, React.ComponentType<{ className?: string }>>)[mod.icon] ?? Icons.Box
        const summary = moduleSummaries[moduleId]
        const isOpen = expandedModules.has(moduleId)

        return (
          <div
            key={moduleId}
            className={`rounded-xl border overflow-hidden transition-all ${
              isOpen
                ? 'border-yellow-200 dark:border-yellow-500/20 bg-yellow-50/30 dark:bg-yellow-500/5'
                : 'border-border/60 bg-muted/20 dark:bg-muted/10'
            }`}
          >
            {/* Entire header row is clickable to expand */}
            <div
              className={`flex items-center gap-2.5 p-3 group ${summary ? 'cursor-pointer' : ''}`}
              onClick={() => { if (summary) onToggleExpand(moduleId) }}
            >
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                isOpen
                  ? 'bg-yellow-100 dark:bg-yellow-500/15'
                  : 'bg-muted/60 dark:bg-muted/30'
              }`}>
                <IconComponent className={`w-4 h-4 transition-colors ${
                  isOpen
                    ? 'text-yellow-600 dark:text-yellow-400'
                    : 'text-muted-foreground'
                }`} />
              </div>
              <span className="text-sm font-medium text-foreground flex-1 truncate">{mod.name}</span>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onToggleModule(moduleId) }}
                className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-muted-foreground hover:text-destructive cursor-pointer"
                title="Remove module"
              >
                <X className="w-3.5 h-3.5" />
              </button>
              {summary && (
                <ChevronRight className={`w-4 h-4 text-muted-foreground transition-transform duration-200 ${isOpen ? 'rotate-90' : ''}`} />
              )}
            </div>
            {/* Expandable summary */}
            {summary && (
              <div
                className="grid transition-[grid-template-rows] duration-300 ease-in-out"
                style={{ gridTemplateRows: isOpen ? '1fr' : '0fr' }}
              >
                <div className="overflow-hidden">
                  <div className="px-3 pb-3">
                    <div className="h-px bg-yellow-200/50 dark:bg-yellow-500/10 mb-2" />
                    <p className="text-xs text-muted-foreground leading-relaxed">{summary}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )
      })}

      {/* Available modules to add */}
      {MODULE_CATALOG.filter((m) => !modules.includes(m.id)).length > 0 && (
        <div className="pt-2">
          <p className="text-[10px] uppercase tracking-widest font-medium text-muted-foreground/50 mb-2">Add modules</p>
          <div className="space-y-1.5">
            {MODULE_CATALOG.filter((m) => !modules.includes(m.id)).map((mod) => {
              const IconComponent = (Icons as unknown as Record<string, React.ComponentType<{ className?: string }>>)[mod.icon] ?? Icons.Box
              return (
                <button
                  key={mod.id}
                  type="button"
                  onClick={() => onToggleModule(mod.id)}
                  className="w-full flex items-center gap-2.5 p-2.5 rounded-xl border border-dashed border-muted-foreground/15 opacity-50 hover:opacity-100 hover:border-foreground/20 hover:bg-muted/30 transition-all cursor-pointer text-left"
                >
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 bg-muted/50">
                    <IconComponent className="w-3.5 h-3.5 text-muted-foreground" />
                  </div>
                  <span className="text-sm text-muted-foreground">{mod.name}</span>
                  <Plus className="w-3.5 h-3.5 text-muted-foreground/50 ml-auto" />
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text
  return text.slice(0, max).trim() + '…'
}

function CollapsibleSection({
  label,
  sublabel,
  isOpen,
  onToggle,
  preview,
  variant,
  children,
}: {
  label: string
  sublabel?: string
  isOpen: boolean
  onToggle: () => void
  preview?: string
  variant?: 'warning'
  children: React.ReactNode
}) {
  return (
    <div className={`border-b border-border/40 ${variant === 'warning' ? '' : ''}`}>
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center gap-2 py-3 text-left cursor-pointer group"
      >
        <ChevronRight
          className={`w-3.5 h-3.5 text-muted-foreground/50 shrink-0 transition-transform duration-200 ${
            isOpen ? 'rotate-90' : ''
          }`}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-[11px] uppercase tracking-widest font-medium text-muted-foreground/70">{label}</p>
            {sublabel && <p className="text-[10px] text-muted-foreground/50">{sublabel}</p>}
          </div>
          {!isOpen && preview && (
            <p className="text-xs text-muted-foreground/50 truncate mt-0.5">{preview}</p>
          )}
        </div>
      </button>
      <div
        className="grid transition-[grid-template-rows] duration-200 ease-in-out"
        style={{ gridTemplateRows: isOpen ? '1fr' : '0fr' }}
      >
        <div className="overflow-hidden">
          <div className="pb-4">
            {children}
          </div>
        </div>
      </div>
    </div>
  )
}
