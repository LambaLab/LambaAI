'use client'

import { getModuleById, validateModuleRemoval } from '@/lib/modules/dependencies'
import * as Icons from 'lucide-react'
import { Plus, X } from 'lucide-react'

type Props = {
  moduleId: string
  isActive: boolean
  activeModules: string[]
  pricingVisible: boolean
  onToggle: (id: string) => void
  summary?: string
}

export default function ModuleCard({ moduleId, isActive, activeModules, pricingVisible, onToggle, summary }: Props) {
  const mod = getModuleById(moduleId)
  if (!mod) return null

  const { canRemove, blockedBy } = validateModuleRemoval(moduleId, activeModules)
  const canToggle = isActive ? canRemove : true

  const IconComponent = (Icons as unknown as Record<string, React.ComponentType<{ className?: string }>>)[mod.icon] ?? Icons.Box

  return (
    <div
      className={`w-full rounded-xl border transition-all text-left overflow-hidden ${
        isActive
          ? 'bg-brand-yellow/5 border-brand-yellow/30'
          : 'bg-[var(--ov-surface-subtle,rgba(255,255,255,0.02))] border-[var(--ov-border,rgba(255,255,255,0.05))] opacity-50'
      }`}
    >
      {/* Header row — always visible, clicking toggles the module */}
      <button
        type="button"
        onClick={() => canToggle && onToggle(moduleId)}
        disabled={!canToggle && isActive}
        title={!canToggle ? `Required by: ${blockedBy.join(', ')}` : undefined}
        className={`w-full p-3 text-left ${canToggle ? 'hover:bg-white/[0.03] cursor-pointer' : 'cursor-not-allowed'}`}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${isActive ? 'bg-brand-yellow/15' : 'bg-[var(--ov-surface-subtle,rgba(255,255,255,0.05))]'}`}>
              <IconComponent className={`w-4 h-4 ${isActive ? 'text-brand-yellow' : 'text-brand-gray-mid'}`} />
            </div>
            <div className="min-w-0">
              <p className={`text-sm font-medium truncate ${isActive ? 'text-[var(--ov-text,#ffffff)]' : 'text-[var(--ov-text-muted,#727272)]'}`}>
                {mod.name}
              </p>
              {pricingVisible ? (
                <p className="text-xs text-[var(--ov-text-muted,#727272)] truncate">
                  ${mod.priceMin.toLocaleString()}–${mod.priceMax.toLocaleString()}
                </p>
              ) : (
                <p className="text-xs text-[var(--ov-text-muted,#727272)]/40 blur-[3px] select-none" aria-hidden="true">
                  $●,●●●–$●,●●●
                </p>
              )}
            </div>
          </div>

          {/* Inactive modules show + badge; active modules show nothing in the header */}
          {!isActive && (
            <span className="flex-shrink-0 w-5 h-5 rounded-full bg-[var(--ov-surface-subtle,rgba(255,255,255,0.05))] text-[var(--ov-text-muted,#727272)] flex items-center justify-center">
              <Plus className="w-3 h-3" />
            </span>
          )}
        </div>
      </button>

      {/* Expandable body — smooth accordion using grid-template-rows */}
      <div
        className="grid transition-[grid-template-rows] duration-300 ease-in-out"
        style={{ gridTemplateRows: isActive && summary ? '1fr' : '0fr' }}
      >
        <div className="overflow-hidden">
          <div className="px-3 pb-3">
            <div className="h-px bg-brand-yellow/10 mb-3" />
            <p className="text-xs text-[var(--ov-text-muted,#727272)] leading-relaxed">
              {summary}
            </p>
            {canRemove ? (
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
                Required by: {blockedBy.join(', ')}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
