'use client'

import { useRef, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight } from 'lucide-react'
import MessageBubble from './MessageBubble'
import ConfidenceBar from './ConfidenceBar'
import AuthGateModal from './AuthGateModal'
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
  const router = useRouter()
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

  function handleAuthSuccess() {
    setShowAuthGate(false)
    router.push(`/proposal/${proposalId}?status=pending`)
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

      {showAuthGate && (
        <AuthGateModal
          proposalId={proposalId}
          onClose={() => setShowAuthGate(false)}
          onSuccess={handleAuthSuccess}
        />
      )}
    </div>
  )
}
