'use client'

import type { ChatMessage } from '@/hooks/useIntakeChat'

type Props = {
  message: ChatMessage
  onSend: (value: string, display?: string) => void
  onRequestViewProposal?: () => void
  onSaveLater?: () => void
  isLast: boolean
  isStreaming: boolean
}

// Hard-coded pill definitions — keeps the UI stable regardless of what
// label text the AI returned, and adds "Save for later" as a placeholder.
const CHECKPOINT_PILLS = [
  { value: '__continue__',      label: 'Keep going',         icon: '💬', disabled: false, primary: false },
  { value: '__view_proposal__', label: 'See proposal',       icon: '📋', disabled: false, primary: false },
  { value: '__submit__',        label: 'Submit proposal',    icon: '✅', disabled: false, primary: true  },
  { value: '__save_later__',    label: 'Save for later',     icon: '🔖', disabled: false, primary: false },
]

export default function PauseCheckpoint({ message, onSend, onRequestViewProposal, onSaveLater, isLast, isStreaming }: Props) {
  const showActions = isLast && !isStreaming

  function handleSelect(value: string, label: string) {
    if (value === '__view_proposal__' || value === '__submit__') {
      onRequestViewProposal?.()
    } else if (value === '__save_later__') {
      onSaveLater?.()
    } else {
      // __continue__ → keep the conversation going
      onSend(value, label)
    }
  }

  const paragraphs = message.content ? message.content.split('\n\n').filter(Boolean) : []

  return (
    <div className="w-full space-y-4 py-1">

      {/* ── Horizontal divider with centred label ── */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-px bg-[var(--ov-border,rgba(255,255,255,0.07))]" />
        <span className="text-[10px] tracking-[0.18em] uppercase text-[var(--ov-text-muted,#727272)] select-none whitespace-nowrap">
          take a breath
        </span>
        <div className="flex-1 h-px bg-[var(--ov-border,rgba(255,255,255,0.07))]" />
      </div>

      {/* ── Checkpoint intro — warm summary of what's been established ── */}
      <div className="text-sm text-[var(--ov-text,#ffffff)] leading-relaxed space-y-2">
        {paragraphs.map((para, i) => (
          <p key={i}>{para}</p>
        ))}
      </div>

      {/* ── Compact inline pill buttons ── */}
      {showActions && (
        <div className="flex flex-wrap gap-2">
          {CHECKPOINT_PILLS.map((pill) => (
            <button
              key={pill.value}
              type="button"
              onClick={() => !pill.disabled && handleSelect(pill.value, pill.label)}
              disabled={pill.disabled}
              className={[
                'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm transition-colors',
                pill.primary
                  ? 'bg-brand-yellow border border-brand-yellow text-brand-dark hover:bg-brand-yellow/90 cursor-pointer font-medium'
                  : pill.disabled
                    ? 'border border-[var(--ov-border,rgba(255,255,255,0.06))] text-[var(--ov-text-muted,#727272)] opacity-40 cursor-not-allowed'
                    : 'border border-[var(--ov-border,rgba(255,255,255,0.12))] text-[var(--ov-text,#ffffff)] hover:border-[var(--ov-accent-border,rgba(255,252,0,0.50))] hover:text-[var(--ov-accent-strong,#fffc00)] cursor-pointer',
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
