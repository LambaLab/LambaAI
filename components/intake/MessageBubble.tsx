'use client'

import { useState, useEffect } from 'react'
import { Pencil, Check, X } from 'lucide-react'
import type { ChatMessage } from '@/hooks/useIntakeChat'
import QuickReplies from './QuickReplies'

type Props = {
  message: ChatMessage
  isStreaming?: boolean
  onQuickReply?: (value: string) => void
  isLastMessage?: boolean
  onEdit?: (messageId: string, newContent: string) => void
}

export default function MessageBubble({ message, isStreaming, onQuickReply, isLastMessage, onEdit }: Props) {
  const isUser = message.role === 'user'
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState(message.content)

  useEffect(() => {
    if (!isEditing) {
      setEditValue(message.content)
    }
  }, [message.content, isEditing])

  function handleEditSave() {
    if (!editValue.trim() || !onEdit) return
    onEdit(message.id, editValue.trim())
    setIsEditing(false)
  }

  function handleEditCancel() {
    setEditValue(message.content)
    setIsEditing(false)
  }

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className="max-w-[85%] space-y-3">
        <div className="relative group">
          {isEditing ? (
            <div className="space-y-2">
              <textarea
                autoFocus
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleEditSave() }
                  if (e.key === 'Escape') handleEditCancel()
                }}
                className="w-full px-4 py-3 rounded-2xl text-sm leading-relaxed bg-brand-yellow/20 text-[var(--ov-text,#ffffff)] border border-brand-yellow/40 outline-none resize-none min-h-[60px]"
              />
              <div className="flex gap-2 justify-end">
                <button
                  onClick={handleEditCancel}
                  className="flex items-center gap-1 text-xs text-brand-gray-mid hover:text-brand-white transition-colors px-2 py-1 rounded-lg hover:bg-white/5"
                >
                  <X className="w-3 h-3" /> Cancel
                </button>
                <button
                  onClick={handleEditSave}
                  disabled={!editValue.trim() || isStreaming}
                  className="flex items-center gap-1 text-xs text-brand-dark bg-brand-yellow hover:bg-brand-yellow/90 transition-colors px-2 py-1 rounded-lg disabled:opacity-40"
                >
                  <Check className="w-3 h-3" /> Save
                </button>
              </div>
            </div>
          ) : (
            <div
              className={`px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                isUser
                  ? 'bg-brand-yellow text-brand-dark font-medium rounded-br-sm'
                  : 'bg-[var(--ov-bubble-ai-bg,rgba(255,255,255,0.05))] text-[var(--ov-text,#ffffff)] border border-[var(--ov-bubble-ai-border,transparent)] rounded-bl-sm'
              }`}
            >
              {message.content}
              {isStreaming && !message.content && (
                <span className="inline-flex gap-1">
                  <span className="w-1.5 h-1.5 bg-brand-gray-mid rounded-full animate-bounce [animation-delay:0ms]" />
                  <span className="w-1.5 h-1.5 bg-brand-gray-mid rounded-full animate-bounce [animation-delay:150ms]" />
                  <span className="w-1.5 h-1.5 bg-brand-gray-mid rounded-full animate-bounce [animation-delay:300ms]" />
                </span>
              )}
            </div>
          )}

          {/* Edit button — only for user messages, only when onEdit is provided, not while editing */}
          {isUser && onEdit && !isEditing && (
            <button
              onClick={() => { setEditValue(message.content); setIsEditing(true) }}
              className="absolute -top-2 -left-8 opacity-0 group-hover:opacity-100 transition-opacity w-6 h-6 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center"
              aria-label="Edit message"
            >
              <Pencil className="w-3 h-3 text-brand-gray-mid" />
            </button>
          )}
        </div>

        {message.capabilityCards && message.capabilityCards.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {message.capabilityCards.map((card) => (
              <span
                key={card}
                className="px-3 py-1.5 text-xs font-medium border border-brand-yellow/30 text-brand-yellow rounded-lg"
              >
                {card}
              </span>
            ))}
          </div>
        )}

        {message.quickReplies && isLastMessage && onQuickReply && (
          <QuickReplies
            quickReplies={message.quickReplies}
            onSelect={onQuickReply}
            disabled={isStreaming}
          />
        )}
      </div>
    </div>
  )
}
