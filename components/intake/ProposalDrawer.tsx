'use client'

import { useEffect, useRef, useState } from 'react'
import { X, Plus, Loader2, MoreHorizontal, Trash2 } from 'lucide-react'

export type ProposalSummary = {
  id: string
  projectName: string
  confidenceScore: number
  savedAt: string | null
}

type Props = {
  open: boolean
  onClose: () => void
  emailVerified: boolean
  currentProposalId: string
  currentAppName: string
  currentConfidence: number
  proposals: ProposalSummary[]
  loading: boolean
  onSwitchProposal: (id: string) => void
  onNewProposal: () => void
  onDeleteProposal: (id: string) => void
  onSaveEmail: () => void
  theme: 'dark' | 'light'
}

function relativeDate(iso: string | null): string {
  if (!iso) return ''
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 30) return `${days}d ago`
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

export default function ProposalDrawer({
  open,
  onClose,
  emailVerified,
  currentProposalId,
  currentAppName,
  currentConfidence,
  proposals,
  loading,
  onSwitchProposal,
  onNewProposal,
  onDeleteProposal,
  onSaveEmail,
  theme,
}: Props) {
  const drawerRef = useRef<HTMLDivElement>(null)
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null)

  // Close on Escape
  useEffect(() => {
    if (!open) return
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [open, onClose])

  // Prevent body scroll when open on mobile
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [open])

  // Close overflow menu on outside click
  useEffect(() => {
    if (!menuOpenId) return
    function handleClick() { setMenuOpenId(null) }
    window.addEventListener('click', handleClick)
    return () => window.removeEventListener('click', handleClick)
  }, [menuOpenId])

  // Close menu when drawer closes
  useEffect(() => { if (!open) setMenuOpenId(null) }, [open])

  const isLight = theme === 'light'

  return (
    <>
      {/* Backdrop — mobile only */}
      <div
        className={`fixed inset-0 z-[55] bg-black/50 md:bg-black/20 transition-opacity duration-300 ${open ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
        aria-hidden
      />

      {/* Drawer panel */}
      <div
        ref={drawerRef}
        className={`fixed top-0 left-0 h-full z-[56] flex flex-col transition-transform duration-300 ease-in-out
          w-[80%] max-w-[320px] md:w-[320px]
          ${isLight ? 'bg-[#F5F4F0] border-r border-[rgba(0,0,0,0.08)]' : 'bg-[#1a1a1a] border-r border-white/5'}
          ${open ? 'translate-x-0' : '-translate-x-full'}`}
        role="dialog"
        aria-label="Proposals"
      >
        {/* Header */}
        <div className={`flex items-center justify-between px-4 py-3 border-b flex-shrink-0 ${isLight ? 'border-[rgba(0,0,0,0.08)]' : 'border-white/5'}`}>
          <span className={`text-sm font-medium ${isLight ? 'text-[#1a1a1a]' : 'text-white'}`}>
            Your Proposals
          </span>
          <button
            onClick={onClose}
            className={`w-7 h-7 rounded-md flex items-center justify-center transition-colors cursor-pointer
              ${isLight ? 'hover:bg-black/5 text-[#727272]' : 'hover:bg-white/10 text-[#727272] hover:text-white'}`}
            aria-label="Close drawer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {!emailVerified ? (
            /* ── Unverified state ── */
            <div className="p-4 space-y-4">
              {/* Current proposal card */}
              <div className={`rounded-lg p-3 ${isLight ? 'bg-white border border-[rgba(0,0,0,0.06)]' : 'bg-white/5 border border-white/5'}`}>
                <p className={`text-sm font-medium truncate ${isLight ? 'text-[#1a1a1a]' : 'text-white'}`}>
                  {currentAppName || 'Untitled Proposal'}
                </p>
                <div className="flex items-center gap-2 mt-1.5">
                  <div className={`flex-1 h-1.5 rounded-full overflow-hidden ${isLight ? 'bg-black/5' : 'bg-white/10'}`}>
                    <div
                      className="h-full bg-brand-yellow rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(currentConfidence, 100)}%` }}
                    />
                  </div>
                  <span className={`text-xs tabular-nums ${isLight ? 'text-[#727272]' : 'text-[#727272]'}`}>
                    {currentConfidence}%
                  </span>
                </div>
              </div>

              {/* CTA to save email */}
              <div className={`rounded-lg p-4 text-center ${isLight ? 'bg-[rgba(0,0,0,0.03)] border border-[rgba(0,0,0,0.08)]' : 'bg-brand-yellow/5 border border-brand-yellow/10'}`}>
                <p className={`text-xs mb-3 ${isLight ? 'text-[#1a1a1a]/70' : 'text-white/60'}`}>
                  Save your email to unlock all your proposals and pick up where you left off on any device.
                </p>
                <button
                  onClick={onSaveEmail}
                  className={`w-full py-2 px-3 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                    isLight
                      ? 'bg-[#1A1A1A] text-white hover:bg-[#333]'
                      : 'bg-brand-yellow text-brand-dark hover:bg-brand-yellow/90'
                  }`}
                >
                  Save & unlock proposals
                </button>
              </div>
            </div>
          ) : (
            /* ── Verified state — proposal list ── */
            <div className="p-2">
              <button
                onClick={onNewProposal}
                className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm transition-colors cursor-pointer mb-1
                  ${isLight ? 'text-[#727272] hover:bg-black/[0.03] hover:text-[#1a1a1a]' : 'text-[#888] hover:bg-white/5 hover:text-white'}`}
              >
                <Plus className="w-3.5 h-3.5" />
                New Proposal
              </button>
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className={`w-5 h-5 animate-spin ${isLight ? 'text-[#727272]' : 'text-[#727272]'}`} />
                </div>
              ) : proposals.length === 0 ? (
                <div className={`text-center py-8 text-sm ${isLight ? 'text-[#727272]' : 'text-[#727272]'}`}>
                  No proposals yet
                </div>
              ) : (
                <ul className="space-y-1">
                  {proposals.map((p) => {
                    const isActive = p.id === currentProposalId
                    return (
                      <li key={p.id} className="relative group">
                        <button
                          onClick={() => {
                            if (!isActive) onSwitchProposal(p.id)
                          }}
                          disabled={isActive}
                          className={`w-full text-left rounded-lg px-3 py-2.5 transition-colors cursor-pointer
                            ${isActive
                              ? isLight
                                ? 'bg-[rgba(0,0,0,0.04)] border-l-2 border-[#1A1A1A]'
                                : 'bg-brand-yellow/10 border-l-2 border-brand-yellow'
                              : isLight
                                ? 'hover:bg-black/[0.03] border-l-2 border-transparent'
                                : 'hover:bg-white/5 border-l-2 border-transparent'
                            }`}
                        >
                          <p className={`text-sm font-medium truncate pr-6 ${isLight ? 'text-[#1a1a1a]' : 'text-white'}`}>
                            {p.projectName || 'Untitled Proposal'}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <div className={`flex-1 h-1 rounded-full overflow-hidden ${isLight ? 'bg-black/5' : 'bg-white/10'}`}>
                              <div
                                className="h-full bg-brand-yellow rounded-full transition-all"
                                style={{ width: `${Math.min(p.confidenceScore, 100)}%` }}
                              />
                            </div>
                            <span className={`text-[11px] tabular-nums ${isLight ? 'text-[#999]' : 'text-[#666]'}`}>
                              {p.confidenceScore}%
                            </span>
                            {p.savedAt && (
                              <span className={`text-[11px] ${isLight ? 'text-[#999]' : 'text-[#555]'}`}>
                                · {relativeDate(p.savedAt)}
                              </span>
                            )}
                          </div>
                        </button>
                        {!isActive && (
                          <div className="absolute right-2 top-2.5" onClick={(e) => e.stopPropagation()}>
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                setMenuOpenId(menuOpenId === p.id ? null : p.id)
                              }}
                              className={`w-6 h-6 rounded flex items-center justify-center transition-opacity
                                ${menuOpenId === p.id ? 'opacity-100' : 'opacity-40 md:opacity-0 md:group-hover:opacity-100'}
                                ${isLight ? 'hover:bg-black/5 text-[#999]' : 'hover:bg-white/10 text-[#666]'}`}
                              aria-label="More options"
                            >
                              <MoreHorizontal className="w-3.5 h-3.5" />
                            </button>
                            {menuOpenId === p.id && (
                              <div className={`absolute right-0 top-7 z-10 rounded-lg shadow-lg py-1 min-w-[120px]
                                ${isLight ? 'bg-white border border-[rgba(0,0,0,0.08)]' : 'bg-[#2a2a2a] border border-white/10'}`}>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    onDeleteProposal(p.id)
                                    setMenuOpenId(null)
                                  }}
                                  className={`w-full text-left px-3 py-1.5 text-sm flex items-center gap-2 transition-colors cursor-pointer
                                    ${isLight ? 'text-red-600 hover:bg-red-50' : 'text-red-400 hover:bg-white/5'}`}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                  Delete
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          )}
        </div>

      </div>
    </>
  )
}
