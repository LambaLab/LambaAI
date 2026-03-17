'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Send, UserPlus, Play, Radio } from 'lucide-react'

type ChatMessage = {
  id: string
  proposal_id: string
  role: 'user' | 'assistant' | 'admin'
  content: string
  metadata: unknown
  created_at: string
}

type Props = {
  proposalId: string
}

export default function ChatTab({ proposalId }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [adminMessage, setAdminMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [isJoined, setIsJoined] = useState(false)
  const [isLive, setIsLive] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const supabaseRef = useRef(createClient())

  // Load messages and subscribe to realtime
  useEffect(() => {
    const supabase = supabaseRef.current

    async function loadMessages() {
      const { data } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('proposal_id', proposalId)
        .order('created_at', { ascending: true })

      if (data) setMessages(data as ChatMessage[])
      setLoading(false)
    }

    loadMessages()

    // Subscribe to new messages via Realtime
    const channel = supabase
      .channel(`chat:${proposalId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `proposal_id=eq.${proposalId}`,
        },
        (payload) => {
          const newMsg = payload.new as ChatMessage
          setMessages((prev) => {
            // Avoid duplicates
            if (prev.some((m) => m.id === newMsg.id)) return prev
            return [...prev, newMsg]
          })
          setIsLive(true)
        }
      )
      .subscribe()

    // Broadcast channel for admin join/leave signaling
    const broadcastChannel = supabase.channel(`proposal:${proposalId}`)
    broadcastChannel.subscribe()

    return () => {
      supabase.removeChannel(channel)
      supabase.removeChannel(broadcastChannel)
    }
  }, [proposalId])

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function handleJoinChat() {
    const supabase = supabaseRef.current
    const channel = supabase.channel(`proposal:${proposalId}`)
    await channel.send({
      type: 'broadcast',
      event: 'admin_status',
      payload: { type: 'admin_joined' },
    })
    setIsJoined(true)
  }

  async function handleLeaveChat() {
    const supabase = supabaseRef.current
    const channel = supabase.channel(`proposal:${proposalId}`)
    await channel.send({
      type: 'broadcast',
      event: 'admin_status',
      payload: { type: 'admin_left' },
    })
    setIsJoined(false)
  }

  async function handleSendMessage(e: React.FormEvent) {
    e.preventDefault()
    if (!adminMessage.trim() || sending) return

    setSending(true)
    const res = await fetch('/api/admin/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ proposalId, content: adminMessage.trim() }),
    })

    if (res.ok) {
      setAdminMessage('')
    }
    setSending(false)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-5 h-5 border-2 border-brand-yellow/30 border-t-brand-yellow rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Live indicator + join/leave controls */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-white/5">
        <div className="flex items-center gap-2">
          {isLive && (
            <span className="flex items-center gap-1.5 text-[11px] text-brand-green">
              <Radio className="w-3 h-3 animate-pulse" />
              Live
            </span>
          )}
          <span className="text-[11px] text-brand-gray-mid">
            {messages.length} message{messages.length !== 1 ? 's' : ''}
          </span>
        </div>

        {isJoined ? (
          <button
            onClick={handleLeaveChat}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-brand-green/10 text-brand-green rounded-lg hover:bg-brand-green/20 transition-colors cursor-pointer"
          >
            <Play className="w-3 h-3" /> Resume AI
          </button>
        ) : (
          <button
            onClick={handleJoinChat}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-brand-blue/10 text-brand-blue rounded-lg hover:bg-brand-blue/20 transition-colors cursor-pointer"
          >
            <UserPlus className="w-3 h-3" /> Join Chat
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-hide">
        {messages.length === 0 && (
          <p className="text-sm text-brand-gray-mid text-center py-8">No messages yet.</p>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'items-start gap-2'}`}
          >
            {msg.role !== 'user' && (
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5 ${
                msg.role === 'admin'
                  ? 'bg-brand-blue/20 text-brand-blue'
                  : 'bg-white/10 text-brand-gray-mid'
              }`}>
                {msg.role === 'admin' ? 'A' : 'AI'}
              </div>
            )}

            <div className={`max-w-[80%] space-y-1`}>
              {msg.role === 'admin' && (
                <span className="text-[10px] text-brand-blue font-medium uppercase tracking-wider">[Admin]</span>
              )}
              <div className={`px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-transparent border border-brand-yellow text-brand-white rounded-br-sm'
                  : msg.role === 'admin'
                    ? 'bg-brand-blue/10 border border-brand-blue/20 text-brand-white rounded-bl-sm'
                    : 'bg-white/5 text-brand-white rounded-bl-sm'
              }`}>
                {msg.content}
              </div>
              <p className="text-[10px] text-[#555] px-1">
                {new Date(msg.created_at).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
              </p>
            </div>
          </div>
        ))}

        <div ref={messagesEndRef} />
      </div>

      {/* Admin input — only when joined */}
      {isJoined && (
        <form onSubmit={handleSendMessage} className="p-4 border-t border-white/5">
          <div className="flex items-center gap-2">
            <input
              value={adminMessage}
              onChange={(e) => setAdminMessage(e.target.value)}
              placeholder="Type a message as admin..."
              className="flex-1 px-4 py-2.5 bg-white/5 border border-brand-blue/20 rounded-xl text-sm text-brand-white placeholder-brand-gray-mid/50 outline-none focus:border-brand-blue/40 transition-colors"
              autoFocus
            />
            <button
              type="submit"
              disabled={!adminMessage.trim() || sending}
              className="p-2.5 bg-brand-blue rounded-xl hover:bg-brand-blue/90 transition-colors disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
            >
              <Send className="w-4 h-4 text-white" />
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
