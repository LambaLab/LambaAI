'use client'

import { useState, useEffect } from 'react'
import HeroInput from './HeroInput'
import IntakeOverlay from '@/components/intake/IntakeOverlay'
import { getStoredSession, getIdeaForSession, hydrateProposalFromRestore } from '@/lib/session'

export default function HeroSection() {
  const [intakeOpen, setIntakeOpen] = useState(false)
  const [initialMessage, setInitialMessage] = useState('')
  const [heroInputResetKey, setHeroInputResetKey] = useState(0)
  const [expiredLink, setExpiredLink] = useState(false)

  // Restore conversation from localStorage/URL on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const c = params.get('c')

    if (c) {
      // Same-device: localStorage matches the URL param
      const storedSession = getStoredSession()
      const idea = storedSession?.proposalId === c ? getIdeaForSession(c) : null
      if (idea) {
        setInitialMessage(idea)
        setIntakeOpen(true)
        return
      }

      // Cross-device: no localStorage match — fetch from Supabase
      fetch(`/api/proposals/${c}/restore`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          // Treat as expired if no data OR if the response has no meaningful content
          // (API returns 200 with empty fields for proposals that were never saved)
          const hasContent = data && (data.brief || (data.messages && data.messages.length > 0))
          if (!hasContent) {
            setExpiredLink(true)
            return
          }
          hydrateProposalFromRestore(data)
          setInitialMessage(data.brief || data.messages?.[0]?.content || '')
          setIntakeOpen(true)
        })
        .catch(() => {
          setExpiredLink(true)
        })
      return
    }

    // No URL param — check localStorage for any active session with a real idea
    const storedSession = getStoredSession()
    if (storedSession) {
      const idea = getIdeaForSession(storedSession.proposalId)
      if (idea) {
        setInitialMessage(idea)
        setIntakeOpen(true)
      }
    }
  }, [])

  function handleFirstMessage(message: string) {
    setInitialMessage(message)
    setIntakeOpen(true)
  }

  function handleReset() {
    setInitialMessage('')
    setHeroInputResetKey((k) => k + 1)
  }

  function handleClose() {
    setIntakeOpen(false)
    setInitialMessage('')
    setHeroInputResetKey((k) => k + 1)
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

          {expiredLink && (
            <div className="bg-white/5 border border-white/10 rounded-xl px-5 py-4 max-w-md mx-auto text-sm text-brand-gray-mid space-y-1">
              <p className="text-brand-white font-medium">This conversation link has expired</p>
              <p>The session was not saved. Start a new conversation below, or use &ldquo;Save for Later&rdquo; next time to access it from any device.</p>
            </div>
          )}

          <HeroInput key={heroInputResetKey} onFirstMessage={handleFirstMessage} />
        </div>
      </section>

      {intakeOpen && (
        <IntakeOverlay
          initialMessage={initialMessage}
          onReset={handleReset}
          onClose={handleClose}
        />
      )}
    </>
  )
}
