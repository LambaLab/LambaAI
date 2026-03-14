'use client'

import { useState } from 'react'
import ModuleCard from './ModuleCard'
import ConfidenceBar from './ConfidenceBar'
import AuthGateModal from './AuthGateModal'
import { MODULE_CATALOG } from '@/lib/modules/catalog'

type Props = {
  activeModules: string[]
  confidenceScore: number
  pricingVisible: boolean
  productOverview: string
  proposalId: string
  onToggle: (id: string) => void
  aiStarted: boolean
  theme?: 'dark' | 'light'
}

// Renders product overview text — supports labeled sections (e.g. "What it is: ...")
// and plain paragraphs separated by \n\n
function ProductOverview({ text }: { text: string }) {
  const paragraphs = text.split('\n\n').filter(Boolean)
  return (
    <div className="space-y-3 transition-all duration-500">
      {paragraphs.map((para, i) => {
        const labelMatch = para.match(/^([^:\n]{1,30}):\s+(.+)$/s)
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
  pricingVisible,
  productOverview,
  proposalId,
  onToggle,
  aiStarted,
  theme,
}: Props) {
  const [showAuthGate, setShowAuthGate] = useState(false)

  return (
    <div className="flex flex-col h-full">
      {/* 1. Product Overview */}
      <div className="px-4 pt-4 pb-3 border-b border-[var(--ov-border,rgba(255,255,255,0.05))] flex-shrink-0">
        <h2 className="font-bebas text-xs tracking-[0.15em] text-[var(--ov-text-muted,#727272)] mb-2">
          YOUR PRODUCT
        </h2>
        {productOverview ? (
          <ProductOverview text={productOverview} />
        ) : (
          <p className="text-sm text-[var(--ov-text-muted,#727272)]/50 leading-relaxed italic">
            Your product overview will appear here as we learn more...
          </p>
        )}
      </div>

      {/* 2. Estimate Accuracy */}
      <div className="px-4 py-3 border-b border-[var(--ov-border,rgba(255,255,255,0.05))] flex-shrink-0">
        <ConfidenceBar score={confidenceScore} />
      </div>

      {/* 3. Technical Modules */}
      <div className="px-4 py-3 border-b border-[var(--ov-border,rgba(255,255,255,0.05))] flex-shrink-0">
        <h2 className="font-bebas text-2xl text-[var(--ov-text,#ffffff)] tracking-wide">
          TECHNICAL MODULES
        </h2>
        <p className="text-xs text-[var(--ov-text-muted,#727272)] mt-0.5">
          {activeModules.length} selected · Toggle to customize
        </p>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2">
        {activeModules.length > 0 && activeModules.map((id) => (
          <ModuleCard
            key={id}
            moduleId={id}
            isActive={true}
            activeModules={activeModules}
            onToggle={onToggle}
            pricingVisible={pricingVisible}
          />
        ))}

        {activeModules.length > 0 && (
          <div className="py-2">
            <div className="h-px bg-[var(--ov-border,rgba(255,255,255,0.05))]" />
            <p className="text-xs text-[var(--ov-text-muted,#727272)] mt-2 mb-1">Add modules</p>
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
              pricingVisible={pricingVisible}
            />
          ))}
      </div>

      {/* 4. Full Proposal CTA — appears after first AI response */}
      {aiStarted && (
        <div className="px-4 pb-4 pt-2 flex-shrink-0 border-t border-[var(--ov-border,rgba(255,255,255,0.05))]">
          <button
            onClick={() => setShowAuthGate(true)}
            className="w-full py-3 bg-brand-yellow text-brand-dark font-medium rounded-xl hover:bg-brand-yellow/90 transition-all active:scale-[0.98] text-sm"
          >
            View Full Proposal →
          </button>
        </div>
      )}

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
