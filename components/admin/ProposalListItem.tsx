'use client'

import type { Database } from '@/lib/supabase/types'

type Proposal = Database['public']['Tables']['proposals']['Row']

type Props = {
  proposal: Proposal
  isSelected: boolean
  onClick: () => void
}

function getStatusStyle(status: string): { bg: string; text: string; dot: string } {
  switch (status) {
    case 'draft':
    case 'saved':
      return { bg: 'bg-zinc-100 dark:bg-zinc-800', text: 'text-zinc-600 dark:text-zinc-400', dot: 'bg-zinc-400' }
    case 'pending_review':
      return { bg: 'bg-yellow-50 dark:bg-yellow-500/10', text: 'text-yellow-700 dark:text-yellow-400', dot: 'bg-yellow-500' }
    case 'approved':
      return { bg: 'bg-emerald-50 dark:bg-emerald-500/10', text: 'text-emerald-700 dark:text-emerald-400', dot: 'bg-emerald-500' }
    case 'budget_proposed':
      return { bg: 'bg-blue-50 dark:bg-blue-500/10', text: 'text-blue-700 dark:text-blue-400', dot: 'bg-blue-500' }
    case 'accepted':
    case 'budget_accepted':
      return { bg: 'bg-violet-50 dark:bg-violet-500/10', text: 'text-violet-700 dark:text-violet-400', dot: 'bg-violet-500' }
    default:
      return { bg: 'bg-zinc-100 dark:bg-zinc-800', text: 'text-zinc-600 dark:text-zinc-400', dot: 'bg-zinc-400' }
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

function getConfidenceColor(score: number): string {
  if (score >= 80) return 'text-emerald-600 dark:text-emerald-400'
  if (score >= 50) return 'text-yellow-600 dark:text-yellow-400'
  return 'text-zinc-500 dark:text-zinc-400'
}

export default function ProposalListItem({ proposal, isSelected, onClick }: Props) {
  const status = getStatusStyle(proposal.status)
  const statusLabel = proposal.status.replace(/_/g, ' ')

  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-4 py-3 border-b transition-colors cursor-pointer group ${
        isSelected
          ? 'bg-yellow-50/80 dark:bg-yellow-500/5 border-l-2 border-l-yellow-500'
          : 'hover:bg-muted/50 border-l-2 border-l-transparent'
      }`}
    >
      {/* Line 1: Project name + status badge + time */}
      <div className="flex items-center gap-2 mb-1">
        <p className={`text-sm truncate flex-1 ${
          isSelected ? 'font-semibold text-foreground' : 'font-medium text-foreground'
        }`}>
          {getProjectName(proposal)}
        </p>

        <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full shrink-0 uppercase tracking-wide ${status.bg} ${status.text}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />
          {statusLabel}
        </span>
      </div>

      {/* Line 2: Email + confidence + price */}
      <div className="flex items-center gap-2 text-xs">
        <span className="text-muted-foreground truncate flex-1">
          {proposal.email ?? 'No email'}
        </span>

        <span className={`font-medium tabular-nums ${getConfidenceColor(proposal.confidence_score)}`}>
          {proposal.confidence_score}%
        </span>

        {proposal.price_min > 0 && (
          <>
            <span className="text-muted-foreground/40">·</span>
            <span className="font-medium text-foreground tabular-nums">
              ${proposal.price_min.toLocaleString()}
            </span>
          </>
        )}

        <span className="text-muted-foreground/40">·</span>
        <span className="text-muted-foreground whitespace-nowrap text-[11px]">
          {timeAgo(proposal.created_at)}
        </span>
      </div>
    </button>
  )
}
