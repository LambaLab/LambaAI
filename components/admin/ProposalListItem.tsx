'use client'

import type { Database } from '@/lib/supabase/types'
import { Badge } from '@/components/ui/badge'

type Proposal = Database['public']['Tables']['proposals']['Row']

type Props = {
  proposal: Proposal
  isSelected: boolean
  onClick: () => void
}

function getStatusBadge(status: string) {
  const label = status.replace(/_/g, ' ')

  switch (status) {
    case 'draft':
    case 'saved':
      return <Badge variant="secondary" className="text-[10px] uppercase tracking-wider">{label}</Badge>
    case 'pending_review':
      return <Badge variant="outline" className="border-yellow-500 text-yellow-600 dark:text-yellow-400 text-[10px] uppercase tracking-wider">{label}</Badge>
    case 'approved':
    case 'accepted':
    case 'budget_accepted':
      return <Badge variant="outline" className="border-green-500 text-green-600 dark:text-green-400 text-[10px] uppercase tracking-wider">{label}</Badge>
    case 'budget_proposed':
      return <Badge variant="outline" className="border-blue-500 text-blue-600 dark:text-blue-400 text-[10px] uppercase tracking-wider">{label}</Badge>
    default:
      return <Badge variant="secondary" className="text-[10px] uppercase tracking-wider">{label}</Badge>
  }
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days}d ago`
  return new Date(dateStr).toLocaleDateString()
}

function getProjectName(proposal: Proposal): string {
  const meta = proposal.metadata as Record<string, unknown> | null
  if (meta?.projectName && typeof meta.projectName === 'string') return meta.projectName
  if (proposal.brief) return proposal.brief.slice(0, 40) + (proposal.brief.length > 40 ? '...' : '')
  return 'Untitled'
}

export default function ProposalListItem({ proposal, isSelected, onClick }: Props) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left p-4 border-b transition-colors cursor-pointer ${
        isSelected
          ? 'bg-accent border-l-2 border-l-primary'
          : 'hover:bg-accent/50 border-l-2 border-l-transparent'
      }`}
    >
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <p className="text-sm text-foreground font-medium truncate flex-1">
          {getProjectName(proposal)}
        </p>
        <span className="text-[10px] text-muted-foreground whitespace-nowrap">
          {timeAgo(proposal.created_at)}
        </span>
      </div>

      <p className="text-xs text-muted-foreground line-clamp-1 mb-2">
        {proposal.email ?? 'No email'}
      </p>

      <div className="flex items-center justify-between">
        {getStatusBadge(proposal.status)}
        <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
          <span>{proposal.confidence_score}%</span>
          {proposal.price_min > 0 && (
            <span className="font-medium text-foreground">
              ${proposal.price_min.toLocaleString()}
            </span>
          )}
        </div>
      </div>
    </button>
  )
}
