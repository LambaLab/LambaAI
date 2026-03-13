'use client'

import { useState, useEffect } from 'react'
import ChatPanel from './ChatPanel'
import ModulesPanel from './ModulesPanel'
import MobileBottomDrawer from './MobileBottomDrawer'
import OnboardingSteps from './OnboardingSteps'
import { useIntakeChat } from '@/hooks/useIntakeChat'
import { formatPriceRange, isPricingVisible } from '@/lib/pricing/engine'
import { bundleOnboardingContext } from '@/lib/intake-utils'
import type { OnboardingContext } from '@/lib/intake-types'

type Props = {
  proposalId: string
  initialMessage: string
  onStateChange?: (moduleCount: number, confidenceScore: number) => void
}

export default function IntakeLayout({ proposalId, initialMessage, onStateChange }: Props) {
  const [onboardingDone, setOnboardingDone] = useState(false)
  const [bundledMessage, setBundledMessage] = useState('')

  const {
    messages,
    activeModules,
    confidenceScore,
    priceRange,
    isStreaming,
    sendMessage,
    toggleModule,
  } = useIntakeChat({ proposalId, initialMessage: '' })

  useEffect(() => {
    onStateChange?.(activeModules.length, confidenceScore)
  }, [activeModules.length, confidenceScore, onStateChange])

  // Send the bundled context to the AI after onboarding completes.
  // We call sendMessage() explicitly here rather than relying on the
  // hook's initialMessage prop, because the hook only reads initialMessage
  // once on mount (before onboarding runs). React 18 batches the two
  // setState calls in handleOnboardingComplete so bundledMessage is always
  // populated when this effect fires.
  useEffect(() => {
    if (onboardingDone && bundledMessage) {
      sendMessage(bundledMessage)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onboardingDone])

  function handleOnboardingComplete(ctx: OnboardingContext) {
    const msg = bundleOnboardingContext(ctx)
    setBundledMessage(msg)
    setOnboardingDone(true)
  }

  const pricingVisible = isPricingVisible(confidenceScore)
  const summaryText = pricingVisible
    ? `${activeModules.length} modules · ${formatPriceRange(priceRange)}`
    : `${activeModules.length} modules detected`

  if (!onboardingDone) {
    return (
      <div className="flex-1 overflow-hidden flex flex-col">
        <OnboardingSteps
          idea={initialMessage}
          onComplete={handleOnboardingComplete}
        />
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-hidden flex">
      {/* Desktop: side by side */}
      <div className="hidden md:flex flex-1 overflow-hidden">
        <div className="w-[55%] border-r border-white/5 overflow-hidden">
          <ChatPanel
            messages={messages}
            isStreaming={isStreaming}
            confidenceScore={confidenceScore}
            onSend={sendMessage}
            proposalId={proposalId}
            pricingVisible={pricingVisible}
            priceRange={priceRange}
          />
        </div>
        <div className="w-[45%] overflow-hidden">
          <ModulesPanel
            activeModules={activeModules}
            confidenceScore={confidenceScore}
            priceRange={priceRange}
            pricingVisible={pricingVisible}
            onToggle={toggleModule}
          />
        </div>
      </div>

      {/* Mobile: full chat + bottom drawer */}
      <div className="md:hidden flex-1 overflow-hidden flex flex-col">
        <div className="flex-1 overflow-hidden">
          <ChatPanel
            messages={messages}
            isStreaming={isStreaming}
            confidenceScore={confidenceScore}
            onSend={sendMessage}
            proposalId={proposalId}
            pricingVisible={pricingVisible}
            priceRange={priceRange}
          />
        </div>
        <MobileBottomDrawer
          summary={summaryText}
          activeModules={activeModules}
          confidenceScore={confidenceScore}
          priceRange={priceRange}
          pricingVisible={pricingVisible}
          onToggle={toggleModule}
        />
      </div>
    </div>
  )
}
