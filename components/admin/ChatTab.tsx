'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Send, UserPlus, Play, Radio } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'

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

  // Load messages via admin API (bypasses RLS) and poll for updates
  useEffect(() => {
    const supabase = supabaseRef.current

    async function loadMessages() {
      try {
        const res = await fetch(`/api/admin/chat/${proposalId}`)
        if (res.ok) {
          const data = await res.json()
          setMessages(data as ChatMessage[])
        }
      } catch { /* ignore */ }
      setLoading(false)
    }

    loadMessages()

    // Poll for new messages every 3 seconds (Realtime postgres_changes
    // is blocked by RLS for the admin user, so we use polling instead)
    const pollInterval = setInterval(async () => {
      try {
        const res = await fetch(`/api/admin/chat/${proposalId}`)
        if (res.ok) {
          const data = await res.json() as ChatMessage[]
          setMessages((prev) => {
            if (data.length !== prev.length) {
              setIsLive(true)
              return data
            }
            return prev
          })
        }
      } catch { /* ignore */ }
    }, 3000)

    // Broadcast channel for admin join/leave signaling
    const broadcastChannel = supabase.channel(`proposal:${proposalId}`)
    broadcastChannel.subscribe()

    return () => {
      clearInterval(pollInterval)
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

    const content = adminMessage.trim()
    setSending(true)
    const res = await fetch('/api/admin/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ proposalId, content }),
    })

    if (res.ok) {
      const savedMsg = await res.json() as ChatMessage
      // Optimistic update — show the message immediately in admin panel
      setMessages((prev) => {
        if (prev.some((m) => m.id === savedMsg.id)) return prev
        return [...prev, savedMsg]
      })
      setAdminMessage('')

      // Broadcast the message to the client so it appears in their chat
      const supabase = supabaseRef.current
      const channel = supabase.channel(`proposal:${proposalId}`)
      await channel.send({
        type: 'broadcast',
        event: 'admin_message',
        payload: { id: savedMsg.id, content, created_at: savedMsg.created_at },
      })
    }
    setSending(false)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Live indicator + join/leave controls */}
      <div className="flex items-center justify-between px-4 py-2 border-b">
        <div className="flex items-center gap-2">
          {isLive && (
            <span className="flex items-center gap-1.5 text-[11px] text-green-500">
              <Radio className="w-3 h-3 animate-pulse" />
              Live
            </span>
          )}
          <span className="text-[11px] text-muted-foreground">
            {messages.length} message{messages.length !== 1 ? 's' : ''}
          </span>
        </div>

        {isJoined ? (
          <Button
            variant="outline"
            size="sm"
            onClick={handleLeaveChat}
            className="flex items-center gap-1.5 text-xs bg-green-500/10 text-green-500 hover:bg-green-500/20 hover:text-green-500 cursor-pointer"
          >
            <Play className="w-3 h-3" /> Resume AI
          </Button>
        ) : (
          <Button
            variant="outline"
            size="sm"
            onClick={handleJoinChat}
            className="flex items-center gap-1.5 text-xs bg-blue-500/10 text-blue-500 hover:bg-blue-500/20 hover:text-blue-500 cursor-pointer"
          >
            <UserPlus className="w-3 h-3" /> Join Chat
          </Button>
        )}
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 px-4 py-5">
        <div className="space-y-4">
          {messages.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">No messages yet.</p>
          )}

          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'items-start gap-2'}`}
            >
              {msg.role !== 'user' && (
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold flex-shrink-0 mt-0.5 ${
                  msg.role === 'admin'
                    ? 'bg-blue-500/20 text-blue-500'
                    : 'bg-muted text-muted-foreground'
                }`}>
                  {msg.role === 'admin' ? 'A' : 'AI'}
                </div>
              )}

              <div className={`max-w-[80%] space-y-1`}>
                {msg.role === 'admin' && (
                  <Badge variant="outline" className="text-blue-500 border-blue-500 text-[11px] font-medium uppercase tracking-wider">[Admin]</Badge>
                )}
                <div className={`px-3.5 py-2.5 text-sm leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-primary text-primary-foreground rounded-2xl rounded-br-sm'
                    : msg.role === 'admin'
                      ? 'bg-blue-50 dark:bg-blue-950 text-foreground border border-blue-500/20 rounded-2xl rounded-bl-sm'
                      : 'bg-secondary text-secondary-foreground rounded-2xl rounded-bl-sm'
                }`}>
                  {msg.content}
                </div>
                <p className="text-xs text-muted-foreground px-1">
                  {new Date(msg.created_at).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
                </p>
              </div>
            </div>
          ))}

          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {/* Admin input — only when joined */}
      {isJoined && (
        <form onSubmit={handleSendMessage} className="p-4 border-t bg-background">
          <div className="flex items-center gap-2">
            <Input
              value={adminMessage}
              onChange={(e) => setAdminMessage(e.target.value)}
              placeholder="Type a message as admin..."
              className="flex-1 rounded-xl"
              autoFocus
            />
            <Button
              type="submit"
              size="icon"
              disabled={!adminMessage.trim() || sending}
              className="rounded-xl cursor-pointer"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </form>
      )}
    </div>
  )
}
