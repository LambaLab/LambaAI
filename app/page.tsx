'use client'

import { useState, useCallback } from 'react'
import HeroSection from '@/components/landing/HeroSection'
import HowItWorks from '@/components/landing/HowItWorks'
import ValueProps from '@/components/landing/ValueProps'
import SocialProof from '@/components/landing/SocialProof'
import Footer from '@/components/landing/Footer'

// Only hide landing sections when the overlay will actually auto-open.
// On bare "/", always show the landing page even if a session exists.
function willOverlayAutoOpen(): boolean {
  if (typeof window === 'undefined') return false
  try {
    const c = new URLSearchParams(window.location.search).get('c')
    return !!c // only auto-opens on ?c= links
  } catch { return false }
}

export default function LandingPage() {
  const [intakeActive, setIntakeActive] = useState(willOverlayAutoOpen)

  const handleIntakeOpen = useCallback(() => setIntakeActive(true), [])
  const handleIntakeClose = useCallback(() => setIntakeActive(false), [])

  return (
    <main>
      <HeroSection onIntakeChange={handleIntakeOpen} onIntakeClose={handleIntakeClose} />
      {!intakeActive && (
        <>
          <HowItWorks />
          <ValueProps />
          <SocialProof />
          <Footer />
        </>
      )}
    </main>
  )
}
