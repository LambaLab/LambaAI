'use client'

import React, { useEffect, useRef } from 'react'
import ChatPanel from './ChatPanel'
import ModulesPanel from './ModulesPanel'
import MobileBottomDrawer from './MobileBottomDrawer'
import { useIntakeChat } from '@/hooks/useIntakeChat'
import { formatPriceRange, isPricingVisible } from '@/lib/pricing/engine'

type Props = {
  proposalId: string
  initialMessage: string
  onStateChange?: (moduleCount: number, confidenceScore: number) => void
  onResetRef?: React.MutableRefObject<(() => void) | null>
  theme?: 'dark' | 'light'
}

export default function IntakeLayout({ proposalId, initialMessage, onStateChange, onResetRef, theme }: Props) {
  const {
    messages,
    activeModules,
    confidenceScore,
    priceRange,
    isStreaming,
    sendMessage,
    toggleModule,
    productOverview,
    editMessage,
    reset,
  } = useIntakeChat({ proposalId, idea: initialMessage })

  const onStateChangeRef = useRef(onStateChange)
  useEffect(() => { onStateChangeRef.current = onStateChange })

  useEffect(() => {
    if (onResetRef) onResetRef.current = reset
  }, [reset, onResetRef])

  useEffect(() => {
    onStateChangeRef.current?.(activeModules.length, confidenceScore)
  }, [activeModules.length, confidenceScore])

  const pricingVisible = isPricingVisible(confidenceScore)

  // aiStarted = true once the AI has responded at least once (confidence > 0)
  const aiStarted = confidenceScore > 0

  const summaryText = pricingVisible
    ? `${activeModules.length} modules · ${formatPriceRange(priceRange)}`
    : `${activeModules.length} modules detected`

  return (
    <div className="flex-1 overflow-hidden flex">
      {/* Desktop: side by side */}
      <div className="hidden md:flex flex-1 overflow-hidden">
        <div className="w-[55%] border-r border-white/5 overflow-hidden">
          <ChatPanel
            messages={messages}
            isStreaming={isStreaming}
            onSend={sendMessage}
            onEdit={editMessage}
          />
        </div>
        <div className="w-[45%] overflow-hidden">
          <ModulesPanel
            activeModules={activeModules}
            confidenceScore={confidenceScore}
            pricingVisible={pricingVisible}
            productOverview={productOverview}
            proposalId={proposalId}
            onToggle={toggleModule}
            aiStarted={aiStarted}
            theme={theme}
          />
        </div>
      </div>

      {/* Mobile: full chat + bottom drawer */}
      <div className="md:hidden flex-1 overflow-hidden flex flex-col">
        <div className="flex-1 overflow-hidden">
          <ChatPanel
            messages={messages}
            isStreaming={isStreaming}
            onSend={sendMessage}
            onEdit={editMessage}
          />
        </div>
        <MobileBottomDrawer
          summary={summaryText}
          activeModules={activeModules}
          confidenceScore={confidenceScore}
          pricingVisible={pricingVisible}
          productOverview={productOverview}
          proposalId={proposalId}
          aiStarted={aiStarted}
          onToggle={toggleModule}
        />
      </div>
    </div>
  )
}
