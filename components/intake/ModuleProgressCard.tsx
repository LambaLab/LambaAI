'use client'

import * as Icons from 'lucide-react'
import { Check, ArrowRight, Circle } from 'lucide-react'
import { MODULE_CATALOG } from '@/lib/modules/catalog'
import type { ChatMessage } from '@/hooks/useIntakeChat'

type Props = {
  message: ChatMessage
  onSend: (value: string, display?: string) => void
  onRequestViewProposal?: () => void
  isLast: boolean
  isStreaming: boolean
}

function getModule(id: string) {
  return MODULE_CATALOG.find(m => m.id === id)
}

function getIcon(iconName: string): React.ComponentType<{ className?: string }> {
  return (Icons as unknown as Record<string, React.ComponentType<{ className?: string }>>)[iconName] ?? Icons.Box
}

type ModuleStatus = 'done' | 'current' | 'upcoming'

function getStatus(
  moduleId: string,
  completed: string[],
  current: string,
): ModuleStatus {
  if (completed.includes(moduleId)) return 'done'
  if (moduleId === current) return 'current'
  return 'upcoming'
}

export default function ModuleProgressCard({
  message,
  onSend,
  onRequestViewProposal,
  isLast,
  isStreaming,
}: Props) {
  const isOverview = message.isOverview ?? false
  const completed = message.checklistCompleted ?? []
  const current = isOverview ? '' : (message.checklistCurrent ?? message.moduleId ?? '')
  const queue = message.checklistQueue ?? []
  const isAllComplete = message.isModuleComplete && queue.length === 0

  // Fallback: if no checklist data but we have a moduleId, show at least that module
  const hasChecklistData = (completed.length + queue.length) > 0 || message.checklistCurrent

  // Build ordered list: completed first, then current, then queue
  // For overview cards, all modules are in the queue
  const allModules = hasChecklistData
    ? [...completed, ...(current && !completed.includes(current) ? [current] : []), ...queue.filter(id => id !== current && !completed.includes(id))]
    : current ? [current] : []

  // Deduplicate while preserving order
  const seen = new Set<string>()
  const orderedModules = allModules.filter(id => {
    if (seen.has(id)) return false
    seen.add(id)
    return true
  })

  const showActions = isLast && !isStreaming && message.isModuleComplete

  // Header text
  const headerText = isOverview
    ? 'What We\'ll Cover'
    : isAllComplete
      ? 'All Modules Complete'
      : message.isModuleComplete
        ? 'Module Complete'
        : 'Module Deep-Dives'

  return (
    <div className="w-full py-2">
      <div className="rounded-xl border border-[var(--ov-border,rgba(255,255,255,0.10))] bg-[var(--ov-surface-subtle,rgba(255,255,255,0.03))] overflow-hidden">
        {/* Header */}
        <div className="px-4 pt-3 pb-2">
          <span className="text-[10px] font-semibold tracking-[0.18em] uppercase text-[var(--ov-text-muted,#727272)]">
            {headerText}
          </span>
        </div>

        {/* Module list */}
        <div className="px-4 pb-3 space-y-0.5">
          {orderedModules.map((moduleId) => {
            const mod = getModule(moduleId)
            if (!mod) return null
            const status = getStatus(moduleId, completed, current)
            const IconComponent = getIcon(mod.icon)

            return (
              <div
                key={moduleId}
                className={[
                  'flex items-center gap-3 px-3 py-2 rounded-lg transition-colors',
                  isOverview
                    ? ''
                    : status === 'current'
                      ? 'bg-[var(--ov-accent-bg,rgba(255,252,0,0.06))] border-l-2 border-[var(--ov-accent-strong,#fffc00)]'
                      : status === 'done'
                        ? 'opacity-60'
                        : 'opacity-40',
                ].join(' ')}
              >
                {/* Status indicator */}
                <div className="flex-shrink-0 w-5 h-5 flex items-center justify-center">
                  {isOverview ? (
                    <Circle className="w-3.5 h-3.5 text-[var(--ov-text-muted,#727272)]" />
                  ) : status === 'done' ? (
                    <Check className="w-4 h-4 text-green-400" />
                  ) : status === 'current' ? (
                    <ArrowRight className="w-4 h-4 text-[var(--ov-accent-strong,#fffc00)]" />
                  ) : (
                    <Circle className="w-3.5 h-3.5 text-[var(--ov-text-muted,#727272)]" />
                  )}
                </div>

                {/* Module icon */}
                <div className={[
                  'w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0',
                  isOverview
                    ? 'bg-[var(--ov-surface-subtle,rgba(255,255,255,0.08))]'
                    : status === 'current'
                      ? 'bg-[var(--ov-accent-bg,rgba(255,252,0,0.15))]'
                      : 'bg-[var(--ov-surface-subtle,rgba(255,255,255,0.05))]',
                ].join(' ')}>
                  <IconComponent className={[
                    'w-3.5 h-3.5',
                    isOverview
                      ? 'text-[var(--ov-text,#ffffff)]/70'
                      : status === 'current'
                        ? 'text-[var(--ov-accent-strong,#fffc00)]'
                        : status === 'done'
                          ? 'text-green-400'
                          : 'text-[var(--ov-text-muted,#727272)]',
                  ].join(' ')} />
                </div>

                {/* Module name */}
                <span className={[
                  'text-sm',
                  isOverview
                    ? 'text-[var(--ov-text,#ffffff)]/80'
                    : status === 'current'
                      ? 'text-[var(--ov-text,#ffffff)] font-medium'
                      : status === 'done'
                        ? 'text-[var(--ov-text-muted,#727272)] line-through decoration-[var(--ov-text-muted,#727272)]/30'
                        : 'text-[var(--ov-text-muted,#727272)]',
                ].join(' ')}>
                  {mod.name}
                </span>
              </div>
            )
          })}
        </div>

        {/* Summary text (on module-complete) */}
        {message.isModuleComplete && message.moduleSummary && (
          <div className="px-4 pb-3">
            <div className="h-px bg-[var(--ov-border,rgba(255,255,255,0.07))] mb-3" />
            <p className="text-sm text-[var(--ov-text,#ffffff)]/80 leading-relaxed">
              {message.moduleSummary}
            </p>
          </div>
        )}

        {/* Action pills (on module-complete, last message) */}
        {showActions && (
          <div className="px-4 pb-3">
            {!message.moduleSummary && (
              <div className="h-px bg-[var(--ov-border,rgba(255,255,255,0.07))] mb-3" />
            )}
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => onSend('__continue__', 'Keep going')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm transition-colors cursor-pointer bg-brand-yellow border border-brand-yellow text-brand-dark hover:bg-brand-yellow/90 font-medium"
              >
                <span className="leading-none text-base">💬</span>
                Keep going
              </button>
              <button
                type="button"
                onClick={() => onRequestViewProposal?.()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm transition-colors cursor-pointer border border-[var(--ov-border,rgba(255,255,255,0.12))] text-[var(--ov-text,#ffffff)] hover:border-[var(--ov-accent-border,rgba(255,252,0,0.50))] hover:text-[var(--ov-accent-strong,#fffc00)]"
              >
                <span className="leading-none text-base">📋</span>
                View proposal
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
