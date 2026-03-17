'use client'

import { Suspense, useState, useEffect, useCallback, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Search, RefreshCw } from 'lucide-react'
import type { Database } from '@/lib/supabase/types'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import ProposalList from '@/components/admin/ProposalList'
import ProposalDetail from '@/components/admin/ProposalDetail'

type Proposal = Database['public']['Tables']['proposals']['Row']
type StatusFilter = 'all' | Proposal['status']
type SortKey = 'newest' | 'oldest' | 'confidence' | 'price'
type ProposalType = 'build' | 'grow' | 'fund'

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'All statuses' },
  { value: 'draft', label: 'Draft' },
  { value: 'pending_review', label: 'Pending review' },
  { value: 'approved', label: 'Approved' },
  { value: 'budget_proposed', label: 'Budget proposed' },
  { value: 'accepted', label: 'Accepted' },
  { value: 'budget_accepted', label: 'Budget accepted' },
]

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'newest', label: 'Newest' },
  { value: 'oldest', label: 'Oldest' },
  { value: 'confidence', label: 'Confidence' },
  { value: 'price', label: 'Price' },
]

const TYPE_TABS: { value: ProposalType; label: string; count?: boolean }[] = [
  { value: 'build', label: 'Build', count: true },
  { value: 'grow', label: 'Grow' },
  { value: 'fund', label: 'Fund' },
]

export default function AdminDashboardPage() {
  return (
    <Suspense fallback={
      <div className="flex flex-1 items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
      </div>
    }>
      <AdminDashboardContent />
    </Suspense>
  )
}

