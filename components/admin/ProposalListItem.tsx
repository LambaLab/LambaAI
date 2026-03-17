'use client'

import type { Database } from '@/lib/supabase/types'

type Proposal = Database['public']['Tables']['proposals']['Row']

type Props = {
  proposal: Proposal
  isSelected: boolean
  onClick: () => void
}

const STATUS_STYLES: Record<string, string> = {
  draft: 'bg-white/5 text-brand-gray-mid',
  saved: 'bg-white/5 text-brand-gray-mid',
  pending_review: 'bg-brand-yellow/10 text-brand-yellow',
  approved: 'bg-brand-green/10 text-brand-green',
  accepted: 'bg-brand-green/10 text-brand-green',
  budget_proposed: 'bg-brand-blue/10 text-brand-blue',
  budget_accepted: 'bg-brand-green/10 text-brand-green',
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
  const statusStyle = STATUS_STYLES[proposal.status] ?? STATUS_STYLES.draft

  return (
    <button
      onClick={onClick}
      className={`w-full text-left p-4 border-b border-white/5 transition-colors cursor-pointer ${
        isSelected
          ? 'bg-brand-yellow/5 border-l-2 border-l-brand-yellow'
          : 'hover:bg-white/[0.03] border-l-2 border-l-transparent'
      }`}
    >
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <p className="text-sm text-brand-white font-medium truncate flex-1">
          {getProjectName(proposal)}
        </p>
        <span className="text-[10px] text-brand-gray-mid whitespace-nowrap">
          {timeAgo(proposal.created_at)}
        </span>
      </div>

      <p className="text-xs text-brand-gray-mid line-clamp-1 mb-2">
        {proposal.email ?? 'No email'}
      </p>

      <div className="flex items-center justify-between">
        <span className={`text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider ${statusStyle}`}>
          {proposal.status.replace(/_/g, ' ')}
        </span>
        <div className="flex items-center gap-3 text-[11px] text-brand-gray-mid">
          <span>{proposal.confidence_score}%</span>
          {proposal.price_min > 0 && (
            <span className="font-medium text-brand-white">
              ${proposal.price_min.toLocaleString()}
            </span>
          )}
        </div>
      </div>
    </button>
  )
}
