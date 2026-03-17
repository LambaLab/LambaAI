'use client'

import { useMemo } from 'react'
import type { Database } from '@/lib/supabase/types'
import ProposalListItem from './ProposalListItem'

type Proposal = Database['public']['Tables']['proposals']['Row']
type SortKey = 'newest' | 'oldest' | 'confidence' | 'price'
type StatusFilter = 'all' | Proposal['status']

type Props = {
  proposals: Proposal[]
  selectedId: string | null
  onSelect: (id: string) => void
  searchQuery: string
  statusFilter: StatusFilter
  sortKey: SortKey
}

export default function ProposalList({ proposals, selectedId, onSelect, searchQuery, statusFilter, sortKey }: Props) {
  const filtered = useMemo(() => {
    let result = [...proposals]

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

    if (statusFilter !== 'all') {
      result = result.filter((p) => p.status === statusFilter)
    }

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

  if (filtered.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-8">No proposals found.</p>
  }

  return (
    <div>
      {filtered.map((p) => (
        <ProposalListItem
          key={p.id}
          proposal={p}
          isSelected={selectedId === p.id}
          onClick={() => onSelect(p.id)}
        />
      ))}
      <div className="px-4 py-2 text-xs text-muted-foreground">
        {filtered.length} proposal{filtered.length !== 1 ? 's' : ''}
      </div>
    </div>
  )
}
