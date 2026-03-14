'use client'

import type { ChatMessage } from '@/hooks/useIntakeChat'

type Props = {
  message: ChatMessage
  onSend: (value: string, display?: string) => void
  onRequestViewProposal?: () => void
  isLast: boolean
  isStreaming: boolean
}

export default function PauseCheckpoint({ message, onSend, onRequestViewProposal, isLast, isStreaming }: Props) {
  const options = isLast && !isStreaming ? (message.quickReplies?.options ?? []) : []

  function handleSelect(value: string, label: string) {
    if (value === '__view_proposal__' || value === '__submit__') {
      onRequestViewProposal?.()
    } else {
      // __continue__ and anything custom → send as normal message
      onSend(label, label)
    }
  }

  return (
    <div className="w-full rounded-xl border border-brand-yellow/30 bg-brand-yellow/[0.03] overflow-hidden">
      {/* Header label */}
      <div className="flex items-center gap-2 px-4 pt-3 pb-2 border-b border-brand-yellow/10">
        <div className="w-1.5 h-1.5 rounded-full bg-brand-yellow" />
        <span className="text-[10px] font-semibold tracking-widest uppercase text-brand-yellow/70">
          Proposal Checkpoint
        </span>
      </div>

      {/* AI message text */}
      <div className="px-4 py-3">
        <p className="text-sm text-[var(--ov-text,#ffffff)] leading-relaxed whitespace-pre-line">
          {message.content}
        </p>
        {message.question && (
          <p className="mt-2 text-sm text-[var(--ov-text,#ffffff)] font-medium">
            {message.question}
          </p>
        )}
      </div>

      {/* Action rows — only when last message and not streaming */}
      {options.length > 0 && (
        <div className="px-3 pb-3 space-y-1.5">
          {options.map((opt, i) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => handleSelect(opt.value, opt.label)}
              className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg bg-[var(--ov-surface-subtle,rgba(255,255,255,0.04))] border border-[var(--ov-border,rgba(255,255,255,0.06))] hover:border-brand-yellow/30 hover:bg-brand-yellow/[0.04] transition-all text-left cursor-pointer"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                {opt.icon && <span className="text-base leading-none flex-shrink-0">{opt.icon}</span>}
                <div className="min-w-0">
                  <p className="text-sm font-medium text-[var(--ov-text,#ffffff)] truncate">{opt.label}</p>
                  {opt.description && (
                    <p className="text-xs text-[var(--ov-text-muted,#727272)] truncate">{opt.description}</p>
                  )}
                </div>
              </div>
              <span className="text-xs text-[var(--ov-text-muted,#727272)] flex-shrink-0 ml-3 w-5 h-5 rounded-full bg-white/5 flex items-center justify-center">
                {i + 1}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
