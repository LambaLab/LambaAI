'use client'

import { useEffect, useState } from 'react'
import { Minus } from 'lucide-react'
import IntakeLayout from './IntakeLayout'
import { getOrCreateSession, type SessionData } from '@/lib/session'

type Props = {
  initialMessage: string
  onMinimize: () => void
}

export default function IntakeOverlay({ initialMessage, onMinimize }: Props) {
  const [session, setSession] = useState<SessionData | null>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    const timer = setTimeout(() => {
      document.body.style.overflow = 'hidden'
    }, 50)
    return () => {
      clearTimeout(timer)
      document.body.style.overflow = ''
    }
  }, [])

  useEffect(() => {
    getOrCreateSession().then(setSession)
  }, [])

  if (!session) {
    return (
      <div className={`fixed inset-0 z-50 bg-brand-dark flex items-center justify-center transition-opacity duration-300 ${mounted ? 'opacity-100' : 'opacity-0'}`}>
        <div className="w-8 h-8 border-2 border-brand-yellow border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div
      className={`fixed inset-0 z-50 bg-brand-dark flex flex-col transition-opacity duration-300 ${mounted ? 'opacity-100' : 'opacity-0'}`}
    >
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 flex-shrink-0">
        <span className="font-bebas text-xl tracking-widest text-brand-white">LAMBA LAB</span>
        <div className="flex items-center gap-2">
          <button
            onClick={onMinimize}
            className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-brand-gray-mid hover:text-brand-white transition-colors"
            aria-label="Minimize"
          >
            <Minus className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main content */}
      <IntakeLayout
        proposalId={session.proposalId}
        initialMessage={initialMessage}
      />
    </div>
  )
}