function AdminDashboardContent() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [proposals, setProposals] = useState<Proposal[]>([])
  // Read initial selectedId from URL query param
  const [selectedId, setSelectedId] = useState<string | null>(searchParams.get('id'))
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [sortKey, setSortKey] = useState<SortKey>('newest')
  const [activeTab, setActiveTab] = useState<ProposalType>('build')
  const [refreshing, setRefreshing] = useState(false)

  // Sync selectedId from URL when browser back/forward changes searchParams
  useEffect(() => {
    const urlId = searchParams.get('id')
    setSelectedId(urlId)
  }, [searchParams])

  // Draggable divider state
  const [listWidthPx, setListWidthPx] = useState(380)
  const isDragging = useRef(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Sync URL when selectedId changes — push so browser back works
  const handleSelect = useCallback((id: string) => {
    setSelectedId(id)
    router.push(`/admin?id=${id}`, { scroll: false })
  }, [router])

  const handleDeselect = useCallback(() => {
    setSelectedId(null)
    router.back()
  }, [router])

  const handleDividerMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    isDragging.current = true
    document.body.style.userSelect = 'none'
    document.body.style.cursor = 'col-resize'

    function onMouseMove(ev: MouseEvent) {
      if (!isDragging.current || !containerRef.current) return
      const rect = containerRef.current.getBoundingClientRect()
      const x = ev.clientX - rect.left
      setListWidthPx(Math.min(600, Math.max(280, x)))
    }

    function onMouseUp() {
      isDragging.current = false
      document.body.style.userSelect = ''
      document.body.style.cursor = ''
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
    }

    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
  }, [])

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

  const handleRefresh = useCallback(async () => {
    setRefreshing(true)
    await fetchProposals()
    setRefreshing(false)
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
      {/* ─── Desktop layout ─── */}
      <div className="hidden md:flex flex-col flex-1 min-h-0 overflow-hidden">
        {/* Sticky toolbar: search + filters + tabs — never scrolls */}
        <div className="shrink-0 z-40 bg-background border-b">
          <div className="flex items-center gap-3 px-4 lg:px-6 py-2.5">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search proposals..."
                className="pl-9 h-9 bg-muted/50"
              />
            </div>

            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
              <SelectTrigger className="w-[150px] h-9 text-xs">
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value} className="text-xs">
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={sortKey} onValueChange={(v) => setSortKey(v as SortKey)}>
              <SelectTrigger className="w-[120px] h-9 text-xs">
                <SelectValue placeholder="Newest" />
              </SelectTrigger>
              <SelectContent>
                {SORT_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value} className="text-xs">
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 shrink-0"
              onClick={handleRefresh}
              disabled={refreshing}
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            </Button>
          </div>

          {/* Proposal type tabs */}
          <div className="flex items-center gap-0 px-4 lg:px-6">
            {TYPE_TABS.map((tab) => (
              <button
                key={tab.value}
                onClick={() => setActiveTab(tab.value)}
                className={`relative px-4 py-2 text-sm font-medium transition-colors cursor-pointer ${
                  activeTab === tab.value
                    ? 'text-foreground'
                    : 'text-muted-foreground hover:text-foreground/70'
                }`}
              >
                <span className="flex items-center gap-2">
                  {tab.label}
                  {tab.count && proposals.length > 0 && (
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                      activeTab === tab.value
                        ? 'bg-yellow-400/15 text-yellow-600 dark:text-yellow-400'
                        : 'bg-muted text-muted-foreground'
                    }`}>
                      {proposals.length}
                    </span>
                  )}
                </span>
                {activeTab === tab.value && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-yellow-500 dark:bg-yellow-400 rounded-full" />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Content: list + divider + detail — fills remaining height, each panel scrolls independently */}
        <div ref={containerRef} className="flex flex-1 min-h-0">
          {/* Left panel — proposal list */}
          <div
            className="flex flex-col min-h-0 shrink-0"
            style={{ width: selectedProposal ? `${listWidthPx}px` : '100%' }}
          >
            <div className="flex-1 min-h-0 overflow-y-auto">
              <ProposalList
                proposals={proposals}
                selectedId={selectedId}
                onSelect={handleSelect}
                searchQuery={searchQuery}
                statusFilter={statusFilter}
                sortKey={sortKey}
              />
            </div>
          </div>

          {/* Draggable divider */}
          {selectedProposal && (
            <div
              className="w-1 shrink-0 cursor-col-resize relative bg-border hover:bg-yellow-400/50 active:bg-yellow-400/70 transition-colors group"
              onMouseDown={handleDividerMouseDown}
            >
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1 h-6 rounded-full bg-muted-foreground/20 group-hover:bg-yellow-500/60 transition-colors pointer-events-none" />
            </div>
          )}

          {/* Right panel — detail */}
          {selectedProposal && (
            <div className="flex-1 min-w-0 min-h-0 flex flex-col">
              <ProposalDetail
                key={selectedProposal.id}
                proposal={selectedProposal}
                onBack={handleDeselect}
                onProposalUpdate={handleProposalUpdate}
              />
            </div>
          )}
        </div>
      </div>

      {/* ─── Mobile detail overlay — covers shell header ─── */}
      {selectedProposal && (
        <div className="fixed inset-0 z-40 bg-background flex flex-col md:hidden">
          <ProposalDetail
            key={selectedProposal.id}
            proposal={selectedProposal}
            onBack={handleDeselect}
            onProposalUpdate={handleProposalUpdate}
            isMobileFullscreen
          />
        </div>
      )}

      {/* ─── Mobile list layout ─── */}
      <div className="flex md:hidden flex-1 flex-col overflow-hidden">
        <div className="flex flex-col h-full overflow-hidden">
          {/* Mobile search + filters */}
          <div className="shrink-0 px-4 pt-3 pb-0 border-b space-y-2.5">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search proposals..."
                className="pl-9 h-10 text-base"
              />
            </div>
            <div className="flex gap-2">
              <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
                <SelectTrigger className="flex-1 h-9 text-sm">
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value} className="text-sm">
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={sortKey} onValueChange={(v) => setSortKey(v as SortKey)}>
                <SelectTrigger className="w-[110px] h-9 text-sm">
                  <SelectValue placeholder="Newest" />
                </SelectTrigger>
                <SelectContent>
                  {SORT_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value} className="text-sm">
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {/* Equal-width type tabs */}
            <div className="flex">
              {TYPE_TABS.map((tab) => (
                <button
                  key={tab.value}
                  onClick={() => setActiveTab(tab.value)}
                  className={`relative flex-1 py-2.5 text-sm font-medium text-center transition-colors cursor-pointer ${
                    activeTab === tab.value
                      ? 'text-foreground'
                      : 'text-muted-foreground'
                  }`}
                >
                  {tab.label}
                  {activeTab === tab.value && (
                    <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-yellow-500 dark:bg-yellow-400" />
                  )}
                </button>
              ))}
            </div>
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto">
            <ProposalList
              proposals={proposals}
              selectedId={selectedId}
              onSelect={handleSelect}
              searchQuery={searchQuery}
              statusFilter={statusFilter}
              sortKey={sortKey}
            />
          </div>
        </div>
      </div>
    </>
  )
}
