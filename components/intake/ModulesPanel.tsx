'use client'

import { useState, useRef, useEffect } from 'react'
import { ChevronDown } from 'lucide-react'
import ModuleCard from './ModuleCard'
import ConfidenceBar from './ConfidenceBar'
import AuthGateModal from './AuthGateModal'
import { MODULE_CATALOG } from '@/lib/modules/catalog'

type Props = {
  activeModules: string[]
  confidenceScore: number
  productOverview: string
  proposalId: string
  onToggle: (id: string) => void
  aiStarted: boolean
  theme?: 'dark' | 'light'
  moduleSummaries?: { [id: string]: string }
  onReset?: () => void
  onSaveLater?: () => void
}

// Renders product overview text — supports labeled sections and plain paragraphs
function ProductOverview({ text }: { text: string }) {
  const paragraphs = text.split('\n\n').filter(Boolean)
  return (
    <div className="space-y-3">
      {paragraphs.map((para, i) => {
        const labelMatch = para.match(/^([^:\n]{1,30}):\s+([\s\S]+)$/)
        if (labelMatch) {
          return (
            <div key={i}>
              <p className="text-[10px] font-semibold text-[var(--ov-text-muted,#727272)] uppercase tracking-widest mb-1">
                {labelMatch[1]}
              </p>
              <p className="text-sm text-[var(--ov-text,#ffffff)] leading-relaxed">
                {labelMatch[2]}
              </p>
            </div>
          )
        }
        return (
          <p key={i} className="text-sm text-[var(--ov-text,#ffffff)] leading-relaxed">
            {para}
          </p>
        )
      })}
    </div>
  )
}

