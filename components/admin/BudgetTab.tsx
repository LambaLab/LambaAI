'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { DollarSign, Send, Clock, Check, MessageSquare, Phone } from 'lucide-react'
import type { Database } from '@/lib/supabase/types'

type BudgetProposal = Database['public']['Tables']['budget_proposals']['Row']

type Props = {
  proposalId: string
  proposalEmail: string | null
  proposalSlug: string | null
}

const STATUS_ICONS: Record<string, typeof Check> = {
  pending: Clock,
  accepted: Check,
  countered: MessageSquare,
  call_requested: Phone,
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'text-brand-yellow',
  accepted: 'text-brand-green',
  countered: 'text-brand-blue',
  call_requested: 'text-brand-gray-mid',
}

export default function BudgetTab({ proposalId, proposalEmail, proposalSlug }: Props) {
  const [budgets, setBudgets] = useState<BudgetProposal[]>([])
  const [loading, setLoading] = useState(true)
  const [amount, setAmount] = useState('')
  const [clientNotes, setClientNotes] = useState('')
  const [internalNotes, setInternalNotes] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const supabaseRef = useRef(createClient())

  useEffect(() => {
    const supabase = supabaseRef.current

    async function loadBudgets() {
      const { data } = await supabase
        .from('budget_proposals')
        .select('*')
        .eq('proposal_id', proposalId)
        .order('created_at', { ascending: true })

      if (data) setBudgets(data)
      setLoading(false)
    }

    loadBudgets()

    // Subscribe to realtime updates (e.g., user responds)
    const channel = supabase
      .channel(`budget:${proposalId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'budget_proposals',
          filter: `proposal_id=eq.${proposalId}`,
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setBudgets((prev) => [...prev, payload.new as BudgetProposal])
          } else if (payload.eventType === 'UPDATE') {
            setBudgets((prev) =>
              prev.map((b) => (b.id === (payload.new as BudgetProposal).id ? payload.new as BudgetProposal : b))
            )
          }
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [proposalId])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const amountNum = parseInt(amount, 10)
    if (!amountNum || amountNum <= 0) {
      setError('Please enter a valid amount')
      return
    }

    setSending(true)
    setError(null)

    const res = await fetch('/api/admin/budget', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        proposalId,
        amount: amountNum,
        clientNotes: clientNotes.trim() || null,
        internalNotes: internalNotes.trim() || null,
      }),
    })

    if (!res.ok) {
      const data = await res.json()
      setError(data.error ?? 'Failed to send budget proposal')
    } else {
      setAmount('')
      setClientNotes('')
      setInternalNotes('')
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
    <div className="p-6 space-y-6">
      {/* Budget history */}
      {budgets.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-xs text-brand-gray-mid uppercase tracking-wider">Budget history</h3>
          <div className="space-y-2">
            {budgets.map((budget) => {
              const Icon = STATUS_ICONS[budget.status] ?? Clock
              const color = STATUS_COLORS[budget.status] ?? 'text-brand-gray-mid'
              return (
                <div key={budget.id} className="p-4 bg-white/[0.03] border border-white/5 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <DollarSign className="w-4 h-4 text-brand-green" />
                      <span className="text-lg font-bold text-brand-white">
                        ${budget.amount.toLocaleString()}
                      </span>
                    </div>
                    <div className={`flex items-center gap-1.5 text-xs ${color}`}>
                      <Icon className="w-3.5 h-3.5" />
                      {budget.status.replace(/_/g, ' ')}
                    </div>
                  </div>

                  {budget.client_notes && (
                    <p className="text-sm text-brand-gray-mid">{budget.client_notes}</p>
                  )}

                  {budget.internal_notes && (
                    <p className="text-xs text-brand-yellow/60 italic">Internal: {budget.internal_notes}</p>
                  )}

                  {budget.status === 'countered' && budget.counter_amount && (
                    <div className="p-3 bg-brand-blue/5 border border-brand-blue/10 rounded-lg">
                      <p className="text-xs text-brand-blue mb-1">Counter-offer</p>
                      <p className="text-sm font-bold text-brand-white">${budget.counter_amount.toLocaleString()}</p>
                      {budget.counter_notes && (
                        <p className="text-xs text-brand-gray-mid mt-1">{budget.counter_notes}</p>
                      )}
                    </div>
                  )}

                  {budget.status === 'call_requested' && budget.counter_notes && (
                    <div className="p-3 bg-white/5 border border-white/10 rounded-lg">
                      <p className="text-xs text-brand-gray-mid mb-1">Call request note</p>
                      <p className="text-sm text-brand-white">{budget.counter_notes}</p>
                    </div>
                  )}

                  <p className="text-[10px] text-[#555]">
                    {new Date(budget.created_at).toLocaleString()}
                    {budget.responded_at && ` · Responded ${new Date(budget.responded_at).toLocaleString()}`}
                  </p>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* New budget proposal form */}
      <div className="space-y-3">
        <h3 className="text-xs text-brand-gray-mid uppercase tracking-wider">
          {budgets.length > 0 ? 'Send new budget' : 'Propose a budget'}
        </h3>

        {!proposalEmail && (
          <div className="p-3 bg-brand-yellow/5 border border-brand-yellow/10 rounded-lg text-xs text-brand-yellow">
            No email on file. The client won't receive an email notification.
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-[11px] text-brand-gray-mid mb-1">Amount (USD)</label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-gray-mid" />
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="12000"
                min="1"
                className="w-full pl-9 pr-4 py-2.5 bg-white/[0.03] border border-white/10 rounded-xl text-sm text-brand-white outline-none focus:border-brand-yellow/30 transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] text-brand-gray-mid mb-1">Notes to client (optional)</label>
            <textarea
              value={clientNotes}
              onChange={(e) => setClientNotes(e.target.value)}
              placeholder="Here's why we think this is fair..."
              className="w-full px-4 py-2.5 bg-white/[0.03] border border-white/10 rounded-xl text-sm text-brand-white outline-none focus:border-brand-yellow/30 transition-colors min-h-[80px] resize-y placeholder-brand-gray-mid/50"
            />
          </div>

          <div>
            <label className="block text-[11px] text-brand-gray-mid mb-1">Internal notes (admin only)</label>
            <textarea
              value={internalNotes}
              onChange={(e) => setInternalNotes(e.target.value)}
              placeholder="Pricing rationale, margin notes..."
              className="w-full px-4 py-2.5 bg-white/[0.03] border border-brand-yellow/10 rounded-xl text-sm text-brand-white outline-none focus:border-brand-yellow/30 transition-colors min-h-[60px] resize-y placeholder-brand-gray-mid/50"
            />
          </div>

          {error && <p className="text-xs text-red-400">{error}</p>}

          <button
            type="submit"
            disabled={sending || !amount}
            className="w-full flex items-center justify-center gap-2 py-3 bg-brand-yellow text-brand-dark font-medium rounded-xl hover:bg-brand-yellow/90 transition-all disabled:opacity-50 text-sm cursor-pointer disabled:cursor-not-allowed"
          >
            <Send className="w-4 h-4" />
            {sending ? 'Sending...' : 'Send Budget Proposal'}
          </button>
        </form>
      </div>
    </div>
  )
}
