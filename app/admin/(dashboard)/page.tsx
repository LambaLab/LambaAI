'use client'

import { useState, useEffect, useCallback } from 'react'
import type { Database } from '@/lib/supabase/types'
import AdminHeader from '@/components/admin/AdminHeader'
import ProposalList from '@/components/admin/ProposalList'
import ProposalDetail from '@/components/admin/ProposalDetail'

type Proposal = Database['public']['Tables']['proposals']['Row']

export default function AdminDashboardPage() {
  const [proposals, setProposals] = useState<Proposal[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [adminRole, setAdminRole] = useState<'super_admin' | 'admin' | null>(null)

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

      // Fetch current user's admin role
      try {
        const res = await fetch('/api/admin/users')
        const result = await res.json()
        if (res.ok) setAdminRole(result.currentRole)
      } catch { /* ignore */ }

      setLoading(false)
    }

    loadData()

    // Poll for proposal changes every 5 seconds.
    // Supabase Realtime postgres_changes respects RLS, which blocks the
    // admin from receiving events for proposals they don't own. Polling
    // via the admin API (which uses the service client) works reliably.
    const pollInterval = setInterval(fetchProposals, 5000)

    return () => {
      clearInterval(pollInterval)
    }
  }, [fetchProposals])

  const selectedProposal = proposals.find((p) => p.id === selectedId) ?? null

  function handleProposalUpdate(updated: Proposal) {
    setProposals((prev) => prev.map((p) => (p.id === updated.id ? updated : p)))
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-brand-yellow/30 border-t-brand-yellow rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="h-screen flex flex-col">
      <AdminHeader searchQuery={searchQuery} onSearchChange={setSearchQuery} adminRole={adminRole} />

      <div className="flex-1 flex overflow-hidden">
        {/* List panel */}
        <div className={`border-r border-white/5 flex-shrink-0 transition-all ${
          selectedProposal ? 'hidden lg:flex lg:w-80 xl:w-96' : 'w-full'
        }`}>
          <div className="w-full h-full">
            <ProposalList
              proposals={proposals}
              selectedId={selectedId}
              onSelect={setSelectedId}
              searchQuery={searchQuery}
            />
          </div>
        </div>

        {/* Detail panel */}
        {selectedProposal ? (
          <div className="flex-1 min-w-0">
            <ProposalDetail
              key={selectedProposal.id}
              proposal={selectedProposal}
              onBack={() => setSelectedId(null)}
              onProposalUpdate={handleProposalUpdate}
            />
          </div>
        ) : (
          <div className="hidden lg:flex flex-1 items-center justify-center">
            <p className="text-sm text-brand-gray-mid">Select a proposal to view details</p>
          </div>
        )}
      </div>
    </div>
  )
}
