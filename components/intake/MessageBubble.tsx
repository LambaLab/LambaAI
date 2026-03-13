import type { ChatMessage } from '@/hooks/useIntakeChat'
import QuickReplies from './QuickReplies'

type Props = {
  message: ChatMessage
  isStreaming?: boolean
  onQuickReply?: (value: string) => void
  isLastMessage?: boolean
}

export default function MessageBubble({ message, isStreaming, onQuickReply, isLastMessage }: Props) {
  const isUser = message.role === 'user'
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className="max-w-[85%] space-y-3">
        <div
          className={`px-4 py-3 rounded-2xl text-sm leading-relaxed ${
            isUser
              ? 'bg-brand-yellow text-brand-dark font-medium rounded-br-sm'
              : 'bg-white/5 text-brand-white rounded-bl-sm'
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
