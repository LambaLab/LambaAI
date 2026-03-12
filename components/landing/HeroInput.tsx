'use client'

import { useState, useRef } from 'react'
import { ArrowRight } from 'lucide-react'

type Props = {
  onFirstMessage: (message: string) => void
}

export default function HeroInput({ onFirstMessage }: Props) {
  const [value, setValue] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  function handleSubmit() {
    const trimmed = value.trim()
    if (!trimmed) return
    onFirstMessage(trimmed)
  }

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setValue(e.target.value)
    const el = textareaRef.current
    if (el) {
      el.style.height = 'auto'
      el.style.height = `${el.scrollHeight}px`
    }
  }

  return (
    <div className="relative w-full max-w-2xl mx-auto">
      <div className="flex items-end gap-3 bg-white/5 border border-white/10 rounded-2xl p-4 focus-within:border-brand-yellow/50 transition-colors">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder="Describe your idea... (e.g. A marketplace for local service providers)"
          rows={1}
          className="flex-1 bg-transparent text-brand-white placeholder:text-brand-gray-mid resize-none outline-none text-base leading-relaxed min-h-[24px] max-h-[200px] overflow-y-auto font-inter"
        />
        <button
          onClick={handleSubmit}
          disabled={!value.trim()}
          className="flex-shrink-0 w-10 h-10 bg-brand-yellow rounded-xl flex items-center justify-center disabled:opacity-30 hover:bg-brand-yellow/90 transition-all active:scale-95"
          aria-label="Send message"
        >
          <ArrowRight className="w-5 h-5 text-brand-dark" />
        </button>
      </div>
      <p className="text-center text-brand-gray-mid text-sm mt-3">
        No account needed · Get a real proposal in minutes
      </p>
    </div>
  )
}
