'use client'

import { useRef, useEffect, useState } from 'react'
import { ArrowRight } from 'lucide-react'
import MessageBubble from './MessageBubble'
import type { ChatMessage } from '@/hooks/useIntakeChat'

type Props = {
  messages: ChatMessage[]
  isStreaming: boolean
  onSend: (message: string) => void
  onEdit?: (messageId: string, newContent: string) => void
}

export default function ChatPanel({ messages, isStreaming, onSend, onEdit }: Props) {
  const [input, setInput] = useState('')
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
      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.map((msg, i) => (
          <MessageBubble
            key={msg.id}
            message={msg}
            isStreaming={isStreaming && i === messages.length - 1 && msg.role === 'assistant'}
            onQuickReply={onSend}
            isLastMessage={i === messages.length - 1}
            onEdit={onEdit}
          />
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input area */}
      <div className="flex-shrink-0 px-4 pb-4">
        <div className="flex items-end gap-2 bg-[var(--ov-input-bg,rgba(255,255,255,0.05))] border border-[var(--ov-border,rgba(255,255,255,0.10))] rounded-xl p-3 focus-within:border-brand-yellow/30 transition-colors">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleTextareaChange}
            onKeyDown={handleKeyDown}
            placeholder={messages.length === 0 ? "Describe the idea you want to build..." : "Tell me more..."}
            rows={1}
            disabled={isStreaming}
            aria-label="Chat input"
            className="flex-1 bg-transparent text-[var(--ov-text,#ffffff)] placeholder:text-[var(--ov-text-muted,#727272)] resize-none outline-none text-sm leading-relaxed min-h-[20px] max-h-[120px] overflow-y-auto disabled:opacity-50"
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
    </div>
  )
}
