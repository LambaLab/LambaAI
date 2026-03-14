'use client'

import { useRef, useEffect, useState } from 'react'
import { ArrowRight } from 'lucide-react'
import MessageBubble from './MessageBubble'
import QuickReplies from './QuickReplies'
import type { ChatMessage } from '@/hooks/useIntakeChat'
import type { QuickReplies as QuickRepliesType } from '@/lib/intake-types'

type Props = {
  messages: ChatMessage[]
  isStreaming: boolean
  onSend: (message: string, displayContent?: string, sourceQR?: QuickRepliesType, sourceQuestion?: string) => void
  onEdit?: (messageId: string, newContent: string, displayContent?: string) => void
  constrained?: boolean
}

export default function ChatPanel({ messages, isStreaming, onSend, onEdit, constrained = false }: Props) {
  const [input, setInput] = useState('')
  const [reEditingMessageId, setReEditingMessageId] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // After the panel open/close animation completes, snap to bottom so
  // the latest message is always in view regardless of reflow from width change
  useEffect(() => {
    const timer = setTimeout(() => {
      bottomRef.current?.scrollIntoView({ behavior: 'instant' })
    }, 320) // just after the 300ms CSS transition
    return () => clearTimeout(timer)
  }, [constrained])

  // Clear re-edit mode when AI starts streaming (edit was confirmed)
  useEffect(() => {
    if (isStreaming) setReEditingMessageId(null)
  }, [isStreaming])

  function handleSubmit() {
    const trimmed = input.trim()
    if (!trimmed || isStreaming) return
    setReEditingMessageId(null)
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

  // Detect if the last assistant message has list-style quick replies
  // (only show when not streaming, so the rows don't flash during response)
  const lastMsg = messages[messages.length - 1]
  const listQR =
    !isStreaming && lastMsg?.role === 'assistant' && lastMsg.quickReplies?.style === 'list'
      ? lastMsg.quickReplies
      : null
  const questionText = listQR ? (lastMsg?.question ?? undefined) : undefined

  // Re-editing: user tapped edit on a past row-selection bubble
  const reEditingMsg = reEditingMessageId ? messages.find(m => m.id === reEditingMessageId) : null
  const reEditingQR = reEditingMsg?.sourceQuickReplies ?? null
  const reEditingQuestion = reEditingMsg?.sourceQuestion

  // Active QR at bottom: re-edit takes priority over new question QR
  const activeQR = reEditingQR ?? listQR
  const activeQuestion = reEditingQR ? reEditingQuestion : questionText

  return (
    <div className="flex flex-col h-full">
      {/* Messages — scroll container stays full-width always; content div handles centering */}
      <div className="flex-1 overflow-y-auto py-4">
        <div
          className="px-4 space-y-4 mx-auto transition-[max-width] duration-300 ease-in-out"
          style={{ maxWidth: constrained ? '650px' : '9999px' }}
        >
          {messages.map((msg, i) => (
            <MessageBubble
              key={msg.id}
              message={msg}
              isStreaming={isStreaming && i === messages.length - 1 && msg.role === 'assistant'}
              onQuickReply={(value, label) => onSend(value, label)}
              isLastMessage={i === messages.length - 1}
              onEdit={onEdit}
              onStartRowEdit={setReEditingMessageId}
              isBeingReEdited={msg.id === reEditingMessageId}
            />
          ))}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* Bottom area: list rows card (new question OR re-edit) OR regular textarea */}
      <div className="flex-shrink-0 px-4 pb-4">
        <div
          className="mx-auto transition-[max-width] duration-300 ease-in-out"
          style={{ maxWidth: constrained ? '650px' : '9999px' }}
        >
        {activeQR ? (
          <>
            {reEditingQR && (
              <div className="mb-2 flex items-center justify-between px-1">
                <span className="text-xs text-[var(--ov-text-muted,#727272)]">Changing your answer...</span>
                <button
                  onClick={() => setReEditingMessageId(null)}
                  className="text-xs text-brand-gray-mid hover:text-brand-white transition-colors cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            )}
            <QuickReplies
              quickReplies={activeQR}
              onSelect={(value, label) => {
                // displayContent is just the answer label — question is shown separately above the bubble
                const answerDisplay = label || value
                if (reEditingQR && reEditingMessageId) {
                  // Re-edit: replace the old message and re-run AI
                  onEdit?.(reEditingMessageId, value, answerDisplay)
                  setReEditingMessageId(null)
                } else {
                  // Normal selection: new user message
                  onSend(value, answerDisplay, activeQR, activeQuestion || undefined)
                }
              }}
              disabled={isStreaming}
              question={activeQuestion}
            />
          </>
        ) : (
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
              className="w-8 h-8 bg-brand-yellow rounded-lg flex items-center justify-center disabled:opacity-30 hover:bg-brand-yellow/90 transition-all active:scale-95 flex-shrink-0 cursor-pointer disabled:cursor-not-allowed"
              aria-label="Send message"
            >
              <ArrowRight className="w-4 h-4 text-brand-dark" />
            </button>
          </div>
        )}
        </div>
      </div>
    </div>
  )
}
