'use client'

import { useRef, useEffect, useState } from 'react'
import { ArrowRight } from 'lucide-react'
import MessageBubble from './MessageBubble'
import ConfidenceBar from './ConfidenceBar'
import type { ChatMessage } from '@/hooks/useIntakeChat'
import type { PriceRange } from '@/lib/pricing/engine'
import { formatPriceRange } from '@/lib/pricing/engine'

type Props = {
  messages: ChatMessage[]
  isStreaming: boolean
  confidenceScore: number
  onSend: (message: string) => void
  proposalId: string
  pricingVisible: boolean
  priceRange: PriceRange
}

export default function ChatPanel({
  messages, isStreaming, confidenceScore, onSend,
  proposalId, pricingVisible, priceRange,
}: Props) {
  const [input, setInput] = useState('')
  const [showAuthGate, setShowAuthGate] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  function handleSubmit() {
    const trimmed = input.trim()
    if (!trimmed || isStreaming) return
    onSend(trimmed)
    setInput('')
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  function handleTextareaChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setInput(e.target.value)
    const el = e.target
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }

  return (
    <div className="flex flex-col h-full">
      {/* Confidence bar header */}
      <div className="px-4 py-3 border-b border-white/5 flex-shrink-0 space-y-3">
        <ConfidenceBar score={confidenceScore} />
        {pricingVisible && (
          <div className="flex items-center justify-between">
            <span className="text-xs text-brand-gray-mid">Estimated range</span>
            <span className="font-bebas text-xl text-brand-yellow">{formatPriceRange(priceRange)}</span>
          </div>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.map((msg, i) => (
          <MessageBubble
            key={msg.id}
            message={msg}
            isStreaming={isStreaming && i === messages.length - 1 && msg.role === 'assistant'}
          />
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input area */}
      <div className="flex-shrink-0 px-4 pb-4">
        {pricingVisible && (
          <div className="mb-3">
            <button
              onClick={() => setShowAuthGate(true)}
              className="w-full py-3 bg-brand-yellow text-brand-dark font-medium rounded-xl hover:bg-brand-yellow/90 transition-all active:scale-[0.98] text-sm"
            >
              View Full Proposal →
            </button>
          </div>
        )}
        <div className="flex items-end gap-2 bg-white/5 border border-white/10 rounded-xl p-3 focus-within:border-brand-yellow/30 transition-colors">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleTextareaChange}
            onKeyDown={handleKeyDown}
            placeholder="Tell me more..."
            rows={1}
            disabled={isStreaming}
            aria-label="Chat input"
            className="flex-1 bg-transparent text-brand-white placeholder:text-brand-gray-mid resize-none outline-none text-sm leading-relaxed min-h-[20px] max-h-[120px] overflow-y-auto disabled:opacity-50"
          />
          <button
            onClick={handleSubmit}
            disabled={!input.trim() || isStreaming}
            className="w-8 h-8 bg-brand-yellow rounded-lg flex items-center justify-center disabled:opacity-30 hover:bg-brand-yellow/90 transition-all active:scale-95 flex-shrink-0"
            aria-label="Send message"
          >
            <ArrowRight className="w-4 h-4 text-brand-dark" />
          </button>
        </div>
      </div>

      {/* Auth gate placeholder — Task 10 will replace this */}
      {showAuthGate && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70" onClick={() => setShowAuthGate(false)} />
          <div className="relative bg-[#1d1d1d] border border-white/10 rounded-2xl p-6 w-full max-w-sm text-center">
            <p className="text-brand-white font-medium mb-2">Auth gate coming in Task 10</p>
            <p className="text-brand-gray-mid text-sm mb-4">Proposal ID: {proposalId}</p>
            <button onClick={() => setShowAuthGate(false)} className="text-brand-gray-mid text-sm hover:text-brand-white">Close</button>
          </div>
        </div>
      )}
    </div>
  )
}
