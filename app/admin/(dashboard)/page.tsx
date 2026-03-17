'use client'

import { useState, useEffect, useCallback } from 'react'
import { Search } from 'lucide-react'
import type { Database } from '@/lib/supabase/types'
import { Input } from '@/components/ui/input'
import ProposalList from '@/components/admin/ProposalList'
import ProposalDetail from '@/components/admin/ProposalDetail'

type Proposal = Database['public']['Tables']['proposals']['Row']

export default function AdminDashboardPage() {
  const [proposals, setProposals] = useState<Proposal[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')

  const fetchProposals = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/proposals')
      if (res.ok) {
        const data = await res.json()
        setProposals(data)
      }
    } catch { /* ignore */ }
  }, [])

  useEffect(() => {
    async function loadData() {
      await fetchProposals()
      setLoading(false)
    }
    loadData()
    const pollInterval = setInterval(fetchProposals, 5000)
    return () => clearInterval(pollInterval)
  }, [fetchProposals])

  const selectedProposal = proposals.find((p) => p.id === selectedId) ?? null

  function handleProposalUpdate(updated: Proposal) {
    setProposals((prev) => prev.map((p) => (p.id === updated.id ? updated : p)))
  }

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
      </div>
    )
  }

  return (
    <>
      {/* Desktop: flex split */}
      <div className="hidden md:flex flex-1 overflow-hidden">
        {/* Left panel — proposal list */}
        <div className="w-[380px] min-w-[320px] max-w-[480px] flex flex-col h-full border-r">
          <div className="p-3 border-b">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search proposals..."
                className="pl-9"
              />
            </div>
          </div>
          <ProposalList
            proposals={proposals}
            selectedId={selectedId}
            onSelect={setSelectedId}
            searchQuery={searchQuery}
          />
        </div>

        {/* Right panel — detail */}
        <div className="flex-1 min-w-0 h-full overflow-hidden">
          {selectedProposal ? (
            <ProposalDetail
              key={selectedProposal.id}
              proposal={selectedProposal}
              onBack={() => setSelectedId(null)}
              onProposalUpdate={handleProposalUpdate}
            />
          ) : (
            <div className="flex h-full items-center justify-center">
              <p className="text-sm text-muted-foreground">Select a proposal to view details</p>
            </div>
          )}
        </div>
      </div>

      {/* Mobile: list or detail */}
      <div className="flex md:hidden flex-1 flex-col overflow-hidden">
        {selectedProposal ? (
          <ProposalDetail
            key={selectedProposal.id}
            proposal={selectedProposal}
            onBack={() => setSelectedId(null)}
            onProposalUpdate={handleProposalUpdate}
          />
        ) : (
          <div className="flex flex-col h-full">
            <div className="p-3 border-b">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search proposals..."
                  className="pl-9"
                />
              </div>
            </div>
            <ProposalList
              proposals={proposals}
              selectedId={selectedId}
              onSelect={setSelectedId}
              searchQuery={searchQuery}
            />
          </div>
        )}
      </div>
    </>
  )
}
