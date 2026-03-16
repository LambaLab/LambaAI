'use client'

import { useState } from 'react'
import { getModuleById, validateModuleRemoval } from '@/lib/modules/dependencies'
import * as Icons from 'lucide-react'
import { X, ChevronDown } from 'lucide-react'

type Props = {
  moduleId: string
  isActive: boolean
  activeModules: string[]
  onToggle: (id: string) => void
  summary?: string
}

export default function ModuleCard({ moduleId, isActive, activeModules, onToggle, summary }: Props) {
  const [isExpanded, setIsExpanded] = useState(false)
  const mod = getModuleById(moduleId)
  if (!mod) return null

  const IconComponent = (Icons as unknown as Record<string, React.ComponentType<{ className?: string }>>)[mod.icon] ?? Icons.Box

  function handleHeaderClick() {
    if (isActive) {
      // Active modules: only expand/collapse, never add/remove on header click
      if (summary) setIsExpanded(e => !e)
    }
    // Inactive modules: read-only in the proposal panel — do nothing on click
  }

  return (
    <div
      className={`w-full rounded-xl border transition-all text-left overflow-hidden ${
        isActive
          ? 'bg-brand-yellow/5 border-brand-yellow/30'
          : 'bg-[var(--ov-surface-subtle,rgba(255,255,255,0.02))] border-[var(--ov-border,rgba(255,255,255,0.05))] opacity-50'
      }`}
    >
      {/* Header row */}
      <button
        type="button"
        onClick={handleHeaderClick}
        aria-expanded={isActive && summary ? isExpanded : undefined}
        className={`w-full p-3 text-left ${
          isActive
            ? summary
              ? 'cursor-pointer hover:bg-[var(--ov-hover-bg,rgba(255,255,255,0.03))]'
              : 'cursor-default'
            : 'cursor-default'
        }`}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
              isActive
                ? 'bg-brand-yellow/15'
                : 'bg-[var(--ov-surface-subtle,rgba(255,255,255,0.05))]'
            }`}>
              <IconComponent className={`w-4 h-4 ${isActive ? 'text-brand-yellow' : 'text-brand-gray-mid'}`} />
            </div>
            <p className={`text-sm font-medium truncate ${
              isActive ? 'text-[var(--ov-text,#ffffff)]' : 'text-[var(--ov-text-muted,#727272)]'
            }`}>
              {mod.name}
            </p>
          </div>

          {/* Right icon */}
          {isActive && summary ? (
            <ChevronDown
              className={`w-4 h-4 text-[var(--ov-text-muted,#727272)] flex-shrink-0 transition-transform duration-200 ${
                isExpanded ? 'rotate-180' : ''
              }`}
            />
          ) : null}
        </div>
      </button>

      {/* Expandable body — only for active modules with a summary */}
      <div
        className="grid transition-[grid-template-rows] duration-300 ease-in-out"
        style={{ gridTemplateRows: isExpanded && summary ? '1fr' : '0fr' }}
      >
        <div className="overflow-hidden">
          <div className="px-3 pb-3">
            <div className="h-px bg-brand-yellow/10 mb-3" />
            <p className="text-xs text-[var(--ov-text-muted,#727272)] leading-relaxed">
              {summary}
            </p>
            {(() => {
              const { canRemove, blockedBy } = validateModuleRemoval(moduleId, activeModules)
              return canRemove ? (
                <button
                  type="button"
                  onClick={() => onToggle(moduleId)}
                  className="mt-2 flex items-center gap-1 text-[10px] text-[var(--ov-text-muted,#727272)]/50 hover:text-[var(--ov-text-muted,#727272)] transition-colors cursor-pointer"
                >
                  <X className="w-2.5 h-2.5" />
                  Remove module
                </button>
              ) : (
                <p className="mt-2 text-[10px] text-[var(--ov-text-muted,#727272)]/40">
                  Required by: {blockedBy.map(id => getModuleById(id)?.name ?? id).join(', ')}
                </p>
              )
            })()}
          </div>
        </div>
      </div>
    </div>
  )
}
