'use client'

import { useState } from 'react'
import { ChevronUp, ChevronDown } from 'lucide-react'
import ModulesPanel from './ModulesPanel'

type Props = {
  summary: string
  activeModules: string[]
  confidenceScore: number
  pricingVisible: boolean
  productOverview: string
  proposalId: string
  aiStarted: boolean
  onToggle: (id: string) => void
  moduleSummaries?: { [id: string]: string }
}

export default function MobileBottomDrawer({
  summary,
  activeModules,
  confidenceScore,
  pricingVisible,
  productOverview,
  proposalId,
  aiStarted,
  onToggle,
  moduleSummaries = {},
}: Props) {
  const [open, setOpen] = useState(false)

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 bg-black/50 z-10"
          onClick={() => setOpen(false)}
        />
      )}

      <div
        className={`relative z-20 bg-brand-dark border-t border-white/10 transition-all duration-300 ${
          open ? 'h-[70vh]' : 'h-12'
        }`}
      >
        <button
          onClick={() => setOpen(!open)}
          className="w-full flex items-center justify-between px-4 h-12 text-sm"
          aria-label={open ? 'Close modules panel' : 'Open modules panel'}
        >
          <span className="text-brand-gray-mid">{summary}</span>
          {open ? (
            <ChevronUp className="w-4 h-4 text-brand-gray-mid" />
          ) : (
            <ChevronDown className="w-4 h-4 text-brand-gray-mid" />
          )}
        </button>

        {open && (
          <div className="h-[calc(70vh-3rem)] overflow-hidden">
            <ModulesPanel
              activeModules={activeModules}
              confidenceScore={confidenceScore}
              pricingVisible={pricingVisible}
              productOverview={productOverview}
              proposalId={proposalId}
              aiStarted={aiStarted}
              onToggle={onToggle}
              moduleSummaries={moduleSummaries}
            />
          </div>
        )}
      </div>
    </>
  )
}
