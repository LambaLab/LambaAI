'use client'

import { useState } from 'react'
import HeroInput from './HeroInput'
import IntakeOverlay from '@/components/intake/IntakeOverlay'

export default function HeroSection() {
  const [intakeOpen, setIntakeOpen] = useState(false)
  const [initialMessage, setInitialMessage] = useState('')

  function handleFirstMessage(message: string) {
    setInitialMessage(message)
    setIntakeOpen(true)
  }

  return (
    <>
      <section className="min-h-screen flex flex-col items-center justify-center px-4 py-20 relative">
        {/* Background grid */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,252,0,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,252,0,0.03)_1px,transparent_1px)] bg-[size:64px_64px] pointer-events-none" />

        <div className="relative z-10 text-center max-w-4xl mx-auto space-y-8">
          <div className="inline-flex items-center gap-2 bg-brand-yellow/10 border border-brand-yellow/20 rounded-full px-4 py-1.5 text-sm text-brand-yellow font-medium">
            <span className="w-2 h-2 bg-brand-yellow rounded-full animate-pulse" />
            AI-powered project estimation
          </div>

          <h1 className="font-bebas text-6xl sm:text-7xl md:text-8xl lg:text-9xl leading-none tracking-wide text-brand-white">
            BUILD YOUR
            <br />
            <span className="text-brand-yellow">NEXT IDEA</span>
          </h1>

          <p className="text-brand-gray-mid text-lg sm:text-xl max-w-xl mx-auto font-inter">
            Describe your product. Our AI breaks it down into modules,
            estimates the cost, and delivers a real proposal — in minutes.
          </p>

          <HeroInput onFirstMessage={handleFirstMessage} />
        </div>
      </section>

      {intakeOpen && (
        <IntakeOverlay
          initialMessage={initialMessage}
          onMinimize={() => setIntakeOpen(false)}
        />
      )}
    </>
  )
}
