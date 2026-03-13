'use client'

import { getModuleById, validateModuleRemoval } from '@/lib/modules/dependencies'
import * as Icons from 'lucide-react'
import { X, Plus } from 'lucide-react'

type Props = {
  moduleId: string
  isActive: boolean
  activeModules: string[]
  pricingVisible: boolean
  onToggle: (id: string) => void
}

export default function ModuleCard({ moduleId, isActive, activeModules, pricingVisible, onToggle }: Props) {
  const mod = getModuleById(moduleId)
  if (!mod) return null

  const { canRemove, blockedBy } = validateModuleRemoval(moduleId, activeModules)
  const canToggle = isActive ? canRemove : true

  const IconComponent = (Icons as unknown as Record<string, React.ComponentType<{ className?: string }>>)[mod.icon] ?? Icons.Box

  return (
    <button
      type="button"
      onClick={() => canToggle && onToggle(moduleId)}
      disabled={!canToggle}
      title={!canToggle ? `Required by: ${blockedBy.join(', ')}` : undefined}
      className={`w-full p-3 rounded-xl border transition-all text-left ${
        isActive
          ? 'bg-brand-yellow/5 border-brand-yellow/30'
          : 'bg-[var(--ov-surface-subtle,rgba(255,255,255,0.02))] border-[var(--ov-border,rgba(255,255,255,0.05))] opacity-50'
      } ${canToggle ? 'hover:border-brand-yellow/50' : 'cursor-not-allowed'}`}
    >
      <div className="flex items-start justify-between gap-2">
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
        <span className={`flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center ${isActive ? 'bg-brand-yellow/20 text-brand-yellow' : 'bg-[var(--ov-surface-subtle,rgba(255,255,255,0.05))] text-[var(--ov-text-muted,#727272)]'}`}>
          {isActive ? <X className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
        </span>
      </div>
    </button>
  )
}
