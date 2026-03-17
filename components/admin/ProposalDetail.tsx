'use client'

import { ArrowLeft } from 'lucide-react'
import type { Database } from '@/lib/supabase/types'
import { MODULE_CATALOG } from '@/lib/modules/catalog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
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

function getProjectName(proposal: Proposal): string {
  const meta = proposal.metadata as Record<string, unknown> | null
  if (meta?.projectName && typeof meta.projectName === 'string') return meta.projectName
  return 'Untitled'
}

export default function ProposalDetail({ proposal, onBack, onProposalUpdate }: Props) {
  const modules = (proposal.modules ?? []) as string[]
  const moduleNames = modules
    .map((id) => MODULE_CATALOG.find((m) => m.id === id)?.name ?? id)

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 py-4 border-b space-y-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack} className="lg:hidden">
            <ArrowLeft className="w-5 h-5" />
          </Button>

          <div className="flex-1 min-w-0">
            <h2 className="font-bebas text-2xl text-foreground truncate">
              {getProjectName(proposal)}
            </h2>
          </div>

          {getStatusBadge(proposal.status)}
        </div>

        {/* Stats row */}
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span>Confidence: <strong className="text-foreground">{proposal.confidence_score}%</strong></span>
          {proposal.price_min > 0 && (
            <span>Range: <strong className="text-foreground">${proposal.price_min.toLocaleString()}&ndash;${proposal.price_max.toLocaleString()}</strong></span>
          )}
          <span>{modules.length} module{modules.length !== 1 ? 's' : ''}</span>
          {proposal.email && <span>{proposal.email}</span>}
        </div>

        {/* Module tags */}
        {moduleNames.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {moduleNames.map((name) => (
              <Badge key={name} variant="secondary" className="text-xs">
                {name}
              </Badge>
            ))}
          </div>
        )}
      </div>

      {/* Tabs */}
      <Tabs defaultValue="chat" className="flex flex-1 flex-col overflow-hidden">
        <TabsList className="mx-6">
          <TabsTrigger value="chat">Chat</TabsTrigger>
          <TabsTrigger value="proposal">Proposal</TabsTrigger>
          <TabsTrigger value="budget">Budget</TabsTrigger>
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
