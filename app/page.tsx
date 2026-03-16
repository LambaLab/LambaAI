'use client'

import { useState, useCallback } from 'react'
import HeroSection from '@/components/landing/HeroSection'
import HowItWorks from '@/components/landing/HowItWorks'
import ValueProps from '@/components/landing/ValueProps'
import SocialProof from '@/components/landing/SocialProof'
import Footer from '@/components/landing/Footer'

// Detect returning users synchronously so landing sections are never rendered
// (prevents them from flashing behind the overlay when iOS keyboard opens).
function hasExistingSession(): boolean {
  if (typeof window === 'undefined') return false
  try { return !!localStorage.getItem('lamba_session') } catch { return false }
}

export default function LandingPage() {
  const [intakeActive, setIntakeActive] = useState(hasExistingSession)

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