export default function ModulesPanel({
  activeModules,
  confidenceScore,
  productOverview,
  proposalId,
  onToggle,
  aiStarted,
  theme,
  moduleSummaries = {},
  onReset,
  onSaveLater,
}: Props) {
  const [showAuthGate, setShowAuthGate] = useState(false)
  const [productOpen, setProductOpen] = useState(true)
  const [modulesOpen, setModulesOpen] = useState(true)
  const [resetConfirm, setResetConfirm] = useState(false)
  const resetConfirmTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (resetConfirmTimerRef.current) clearTimeout(resetConfirmTimerRef.current)
    }
  }, [])

  function handleResetClick() {
    if (!resetConfirm) {
      setResetConfirm(true)
      resetConfirmTimerRef.current = setTimeout(() => setResetConfirm(false), 3000)
    }
  }

  function handleResetConfirm() {
    if (resetConfirmTimerRef.current) clearTimeout(resetConfirmTimerRef.current)
    setResetConfirm(false)
    onReset?.()
  }

  function handleResetCancel() {
    if (resetConfirmTimerRef.current) clearTimeout(resetConfirmTimerRef.current)
    setResetConfirm(false)
  }

  return (
    <div className="flex flex-col h-full">

      {/* 1. Estimate Accuracy — always visible at top */}
      <div className="px-4 py-3 border-b border-[var(--ov-border,rgba(255,255,255,0.05))] flex-shrink-0">
        <ConfidenceBar score={confidenceScore} />
      </div>

      {/* Scrollable middle */}
      <div className="flex-1 overflow-y-auto scrollbar-hide">

        {/* 2. Product Overview accordion */}
        <div className="border-b border-[var(--ov-border,rgba(255,255,255,0.05))]">
          <button
            type="button"
            onClick={() => setProductOpen(o => !o)}
            className="w-full flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-white/[0.02] transition-colors"
          >
            <h2 className="font-bebas text-xs tracking-[0.15em] text-[var(--ov-text-muted,#727272)]">
              PRODUCT OVERVIEW
            </h2>
            <ChevronDown
              className={`w-4 h-4 text-[var(--ov-text-muted,#727272)] transition-transform duration-200 ${
                productOpen ? 'rotate-180' : ''
              }`}
            />
          </button>
          <div
            className="grid transition-[grid-template-rows] duration-300 ease-in-out"
            style={{ gridTemplateRows: productOpen ? '1fr' : '0fr' }}
          >
            <div className="overflow-hidden">
              <div className="px-4 pb-4">
                {productOverview ? (
                  <ProductOverview text={productOverview} />
                ) : (
                  <p className="text-sm text-[var(--ov-text-muted,#727272)]/50 leading-relaxed italic">
                    Your product overview will appear here as we learn more...
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* 3. Technical Modules accordion */}
        <div>
          <button
            type="button"
            onClick={() => setModulesOpen(o => !o)}
            className="w-full flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-white/[0.02] transition-colors"
          >
            <div className="flex items-center gap-2">
              <h2 className="font-bebas text-xs tracking-[0.15em] text-[var(--ov-text-muted,#727272)]">
                TECHNICAL MODULES
              </h2>
              {activeModules.length > 0 && (
                <span className="text-[10px] bg-brand-yellow/15 text-brand-yellow px-1.5 py-0.5 rounded-full font-medium">
                  {activeModules.length}
                </span>
              )}
            </div>
            <ChevronDown
              className={`w-4 h-4 text-[var(--ov-text-muted,#727272)] transition-transform duration-200 ${
                modulesOpen ? 'rotate-180' : ''
              }`}
            />
          </button>
          <div
            className="grid transition-[grid-template-rows] duration-300 ease-in-out"
            style={{ gridTemplateRows: modulesOpen ? '1fr' : '0fr' }}
          >
            <div className="overflow-hidden">
              <div className="px-4 pb-4 space-y-2">
                {activeModules.map((id) => (
                  <ModuleCard
                    key={id}
                    moduleId={id}
                    isActive={true}
                    activeModules={activeModules}
                    onToggle={onToggle}
                    summary={moduleSummaries[id]}
                  />
                ))}

                {activeModules.length > 0 && (
                  <div className="py-2">
                    <div className="h-px bg-[var(--ov-border,rgba(255,255,255,0.05))]" />
                    <p className="text-xs text-[var(--ov-text-muted,#727272)] mt-2 mb-1">
                      Add modules
                    </p>
                  </div>
                )}

                {MODULE_CATALOG
                  .filter((m) => !activeModules.includes(m.id))
                  .map((m) => (
                    <ModuleCard
                      key={m.id}
                      moduleId={m.id}
                      isActive={false}
                      activeModules={activeModules}
                      onToggle={onToggle}
                    />
                  ))}
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* 4. Bottom action bar */}
      <div className="flex-shrink-0 border-t border-[var(--ov-border,rgba(255,255,255,0.05))] px-4 py-4 space-y-2">

        {/* Save proposal for Later — hidden when email is already verified */}
        {!localStorage.getItem(`lamba_email_verified_${proposalId}`) && (
          <button
            type="button"
            onClick={onSaveLater}
            className="w-full py-2.5 rounded-xl border border-[var(--ov-border,rgba(255,255,255,0.10))] text-[var(--ov-text,#ffffff)] text-sm font-medium hover:bg-white/[0.03] transition-colors cursor-pointer"
          >
            Save proposal for Later
          </button>
        )}

        {/* Submit Proposal — replaces "View Full Proposal", shown once AI has started */}
        {aiStarted && (
          <button
            type="button"
            onClick={() => setShowAuthGate(true)}
            className="w-full py-2.5 bg-brand-yellow text-brand-dark font-medium rounded-xl hover:bg-brand-yellow/90 transition-all active:scale-[0.98] text-sm cursor-pointer"
          >
            Submit Proposal →
          </button>
        )}

        {/* Reset — two-step confirm */}
        <div className="flex items-center justify-center pt-1">
          {resetConfirm ? (
            <div className="flex items-center gap-3">
              <span className="text-xs text-[var(--ov-text-muted,#727272)]">Start over?</span>
              <button
                type="button"
                onClick={handleResetConfirm}
                className="text-xs text-red-400 hover:text-red-300 transition-colors px-2 py-1 rounded-lg hover:bg-white/5 cursor-pointer"
              >
                Yes
              </button>
              <button
                type="button"
                onClick={handleResetCancel}
                className="text-xs text-[var(--ov-text-muted,#727272)] hover:text-[var(--ov-text,#ffffff)] transition-colors px-2 py-1 rounded-lg hover:bg-white/5 cursor-pointer"
              >
                No
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleResetClick}
              className="text-xs text-[var(--ov-text-muted,#727272)] hover:text-[var(--ov-text,#ffffff)] transition-colors px-2 py-1 rounded-lg hover:bg-white/5 cursor-pointer"
            >
              ↺ Reset
            </button>
          )}
        </div>

      </div>

      {showAuthGate && (
        <AuthGateModal
          proposalId={proposalId}
          onClose={() => setShowAuthGate(false)}
          theme={theme}
        />
      )}

    </div>
  )
}
