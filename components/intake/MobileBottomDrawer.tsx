'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { ChevronUp } from 'lucide-react'
import ModulesPanel from './ModulesPanel'

type Props = {
  summary: string
  activeModules: string[]
  confidenceScore: number
  productOverview: string
  proposalId: string
  aiStarted: boolean
  onToggle: (id: string) => void
  moduleSummaries?: { [id: string]: string }
  onReset?: () => void
  onSaveLater?: () => void
}

export default function MobileBottomDrawer({
  summary,
  activeModules,
  confidenceScore,
  productOverview,
  proposalId,
  aiStarted,
  onToggle,
  moduleSummaries = {},
  onReset,
  onSaveLater,
}: Props) {
  const [open, setOpen] = useState(false)

  // Swipe-to-open/close gesture handling
  const touchStartY = useRef<number | null>(null)
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY
  }, [])
  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (touchStartY.current === null) return
    const deltaY = e.changedTouches[0].clientY - touchStartY.current
    if (!open && deltaY < -40) setOpen(true)    // swipe up to open
    if (open && deltaY > 40) setOpen(false)     // swipe down to close
    touchStartY.current = null
  }, [open])

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 bg-black/50 z-10"
          onClick={() => setOpen(false)}
        />
      )}

      <div
        className={`relative z-20 bg-[var(--ov-surface,#1d1d1d)] border-t border-[var(--ov-border,rgba(255,255,255,0.10))] transition-all duration-300 rounded-t-2xl ${
          open ? 'h-[70vh]' : 'h-auto'
        }`}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {/* Swipe bar indicator */}
        <div className="flex justify-center pt-2 pb-0.5">
          <div className="w-9 h-1 rounded-full bg-[var(--ov-text-muted,#727272)]/40" />
        </div>

        <button
          onClick={() => setOpen(!open)}
          className="w-full flex items-center justify-between px-4 h-10 text-sm"
          aria-label={open ? 'Close modules panel' : 'Open modules panel'}
        >
          <span className="text-[var(--ov-text,#ffffff)] font-medium">{summary}</span>
          <ChevronUp
            className={`w-4 h-4 text-[var(--ov-text,#ffffff)] transition-transform duration-200 ${
              open ? 'rotate-180' : ''
            }`}
          />
        </button>

        {open && (
          <div className="h-[calc(70vh-3.5rem)] overflow-hidden">
            <ModulesPanel
              activeModules={activeModules}
              confidenceScore={confidenceScore}
              productOverview={productOverview}
              proposalId={proposalId}
              aiStarted={aiStarted}
              onToggle={onToggle}
              moduleSummaries={moduleSummaries}
              onReset={onReset}
              onSaveLater={onSaveLater}
            />
          </div>
        )}
      </div>
    </>
  )
}
