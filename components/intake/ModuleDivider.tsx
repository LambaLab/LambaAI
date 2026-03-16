'use client'

import type { ChatMessage } from '@/hooks/useIntakeChat'
import { MODULE_CATALOG } from '@/lib/modules/catalog'

type Props = {
  message: ChatMessage
  onSend: (value: string, display?: string) => void
  onRequestViewProposal?: () => void
  isLast: boolean
  isStreaming: boolean
}

type Pill = {
  value: string
  label: string
  icon: string
  primary: boolean
}

const COMPLETE_PILLS: Pill[] = [
  { value: '__continue__', label: 'Keep going', icon: '💬', primary: true },
  { value: '__view_proposal__', label: 'View proposal', icon: '📋', primary: false },
]

// Lookup a module's display name from the catalog; fall back to formatted ID
function getModuleName(moduleId: string): string {
  const mod = MODULE_CATALOG.find(m => m.id === moduleId)
  if (mod) return mod.name
  return moduleId.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

// Lookup a module's emoji from the catalog icon field; fall back to a generic icon
const ICON_MAP: Record<string, string> = {
  Shield: '🔐',
  Database: '🗄️',
  Monitor: '🖥️',
  Smartphone: '📱',
  CreditCard: '💳',
  MessageSquare: '💬',
  LayoutDashboard: '📊',
  Sparkles: '✨',
  Upload: '📁',
  Bell: '🔔',
  Search: '🔍',
  BarChart3: '📈',
}

function getModuleEmoji(moduleId: string): string {
  const mod = MODULE_CATALOG.find(m => m.id === moduleId)
  if (mod && ICON_MAP[mod.icon]) return ICON_MAP[mod.icon]
  return '📦'
}

export default function ModuleDivider({ message, onSend, onRequestViewProposal, isLast, isStreaming }: Props) {
  const showActions = isLast && !isStreaming && message.isModuleComplete
  const moduleName = message.moduleId ? getModuleName(message.moduleId) : 'Module'
  const emoji = message.moduleId ? getModuleEmoji(message.moduleId) : '📦'

  function handleSelect(value: string) {
    if (value === '__view_proposal__' || value === '__submit__') {
      onRequestViewProposal?.()
    } else {
      onSend(value, 'Keep going')
    }
  }

  if (message.isModuleStart) {
    // ── Module Start Divider ──
    const position = message.modulePosition ?? 1
    const total = message.modulesTotal ?? 0
    const posText = total > 0 ? ` (${position} of ${total})` : ''

    return (
      <div className="w-full py-3">
        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-[var(--ov-border,rgba(255,255,255,0.07))]" />
          <span className="text-[10px] tracking-[0.18em] uppercase text-[var(--ov-text-muted,#727272)] select-none whitespace-nowrap flex items-center gap-1.5">
            <span className="text-sm">{emoji}</span>
            {moduleName}{posText}
          </span>
          <div className="flex-1 h-px bg-[var(--ov-border,rgba(255,255,255,0.07))]" />
        </div>
      </div>
    )
  }

  if (message.isModuleComplete) {
    // ── Module Complete Divider ──
    return (
      <div className="w-full space-y-4 py-1">
        {/* Horizontal divider with centred label */}
        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-[var(--ov-border,rgba(255,255,255,0.07))]" />
          <span className="text-[10px] tracking-[0.18em] uppercase text-[var(--ov-text-muted,#727272)] select-none whitespace-nowrap flex items-center gap-1.5">
            <span className="text-sm">✓</span>
            {moduleName} complete
          </span>
          <div className="flex-1 h-px bg-[var(--ov-border,rgba(255,255,255,0.07))]" />
        </div>

        {/* Summary text */}
        {message.moduleSummary && (
          <p className="text-sm text-[var(--ov-text,#ffffff)] leading-relaxed">
            {message.moduleSummary}
          </p>
        )}

        {/* Action pills — same pattern as PauseCheckpoint */}
        {showActions && (
          <div className="flex flex-wrap gap-2">
            {COMPLETE_PILLS.map((pill) => (
              <button
                key={pill.value}
                type="button"
                onClick={() => handleSelect(pill.value)}
                className={[
                  'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm transition-colors cursor-pointer',
                  pill.primary
                    ? 'bg-brand-yellow border border-brand-yellow text-brand-dark hover:bg-brand-yellow/90 font-medium'
                    : 'border border-[var(--ov-border,rgba(255,255,255,0.12))] text-[var(--ov-text,#ffffff)] hover:border-[var(--ov-accent-border,rgba(255,252,0,0.50))] hover:text-[var(--ov-accent-strong,#fffc00)]',
                ].join(' ')}
              >
                <span className="leading-none text-base">{pill.icon}</span>
                {pill.label}
              </button>
            ))}
          </div>
        )}
      </div>
    )
  }

  return null
}
