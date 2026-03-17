'use client'

import { useState, useEffect } from 'react'
import { ArrowLeft } from 'lucide-react'
import type { Database } from '@/lib/supabase/types'
import { MODULE_CATALOG } from '@/lib/modules/catalog'
import ProposalEditor from './ProposalEditor'
import ChatTab from './ChatTab'
import BudgetTab from './BudgetTab'

type Proposal = Database['public']['Tables']['proposals']['Row']

type Props = {
  proposal: Proposal
  onBack: () => void
  onProposalUpdate: (updated: Proposal) => void
}

type Tab = 'chat' | 'proposal' | 'budget'

const STATUS_STYLES: Record<string, string> = {
  draft: 'bg-white/5 text-brand-gray-mid',
  saved: 'bg-white/5 text-brand-gray-mid',
  pending_review: 'bg-brand-yellow/10 text-brand-yellow',
  approved: 'bg-brand-green/10 text-brand-green',
  accepted: 'bg-brand-green/10 text-brand-green',
  budget_proposed: 'bg-brand-blue/10 text-brand-blue',
  budget_accepted: 'bg-brand-green/10 text-brand-green',
}

function getProjectName(proposal: Proposal): string {
  const meta = proposal.metadata as Record<string, unknown> | null
  if (meta?.projectName && typeof meta.projectName === 'string') return meta.projectName
  return 'Untitled'
}

export default function ProposalDetail({ proposal, onBack, onProposalUpdate }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('chat')
  const modules = (proposal.modules ?? []) as string[]
  const moduleNames = modules
    .map((id) => MODULE_CATALOG.find((m) => m.id === id)?.name ?? id)

  const tabs: { key: Tab; label: string }[] = [
    { key: 'chat', label: 'Chat' },
    { key: 'proposal', label: 'Proposal' },
    { key: 'budget', label: 'Budget' },
  ]

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 py-4 border-b border-white/5 space-y-3">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="lg:hidden p-1 rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-5 h-5 text-brand-gray-mid" />
          </button>

          <div className="flex-1 min-w-0">
            <h2 className="font-bebas text-2xl text-brand-white truncate">
              {getProjectName(proposal)}
            </h2>
          </div>

          <span className={`text-[10px] px-2.5 py-1 rounded-full uppercase tracking-wider ${STATUS_STYLES[proposal.status] ?? STATUS_STYLES.draft}`}>
            {proposal.status.replace(/_/g, ' ')}
          </span>
        </div>

        {/* Stats row */}
        <div className="flex items-center gap-4 text-xs text-brand-gray-mid">
          <span>Confidence: <strong className="text-brand-white">{proposal.confidence_score}%</strong></span>
          {proposal.price_min > 0 && (
            <span>Range: <strong className="text-brand-white">${proposal.price_min.toLocaleString()}&ndash;${proposal.price_max.toLocaleString()}</strong></span>
          )}
          <span>{modules.length} module{modules.length !== 1 ? 's' : ''}</span>
          {proposal.email && <span>{proposal.email}</span>}
        </div>

        {/* Module tags */}
        {moduleNames.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {moduleNames.map((name) => (
              <span key={name} className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-brand-gray-mid">
                {name}
              </span>
            ))}
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 -mb-3">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2 text-sm rounded-t-lg transition-colors cursor-pointer ${
                activeTab === tab.key
                  ? 'bg-white/5 text-brand-white border-b-2 border-brand-yellow'
                  : 'text-brand-gray-mid hover:text-brand-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'chat' && <ChatTab proposalId={proposal.id} />}
        {activeTab === 'proposal' && (
          <ProposalEditor proposal={proposal} onUpdate={onProposalUpdate} />
        )}
        {activeTab === 'budget' && (
          <BudgetTab proposalId={proposal.id} proposalEmail={proposal.email} proposalSlug={proposal.slug} />
        )}
      </div>
    </div>
  )
}
