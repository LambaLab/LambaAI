'use client'

import type { ChatMessage } from '@/hooks/useIntakeChat'

type Props = {
  message: ChatMessage
  onSend: (value: string, display?: string) => void
  onRequestViewProposal?: () => void
  isLast: boolean
  isStreaming: boolean
}

// Hard-coded pill definitions — keeps the UI stable regardless of what
// label text the AI returned, and adds "Save for later" as a placeholder.
const CHECKPOINT_PILLS = [
  { value: '__continue__',      label: 'Keep going',      icon: '💬', disabled: false },
  { value: '__view_proposal__', label: 'See proposal',    icon: '📋', disabled: false },
  { value: '__submit__',        label: 'Submit it',       icon: '✅', disabled: false },
  { value: '__save_later__',    label: 'Save for later',  icon: '🔖', disabled: true  },
]

export default function PauseCheckpoint({ message, onSend, onRequestViewProposal, isLast, isStreaming }: Props) {
  const showActions = isLast && !isStreaming

  function handleSelect(value: string, label: string) {
    if (value === '__view_proposal__' || value === '__submit__') {
      onRequestViewProposal?.()
    } else if (value === '__save_later__') {
      // Coming soon — placeholder, do nothing
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

      {/* ── AI message — plain inline text, no bubble ── */}
      <div className="text-sm text-[var(--ov-text,#ffffff)] leading-relaxed space-y-2">
        {paragraphs.map((para, i) => (
          <p key={i}>{para}</p>
        ))}
        {message.question && (
          <p className="text-[var(--ov-text-muted,#b0b0b0)]">{message.question}</p>
        )}
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
                'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm border transition-colors',
                pill.disabled
                  ? 'border-[var(--ov-border,rgba(255,255,255,0.06))] text-[var(--ov-text-muted,#727272)] opacity-40 cursor-not-allowed'
                  : 'border-[var(--ov-border,rgba(255,255,255,0.12))] text-[var(--ov-text,#ffffff)] hover:border-brand-yellow/50 hover:text-brand-yellow cursor-pointer',
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
