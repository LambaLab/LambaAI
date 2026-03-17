'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
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
  const supabaseRef = useRef(createClient())

  useEffect(() => {
    const supabase = supabaseRef.current

    async function loadData() {
      // Load proposals via admin API (bypasses RLS)
      try {
        const res = await fetch('/api/admin/proposals')
        if (res.ok) {
          const data = await res.json()
          setProposals(data)
        }
      } catch { /* ignore */ }

      // Fetch current user's admin role
      try {
        const res = await fetch('/api/admin/users')
        const result = await res.json()
        if (res.ok) setAdminRole(result.currentRole)
      } catch { /* ignore */ }

      setLoading(false)
    }

    loadData()

    // Subscribe to real-time proposal changes.
    // On any change, refetch the full list via the admin API (bypasses RLS).
    async function refetchProposals() {
      try {
        const res = await fetch('/api/admin/proposals')
        if (res.ok) {
          const data = await res.json()
          setProposals(data)
        }
      } catch { /* ignore */ }
    }

    const channel = supabase
      .channel('admin:proposals')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'proposals' },
        () => { refetchProposals() }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

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
