'use client'

import { useState, useMemo } from 'react'
import { ChevronDown } from 'lucide-react'
import type { Database } from '@/lib/supabase/types'
import ProposalListItem from './ProposalListItem'

type Proposal = Database['public']['Tables']['proposals']['Row']
type SortKey = 'newest' | 'oldest' | 'confidence' | 'price'
type StatusFilter = 'all' | Proposal['status']

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'All statuses' },
  { value: 'draft', label: 'Draft' },
  { value: 'pending_review', label: 'Pending review' },
  { value: 'approved', label: 'Approved' },
  { value: 'budget_proposed', label: 'Budget proposed' },
  { value: 'accepted', label: 'Accepted' },
  { value: 'budget_accepted', label: 'Budget accepted' },
]

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'newest', label: 'Newest' },
  { value: 'oldest', label: 'Oldest' },
  { value: 'confidence', label: 'Confidence' },
  { value: 'price', label: 'Price' },
]

type Props = {
  proposals: Proposal[]
  selectedId: string | null
  onSelect: (id: string) => void
  searchQuery: string
}

export default function ProposalList({ proposals, selectedId, onSelect, searchQuery }: Props) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [sortKey, setSortKey] = useState<SortKey>('newest')

  const filtered = useMemo(() => {
    let result = [...proposals]

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      result = result.filter((p) => {
        const meta = p.metadata as Record<string, unknown> | null
        const projectName = (meta?.projectName as string) ?? ''
        return (
          projectName.toLowerCase().includes(q) ||
          (p.brief ?? '').toLowerCase().includes(q) ||
          (p.email ?? '').toLowerCase().includes(q)
        )
      })
    }

    // Status filter
    if (statusFilter !== 'all') {
      result = result.filter((p) => p.status === statusFilter)
    }

    // Sort
    result.sort((a, b) => {
      switch (sortKey) {
        case 'oldest':
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        case 'confidence':
          return b.confidence_score - a.confidence_score
        case 'price':
          return b.price_max - a.price_max
        case 'newest':
        default:
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      }
    })

    return result
  }, [proposals, searchQuery, statusFilter, sortKey])

  return (
    <div className="flex flex-col h-full">
      {/* Filters bar */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-white/5">
        <div className="relative flex-1">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            className="w-full appearance-none bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-brand-white outline-none focus:border-brand-yellow/40 cursor-pointer pr-7"
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value} className="bg-brand-dark">
                {opt.label}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-brand-gray-mid pointer-events-none" />
        </div>

        <div className="relative">
          <select
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as SortKey)}
            className="appearance-none bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-brand-white outline-none focus:border-brand-yellow/40 cursor-pointer pr-7"
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value} className="bg-brand-dark">
                {opt.label}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-brand-gray-mid pointer-events-none" />
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto scrollbar-hide">
        {filtered.length === 0 ? (
          <p className="text-sm text-brand-gray-mid text-center py-8">No proposals found.</p>
        ) : (
          filtered.map((p) => (
            <ProposalListItem
              key={p.id}
              proposal={p}
              isSelected={selectedId === p.id}
              onClick={() => onSelect(p.id)}
            />
          ))
        )}
      </div>

      {/* Count */}
      <div className="px-4 py-2 border-t border-white/5 text-[11px] text-brand-gray-mid">
        {filtered.length} proposal{filtered.length !== 1 ? 's' : ''}
      </div>
    </div>
  )
}
