'use client'

import { useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import type { Database } from '@/lib/supabase/types'
import { MODULE_CATALOG } from '@/lib/modules/catalog'
import { Button } from '@/components/ui/button'
import ProposalEditor from './ProposalEditor'
import ChatTab from './ChatTab'
import BudgetTab from './BudgetTab'

type Proposal = Database['public']['Tables']['proposals']['Row']

type Props = {
  proposal: Proposal
  onBack: () => void
  onProposalUpdate: (updated: Proposal) => void
}

type DetailTab = 'proposal' | 'chat'

function getStatusStyle(status: string): { bg: string; text: string; dot: string; label: string } {
  const label = status.replace(/_/g, ' ')
  switch (status) {
    case 'draft':
    case 'saved':
      return { bg: 'bg-zinc-100 dark:bg-zinc-800', text: 'text-zinc-600 dark:text-zinc-400', dot: 'bg-zinc-400', label }
    case 'pending_review':
      return { bg: 'bg-yellow-50 dark:bg-yellow-500/10', text: 'text-yellow-700 dark:text-yellow-400', dot: 'bg-yellow-500', label }
    case 'approved':
      return { bg: 'bg-emerald-50 dark:bg-emerald-500/10', text: 'text-emerald-700 dark:text-emerald-400', dot: 'bg-emerald-500', label }
    case 'budget_proposed':
      return { bg: 'bg-blue-50 dark:bg-blue-500/10', text: 'text-blue-700 dark:text-blue-400', dot: 'bg-blue-500', label }
    case 'accepted':
    case 'budget_accepted':
      return { bg: 'bg-violet-50 dark:bg-violet-500/10', text: 'text-violet-700 dark:text-violet-400', dot: 'bg-violet-500', label }
    default:
      return { bg: 'bg-zinc-100 dark:bg-zinc-800', text: 'text-zinc-600 dark:text-zinc-400', dot: 'bg-zinc-400', label }
  }
}

function getProjectName(proposal: Proposal): string {
  const meta = proposal.metadata as Record<string, unknown> | null
  if (meta?.projectName && typeof meta.projectName === 'string') return meta.projectName
  return 'Untitled'
}

export default function ProposalDetail({ proposal, onBack, onProposalUpdate }: Props) {
  const [activeTab, setActiveTab] = useState<DetailTab>('proposal')

  const modules = (proposal.modules ?? []) as string[]
  const moduleNames = modules
    .map((id) => MODULE_CATALOG.find((m) => m.id === id)?.name ?? id)

  const status = getStatusStyle(proposal.status)

  const tabs: { value: DetailTab; label: string }[] = [
    { value: 'proposal', label: 'Proposal' },
    { value: 'chat', label: 'Chat' },
  ]

  return (
    <div className="flex flex-col h-full">
      {/* Sticky header with info + tabs */}
      <div className="shrink-0 bg-background border-b">
        {/* Title row */}
        <div className="px-4 md:px-6 pt-4 pb-2">
          <div className="flex items-center gap-3 mb-2">
            <Button variant="ghost" size="icon" onClick={onBack} className="md:hidden h-8 w-8">
              <ArrowLeft className="w-4 h-4" />
            </Button>

            <div className="flex-1 min-w-0">
              <h2 className="font-bebas text-xl text-foreground truncate">
                {getProjectName(proposal)}
              </h2>
            </div>

            <span className={`inline-flex items-center gap-1.5 text-[10px] font-medium px-2 py-0.5 rounded-full uppercase tracking-wide ${status.bg} ${status.text}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />
              {status.label}
            </span>
          </div>

          {/* Compact stats */}
          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <span>{proposal.confidence_score}% confidence</span>
            {proposal.price_min > 0 && (
              <span className="font-medium text-foreground">${proposal.price_min.toLocaleString()}&ndash;${proposal.price_max.toLocaleString()}</span>
            )}
            <span>{modules.length} module{modules.length !== 1 ? 's' : ''}</span>
            {proposal.email && <span className="text-blue-600 dark:text-blue-400">{proposal.email}</span>}
            {moduleNames.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {moduleNames.map((name) => (
                  <span key={name} className="inline-flex items-center text-[10px] font-medium px-1.5 py-px rounded bg-yellow-50 dark:bg-yellow-500/10 text-yellow-700 dark:text-yellow-400">
                    {name}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Tabs row */}
        <div className="flex items-center gap-0 px-4 md:px-6">
          {tabs.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setActiveTab(tab.value)}
              className={`relative px-4 py-2 text-sm font-medium transition-colors cursor-pointer ${
                activeTab === tab.value
                  ? 'text-foreground'
                  : 'text-muted-foreground hover:text-foreground/70'
              }`}
            >
              {tab.label}
              {activeTab === tab.value && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-yellow-500 dark:bg-yellow-400 rounded-full" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content — scrolls independently */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {activeTab === 'proposal' && (
          <div>
            <ProposalEditor proposal={proposal} onUpdate={onProposalUpdate} />
            {/* Budget section within Proposal tab */}
            <div className="border-t">
              <BudgetTab proposalId={proposal.id} proposalEmail={proposal.email} proposalSlug={proposal.slug} />
            </div>
          </div>
        )}
        {activeTab === 'chat' && (
          <ChatTab proposalId={proposal.id} />
        )}
      </div>
    </div>
  )
}
