'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Minus, Sun, Moon } from 'lucide-react'
import { useTheme } from '@/hooks/useTheme'
import IntakeLayout from './IntakeLayout'
import MinimizedBar from './MinimizedBar'
import { getOrCreateSession, type SessionData } from '@/lib/session'

type Props = {
  initialMessage: string
}

export default function IntakeOverlay({ initialMessage }: Props) {
  const { theme, toggleTheme } = useTheme()
  const [session, setSession] = useState<SessionData | null>(null)
  const [sessionError, setSessionError] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [minimized, setMinimized] = useState(false)
  const [liveModuleCount, setLiveModuleCount] = useState(0)
  const [liveConfidenceScore, setLiveConfidenceScore] = useState(0)

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
    if (minimized) {
      document.body.style.overflow = ''
    } else {
      document.body.style.overflow = 'hidden'
    }
  }, [minimized])

  useEffect(() => {
    getOrCreateSession().then(setSession).catch(() => setSessionError(true))
  }, [])

  const handleStateChange = useCallback((m: number, c: number) => {
    setLiveModuleCount(m)
    setLiveConfidenceScore(c)
  }, [])

  const [resetConfirm, setResetConfirm] = useState(false)
  const resetRef = useRef<(() => void) | null>(null)
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
      return
    }
    // Confirmed: clear timer first
    if (resetConfirmTimerRef.current) clearTimeout(resetConfirmTimerRef.current)
    // Call reset + clear session
    resetRef.current?.()
    setResetConfirm(false)
    sessionStorage.removeItem('lamba_session')
    setSession(null)
    getOrCreateSession().then(setSession).catch(() => setSessionError(true))
  }

  return (
    <>
      {/* MinimizedBar — always rendered when minimized */}
      {minimized && (
        <MinimizedBar
          moduleCount={liveModuleCount}
          confidenceScore={liveConfidenceScore}
          onExpand={() => setMinimized(false)}
        />
      )}

      {/* Loading / error states — only shown when not minimized and session not ready */}
      {!minimized && sessionError && (
        <div className={`fixed inset-0 z-50 flex items-center justify-center transition-opacity duration-300 ${theme === 'light' ? 'bg-[#F5F4F0] intake-light' : 'bg-brand-dark'} ${mounted ? 'opacity-100' : 'opacity-0'}`}>
          <div className="text-center space-y-3">
            <p className="text-[var(--ov-text,#ffffff)]">Couldn't start session. Please try again.</p>
            <button onClick={() => setMinimized(true)} className="text-[var(--ov-text-muted,#727272)] text-sm hover:text-[var(--ov-text,#ffffff)] transition-colors">
              Dismiss
            </button>
          </div>
        </div>
      )}

      {!minimized && !session && !sessionError && (
        <div className={`fixed inset-0 z-50 flex items-center justify-center transition-opacity duration-300 ${theme === 'light' ? 'bg-[#F5F4F0] intake-light' : 'bg-brand-dark'} ${mounted ? 'opacity-100' : 'opacity-0'}`}>
          <div className="w-8 h-8 border-2 border-brand-yellow border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* Full overlay — always mounted once session is ready, hidden via CSS when minimized */}
      {session && (
        <div className={`fixed inset-0 z-50 flex flex-col transition-opacity duration-300 ${theme === 'light' ? 'bg-[#F5F4F0] intake-light' : 'bg-brand-dark'} ${mounted ? 'opacity-100' : 'opacity-0'} ${minimized ? 'hidden' : ''}`}>
          {/* Top bar */}
          <div className={`flex items-center justify-between px-4 py-3 border-b flex-shrink-0 ${theme === 'light' ? 'border-[rgba(0,0,0,0.08)]' : 'border-white/5'}`}>
            <span className="font-bebas text-xl tracking-widest text-[var(--ov-text,#ffffff)]">LAMBA LAB</span>
            <div className="flex items-center gap-2">
              {resetConfirm ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-brand-gray-mid">Start over?</span>
                  <button
                    onClick={handleResetClick}
                    className="text-xs text-red-400 hover:text-red-300 transition-colors px-2 py-1 rounded-lg hover:bg-white/5"
                  >
                    Yes
                  </button>
                  <button
                    onClick={() => setResetConfirm(false)}
                    className="text-xs text-brand-gray-mid hover:text-brand-white transition-colors px-2 py-1 rounded-lg hover:bg-white/5"
                  >
                    No
                  </button>
                </div>
              ) : (
                <button
                  onClick={handleResetClick}
                  className="text-xs text-brand-gray-mid hover:text-brand-white transition-colors px-2 py-1 rounded-lg hover:bg-white/5"
                  aria-label="Reset conversation"
                >
                  ↺ Reset
                </button>
              )}
              <button
                onClick={toggleTheme}
                className="w-8 h-8 rounded-lg bg-[var(--ov-surface-subtle,rgba(255,255,255,0.05))] hover:bg-[var(--ov-input-bg,rgba(255,255,255,0.10))] flex items-center justify-center text-[var(--ov-text-muted,#727272)] hover:text-[var(--ov-text,#ffffff)] transition-colors"
                aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              >
                {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </button>
              <button
                onClick={() => setMinimized(true)}
                className="w-8 h-8 rounded-lg bg-[var(--ov-surface-subtle,rgba(255,255,255,0.05))] hover:bg-[var(--ov-input-bg,rgba(255,255,255,0.10))] flex items-center justify-center text-[var(--ov-text-muted,#727272)] hover:text-[var(--ov-text,#ffffff)] transition-colors"
                aria-label="Minimize"
              >
                <Minus className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Main content — stays mounted, preserving all chat state */}
          <IntakeLayout
            proposalId={session.proposalId}
            initialMessage={initialMessage}
            onStateChange={handleStateChange}
            onResetRef={resetRef}
            theme={theme}
          />
        </div>
      )}
    </>
  )
}
