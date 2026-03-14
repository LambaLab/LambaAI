'use client'

import { useState } from 'react'
import type { QuickReplies as QuickRepliesType, QuickReplyOption } from '@/lib/intake-types'

type Props = {
  quickReplies: QuickRepliesType
  onSelect: (value: string) => void
  disabled?: boolean
}

export default function QuickReplies({ quickReplies, onSelect, disabled }: Props) {
  const { style, multiSelect, allowCustom, options } = quickReplies
  const [selected, setSelected] = useState<string[]>([])
  const [showCustomInput, setShowCustomInput] = useState(false)
  const [customValue, setCustomValue] = useState('')

  function toggleSelected(value: string) {
    setSelected((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]
    )
  }

  function handleSingleSelect(value: string) {
    if (disabled) return
    onSelect(value)
  }

  function handleMultiConfirm() {
    if (disabled || selected.length === 0) return
    const allValues = showCustomInput && customValue.trim()
      ? [...selected, customValue.trim()]
      : selected
    onSelect(allValues.join(', '))
  }

  function handleCustomSubmit() {
    if (disabled || !customValue.trim()) return
    if (multiSelect) {
      setSelected((prev) => [...prev, customValue.trim()])
      setShowCustomInput(false)
      setCustomValue('')
    } else {
      onSelect(customValue.trim())
    }
  }

  const allOptions: (QuickReplyOption | 'custom')[] = allowCustom
    ? [...options, 'custom']
    : options

  if (style === 'pills') {
    return (
      <div className="mt-3 flex flex-wrap gap-2">
        {options.map((opt) => {
          const isChecked = selected.includes(opt.value)
          return (
            <button
              key={opt.value}
              onClick={() => multiSelect ? toggleSelected(opt.value) : handleSingleSelect(opt.value)}
              disabled={disabled}
              className={`px-3 py-1.5 rounded-full border text-sm transition-all disabled:opacity-50 ${
                isChecked
                  ? 'bg-brand-yellow text-brand-dark border-brand-yellow font-medium'
                  : 'bg-[var(--ov-surface-subtle,rgba(255,255,255,0.05))] text-[var(--ov-text,#ffffff)] border-[var(--ov-border,rgba(255,255,255,0.10))] hover:border-brand-yellow/40'
              }`}
            >
              {opt.icon && <span className="mr-1">{opt.icon}</span>}
              {opt.label}
            </button>
          )
        })}
        {allowCustom && !showCustomInput && (
          <button
            onClick={() => setShowCustomInput(true)}
            disabled={disabled}
            className="px-3 py-1.5 rounded-full border border-[var(--ov-border,rgba(255,255,255,0.10))] bg-[var(--ov-surface-subtle,rgba(255,255,255,0.05))] text-[var(--ov-text-muted,#727272)] text-sm hover:border-brand-yellow/40 transition-all"
          >
            ✏️ Other...
          </button>
        )}
        {showCustomInput && (
          <div className="w-full flex gap-2 mt-1">
            <input
              autoFocus
              value={customValue}
              onChange={(e) => setCustomValue(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCustomSubmit()}
              placeholder="Type your answer..."
              className="flex-1 bg-[var(--ov-input-bg,rgba(255,255,255,0.05))] border border-[var(--ov-border,rgba(255,255,255,0.10))] rounded-xl px-3 py-2 text-sm text-[var(--ov-text,#ffffff)] placeholder:text-[var(--ov-text-muted,#727272)] outline-none focus:border-brand-yellow/50"
            />
            <button
              onClick={handleCustomSubmit}
              disabled={disabled || !customValue.trim()}
              className="px-3 py-2 bg-brand-yellow text-brand-dark rounded-xl text-sm font-medium disabled:opacity-40"
            >
              Send
            </button>
          </div>
        )}
        {multiSelect && selected.length > 0 && (
          <button
            onClick={handleMultiConfirm}
            disabled={disabled}
            className="w-full mt-2 py-2 bg-brand-yellow text-brand-dark font-medium rounded-xl text-sm transition-all hover:bg-brand-yellow/90 disabled:opacity-50"
          >
            Continue →
          </button>
        )}
      </div>
    )
  }

  // style === 'list' (default) — AskUserQuestion clone
  return (
    <div className="mt-3 space-y-0 rounded-xl border border-[var(--ov-border,rgba(255,255,255,0.10))] overflow-hidden">
      {allOptions.map((opt, i) => {
        const isCustom = opt === 'custom'
        const value = isCustom ? '' : (opt as QuickReplyOption).value
        const isChecked = !isCustom && selected.includes(value)
        const num = i + 1

        if (isCustom) {
          return (
            <div key="custom" className="border-t border-[var(--ov-border,rgba(255,255,255,0.10))] first:border-t-0">
              {showCustomInput ? (
                <div className="flex gap-2 p-3">
                  <input
                    autoFocus
                    value={customValue}
                    onChange={(e) => setCustomValue(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleCustomSubmit()}
                    placeholder="Type your answer..."
                    className="flex-1 bg-[var(--ov-input-bg,rgba(255,255,255,0.05))] border border-[var(--ov-border,rgba(255,255,255,0.10))] rounded-lg px-3 py-2 text-sm text-[var(--ov-text,#ffffff)] placeholder:text-[var(--ov-text-muted,#727272)] outline-none focus:border-brand-yellow/50"
                  />
                  <button
                    onClick={handleCustomSubmit}
                    disabled={disabled || !customValue.trim()}
                    className="px-3 py-2 bg-brand-yellow text-brand-dark rounded-lg text-sm font-medium disabled:opacity-40"
                  >
                    Send
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowCustomInput(true)}
                  disabled={disabled}
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-[var(--ov-surface-subtle,rgba(255,255,255,0.05))] transition-colors text-left disabled:opacity-50"
                >
                  <span className="text-sm text-[var(--ov-text-muted,#727272)]">Type something else...</span>
                  <span className="text-xs text-[var(--ov-text-muted,#727272)] bg-[var(--ov-surface-subtle,rgba(255,255,255,0.10))] rounded-md px-2 py-0.5 font-mono">{num}</span>
                </button>
              )}
            </div>
          )
        }

        const option = opt as QuickReplyOption
        return (
          <button
            key={option.value}
            onClick={() => multiSelect ? toggleSelected(option.value) : handleSingleSelect(option.value)}
            disabled={disabled}
            className={`w-full flex items-start justify-between px-4 py-3 hover:bg-[var(--ov-surface-subtle,rgba(255,255,255,0.05))] transition-colors text-left border-t border-[var(--ov-border,rgba(255,255,255,0.10))] first:border-t-0 disabled:opacity-50 ${
              isChecked ? 'bg-[var(--ov-input-bg,rgba(255,255,255,0.10))]' : ''
            }`}
          >
            <div className="flex items-start gap-3 flex-1 min-w-0">
              {multiSelect && (
                <div className={`mt-0.5 w-4 h-4 rounded flex-shrink-0 border flex items-center justify-center ${
                  isChecked ? 'bg-brand-yellow border-brand-yellow' : 'border-[var(--ov-border,rgba(255,255,255,0.30))]'
                }`}>
                  {isChecked && <span className="text-brand-dark text-[10px] font-bold">✓</span>}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[var(--ov-text,#ffffff)]">
                  {option.icon && <span className="mr-1.5">{option.icon}</span>}
                  {option.label}
                </p>
                {option.description && (
                  <p className="text-xs text-[var(--ov-text-muted,#727272)] mt-0.5 leading-relaxed">{option.description}</p>
                )}
              </div>
            </div>
            <span className="text-xs text-[var(--ov-text-muted,#727272)] bg-[var(--ov-surface-subtle,rgba(255,255,255,0.10))] rounded-md px-2 py-0.5 font-mono ml-3 flex-shrink-0">{num}</span>
          </button>
        )
      })}

      {multiSelect && selected.length > 0 && (
        <div className="border-t border-[var(--ov-border,rgba(255,255,255,0.10))] p-3">
          <button
            onClick={handleMultiConfirm}
            disabled={disabled}
            className="w-full py-2 bg-brand-yellow text-brand-dark font-medium rounded-xl text-sm transition-all hover:bg-brand-yellow/90 disabled:opacity-50"
          >
            Continue →
          </button>
        </div>
      )}
    </div>
  )
}
