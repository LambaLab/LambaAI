'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Minus, Sun, Moon, X } from 'lucide-react'
import { useTheme } from '@/hooks/useTheme'
import IntakeLayout from './IntakeLayout'
import MinimizedBar from './MinimizedBar'
import { getOrCreateSession, storeIdeaForSession, type SessionData } from '@/lib/session'
import SessionLoadingScreen from './SessionLoadingScreen'

type Props = {
  initialMessage: string
  onReset?: () => void
  onClose?: () => void
}

export default function IntakeOverlay({ initialMessage, onClose }: Props) {
  const { theme, toggleTheme } = useTheme()
  const [session, setSession] = useState<SessionData | null>(null)
  const [sessionError, setSessionError] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [minimized, setMinimized] = useState(false)
  const [proposalOpen, setProposalOpen] = useState(false)
  const [liveModuleCount, setLiveModuleCount] = useState(0)
  const [liveConfidenceScore, setLiveConfidenceScore] = useState(0)
  const [currentIdea, setCurrentIdea] = useState(initialMessage)
  // Editable app name — defaults to "Brief Lab", persisted in localStorage
  const [appName, setAppName] = useState('Brief Lab')
  const [editingName, setEditingName] = useState(false)
  const [nameInputValue, setNameInputValue] = useState('Brief Lab')

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

  // Load persisted app name on mount
  useEffect(() => {
    const saved = localStorage.getItem('lamba_app_name')
    if (saved) {
      setAppName(saved)
      setNameInputValue(saved)
    }
  }, [])

  function saveAppName() {
    const trimmed = nameInputValue.trim() || 'Brief Lab'
    setAppName(trimmed)
    setNameInputValue(trimmed)
    localStorage.setItem('lamba_app_name', trimmed)
    setEditingName(false)
  }

  useEffect(() => {
    if (minimized) {
      document.body.style.overflow = ''
    } else {
      document.body.style.overflow = 'hidden'
    }
  }, [minimized])

  useEffect(() => {
    getOrCreateSession().then((data) => {
      setSession(data)
      // Store the idea so we can restore it on refresh
      if (initialMessage) {
        storeIdeaForSession(data.proposalId, initialMessage)
      }
      // Push unique conversation URL
      window.history.replaceState(null, '', `?c=${data.proposalId}`)
    }).catch(() => setSessionError(true))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleStateChange = useCallback((m: number, c: number) => {
    setLiveModuleCount(m)
    setLiveConfidenceScore(c)
  }, [])

  const resetRef = useRef<(() => void) | null>(null)

  function doReset() {
    if (session) {
      localStorage.removeItem(`lamba_idea_${session.proposalId}`)
      localStorage.removeItem(`lamba_msgs_${session.proposalId}`)
      localStorage.removeItem(`lamba_proposal_${session.proposalId}`)
    }
    localStorage.removeItem('lamba_session')
    window.location.href = '/'
  }

  function handleRetry() {
    setSessionError(false)
    getOrCreateSession()
      .then((data) => {
        setSession(data)
        if (initialMessage) storeIdeaForSession(data.proposalId, initialMessage)
        window.history.replaceState(null, '', `?c=${data.proposalId}`)
      })
      .catch(() => setSessionError(true))
  }

  const isBlank = currentIdea === ''

  function handleCloseOrMinimize() {
    if (isBlank) {
      // Clear URL when closing a blank overlay
      window.history.replaceState(null, '', '/')
      onClose?.()
    } else {
      setMinimized(true)
    }
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
          <div className="text-center space-y-4">
            <p className="text-[var(--ov-text,#ffffff)]">Couldn&apos;t connect. Check your connection and try again.</p>
            <button
              onClick={handleRetry}
              className="px-4 py-2 bg-brand-yellow text-brand-dark text-sm font-medium rounded-lg hover:bg-brand-yellow/90 transition-colors cursor-pointer"
            >
              Try again
            </button>
          </div>
        </div>
      )}

      {!minimized && !session && !sessionError && (
        <div className={`fixed inset-0 z-50 flex items-center justify-center transition-opacity duration-300 ${theme === 'light' ? 'bg-[#F5F4F0] intake-light' : 'bg-brand-dark'} ${mounted ? 'opacity-100' : 'opacity-0'}`}>
          <SessionLoadingScreen idea={initialMessage} />
        </div>
      )}

      {/* Full overlay — always mounted once session is ready, hidden via CSS when minimized */}
      {session && (
        <div className={`fixed inset-0 z-50 flex flex-col transition-opacity duration-300 ${theme === 'light' ? 'bg-[#F5F4F0] intake-light' : 'bg-brand-dark'} ${mounted ? 'opacity-100' : 'opacity-0'} ${minimized ? 'hidden' : ''}`}>
          {/* Top bar */}
          <div className={`flex items-center justify-between px-4 py-3 border-b flex-shrink-0 ${theme === 'light' ? 'border-[rgba(0,0,0,0.08)]' : 'border-white/5'}`}>

            {/* App name — editable in place on click */}
            {editingName ? (
              <input
                autoFocus
                value={nameInputValue}
                onChange={(e) => setNameInputValue(e.target.value)}
                onBlur={saveAppName}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') saveAppName()
                  if (e.key === 'Escape') { setNameInputValue(appName); setEditingName(false) }
                }}
                maxLength={20}
                className="font-bebas text-xl tracking-widest text-[var(--ov-text,#ffffff)] bg-transparent border-b border-brand-yellow/50 outline-none uppercase w-36"
              />
            ) : (
              <button
                onClick={() => { setNameInputValue(appName); setEditingName(true) }}
                className="font-bebas text-xl tracking-widest text-[var(--ov-text,#ffffff)] hover:opacity-75 transition-opacity cursor-text group flex items-center gap-1.5"
                title="Click to rename"
              >
                {appName.toUpperCase()}
                <span className="opacity-0 group-hover:opacity-100 transition-opacity text-[10px] text-[var(--ov-text-muted,#727272)] font-sans tracking-normal normal-case leading-none">✎</span>
              </button>
            )}

            <div className="flex items-center gap-2">
              {/* Save for later — only visible when proposal panel is closed */}
              {!proposalOpen && (
                <button
                  type="button"
                  className="hidden md:flex text-xs text-[var(--ov-text-muted,#727272)] hover:text-[var(--ov-text,#ffffff)] transition-colors cursor-pointer px-2 py-1.5"
                  title="Save for later (coming soon)"
                >
                  Save for later
                </button>
              )}

              {/* View / Hide Proposal button — no yellow fill when open */}
              <button
                onClick={() => setProposalOpen(p => !p)}
                className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer border border-white/10 hover:border-white/20 bg-transparent text-[var(--ov-text,#ffffff)]"
              >
                {proposalOpen ? (
                  'Hide proposal'
                ) : (
                  <>View Proposal <span className="text-brand-yellow">{liveConfidenceScore}%</span></>
                )}
              </button>

              <button
                onClick={toggleTheme}
                className="w-8 h-8 rounded-lg bg-[var(--ov-surface-subtle,rgba(255,255,255,0.05))] hover:bg-[var(--ov-input-bg,rgba(255,255,255,0.10))] flex items-center justify-center text-[var(--ov-text-muted,#727272)] hover:text-[var(--ov-text,#ffffff)] transition-colors cursor-pointer"
                aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              >
                {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </button>
              <button
                onClick={handleCloseOrMinimize}
                className="w-8 h-8 rounded-lg bg-[var(--ov-surface-subtle,rgba(255,255,255,0.05))] hover:bg-[var(--ov-input-bg,rgba(255,255,255,0.10))] flex items-center justify-center text-[var(--ov-text-muted,#727272)] hover:text-[var(--ov-text,#ffffff)] transition-colors cursor-pointer"
                aria-label={isBlank ? 'Close' : 'Minimize'}
              >
                {isBlank ? <X className="w-4 h-4" /> : <Minus className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Main content — stays mounted, preserving all chat state */}
          <IntakeLayout
            proposalId={session.proposalId}
            initialMessage={currentIdea}
            onStateChange={handleStateChange}
            onResetRef={resetRef}
            onReset={doReset}
            theme={theme}
            proposalOpen={proposalOpen}
            onProposalToggle={() => setProposalOpen(p => !p)}
          />
        </div>
      )}
    </>
  )
}
