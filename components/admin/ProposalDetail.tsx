'use client'

import { ArrowLeft } from 'lucide-react'
import type { Database } from '@/lib/supabase/types'
import { MODULE_CATALOG } from '@/lib/modules/catalog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
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
  const modules = (proposal.modules ?? []) as string[]
  const moduleNames = modules
    .map((id) => MODULE_CATALOG.find((m) => m.id === id)?.name ?? id)

  const status = getStatusStyle(proposal.status)

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-4 md:px-6 border-b space-y-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack} className="md:hidden">
            <ArrowLeft className="w-5 h-5" />
          </Button>

          <div className="flex-1 min-w-0">
            <h2 className="font-bebas text-2xl text-foreground truncate">
              {getProjectName(proposal)}
            </h2>
          </div>

          <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full uppercase tracking-wide ${status.bg} ${status.text}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />
            {status.label}
          </span>
        </div>

        {/* Stats row */}
        <div className="flex flex-wrap items-center gap-4 text-[13px] text-muted-foreground">
          <span>Confidence: <strong className="text-foreground">{proposal.confidence_score}%</strong></span>
          {proposal.price_min > 0 && (
            <span>Range: <strong className="text-foreground">${proposal.price_min.toLocaleString()}&ndash;${proposal.price_max.toLocaleString()}</strong></span>
          )}
          <span>{modules.length} module{modules.length !== 1 ? 's' : ''}</span>
          {proposal.email && <span className="text-blue-600 dark:text-blue-400">{proposal.email}</span>}
        </div>

        {/* Module tags */}
        {moduleNames.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {moduleNames.map((name) => (
              <span key={name} className="inline-flex items-center text-[11px] font-medium px-2 py-0.5 rounded-md bg-yellow-50 dark:bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border border-yellow-200 dark:border-yellow-500/20">
                {name}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Tabs */}
      <Tabs defaultValue="chat" className="flex flex-1 flex-col overflow-hidden">
        <TabsList className="mx-4 md:mx-6">
          <TabsTrigger value="chat" className="cursor-pointer">Chat</TabsTrigger>
          <TabsTrigger value="proposal" className="cursor-pointer">Proposal</TabsTrigger>
          <TabsTrigger value="budget" className="cursor-pointer">Budget</TabsTrigger>
        </TabsList>
        <TabsContent value="chat" className="flex-1 overflow-y-auto mt-0">
          <ChatTab proposalId={proposal.id} />
        </TabsContent>
        <TabsContent value="proposal" className="flex-1 overflow-y-auto mt-0">
          <ProposalEditor proposal={proposal} onUpdate={onProposalUpdate} />
        </TabsContent>
        <TabsContent value="budget" className="flex-1 overflow-y-auto mt-0">
          <BudgetTab proposalId={proposal.id} proposalEmail={proposal.email} proposalSlug={proposal.slug} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
