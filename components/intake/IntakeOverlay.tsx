'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Menu, Minus, Sun, Moon, X } from 'lucide-react'
import { useTheme } from '@/hooks/useTheme'
import IntakeLayout from './IntakeLayout'
import MinimizedBar from './MinimizedBar'
import SaveForLaterModal from './SaveForLaterModal'
import ProposalDrawer, { type ProposalSummary } from './ProposalDrawer'
import {
  getOrCreateSession,
  storeIdeaForSession,
  storeSession,
  hydrateProposalFromRestore,
  getIdeaForSession,
  type SessionData,
} from '@/lib/session'
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
  const [saveModalOpen, setSaveModalOpen] = useState(false)
  const [liveModuleCount, setLiveModuleCount] = useState(0)
  const [liveConfidenceScore, setLiveConfidenceScore] = useState(0)
  const [emailVerified, setEmailVerified] = useState(false)
  const [currentIdea, setCurrentIdea] = useState(initialMessage)
  // Editable app name — AI-generated initially, user can override. Persisted in localStorage.
  const [appName, setAppName] = useState('')
  const [editingName, setEditingName] = useState(false)
  const [nameInputValue, setNameInputValue] = useState('')
  // Track whether the user has manually edited the name — if so, don't overwrite with AI suggestions
  const nameManuallyEditedRef = useRef(false)

  // ── Drawer state ──
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [proposals, setProposals] = useState<ProposalSummary[]>([])
  const [loadingProposals, setLoadingProposals] = useState(false)
  // Track the email we've fetched proposals for — stale-check on drawer open
  const fetchedForProposalRef = useRef<string | null>(null)

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

  // Load persisted app name on mount — if present, the user manually set it
  useEffect(() => {
    const saved = localStorage.getItem('lamba_app_name')
    if (saved) {
      nameManuallyEditedRef.current = true
      setAppName(saved)
      setNameInputValue(saved)
    }
  }, [])

  function saveAppName() {
    const trimmed = nameInputValue.trim()
    if (!trimmed) {
      // User cleared the name — revert to AI-generated (or blank) and stop tracking manual override
      nameManuallyEditedRef.current = false
      localStorage.removeItem('lamba_app_name')
      setEditingName(false)
      return
    }
    nameManuallyEditedRef.current = true
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
      // Check if email was already verified for this proposal
      if (localStorage.getItem(`lamba_email_verified_${data.proposalId}`)) {
        setEmailVerified(true)
      }
    }).catch(() => setSessionError(true))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Fetch proposals for the drawer ──
  const fetchProposals = useCallback(async (proposalId: string) => {
    setLoadingProposals(true)
    try {
      const res = await fetch(`/api/proposals/by-email?proposalId=${proposalId}`)
      if (!res.ok) {
        setProposals([])
        return
      }
      const data = await res.json()
      setProposals(data.proposals ?? [])
      fetchedForProposalRef.current = proposalId
    } catch {
      setProposals([])
    } finally {
      setLoadingProposals(false)
    }
  }, [])

  // Auto-fetch proposals when email becomes verified
  useEffect(() => {
    if (emailVerified && session) {
      fetchProposals(session.proposalId)
    }
  }, [emailVerified, session, fetchProposals])

  // Refetch when drawer opens and data is stale
  useEffect(() => {
    if (drawerOpen && emailVerified && session && fetchedForProposalRef.current !== session.proposalId) {
      fetchProposals(session.proposalId)
    }
  }, [drawerOpen, emailVerified, session, fetchProposals])

  // ── Switch to a different proposal ──
  const switchToProposal = useCallback(async (targetId: string) => {
    if (!session) return
    setDrawerOpen(false)
    try {
      const res = await fetch(`/api/proposals/${targetId}/restore`)
      if (!res.ok) throw new Error('Failed to restore')
      const data = await res.json()

      // Hydrate all localStorage keys for the target proposal
      hydrateProposalFromRestore(data)

      // Read restored project name
      const meta = data.metadata && typeof data.metadata === 'object' ? data.metadata : {}
      const restoredName = (meta.projectName as string) || ''

      // Update session state — key change on IntakeLayout will cause clean remount
      const newSession: SessionData = {
        sessionId: data.sessionId,
        proposalId: data.proposalId,
        userId: data.userId || session.userId,
      }
      storeSession(newSession)

      // Update URL
      window.history.replaceState(null, '', `?c=${targetId}`)

      // Update app name
      nameManuallyEditedRef.current = false
      setAppName(restoredName)
      setNameInputValue(restoredName)
      if (restoredName) {
        localStorage.setItem('lamba_app_name', restoredName)
      } else {
        localStorage.removeItem('lamba_app_name')
      }

      // Restore idea
      setCurrentIdea(getIdeaForSession(targetId) || data.brief || '')

      // Check email verified for new proposal
      setEmailVerified(!!localStorage.getItem(`lamba_email_verified_${targetId}`))

      // Reset confidence and module count (will be re-populated from localStorage on remount)
      const proposalState = localStorage.getItem(`lamba_proposal_${targetId}`)
      if (proposalState) {
        try {
          const parsed = JSON.parse(proposalState)
          setLiveConfidenceScore(parsed.confidenceScore ?? 0)
          setLiveModuleCount(Array.isArray(parsed.activeModules) ? parsed.activeModules.length : 0)
        } catch { /* noop */ }
      } else {
        setLiveConfidenceScore(0)
        setLiveModuleCount(0)
      }

      // Close proposal panel if open
      setProposalOpen(false)

      // Trigger remount by updating session
      setSession(newSession)
    } catch (err) {
      console.error('Failed to switch proposal:', err)
    }
  }, [session])

  // ── Create a new proposal ──
  const handleNewProposal = useCallback(async () => {
    if (!session) return
    setDrawerOpen(false)
    try {
      // Get the email from the current proposal's verified state
      const currentEmail = emailVerified
        ? proposals.length > 0
          ? undefined // email will be determined from the proposalId on the server
          : undefined
        : undefined

      // We need to get the email. Fetch it from the by-email endpoint data or localStorage
      let email: string | undefined
      if (emailVerified) {
        // Fetch the email associated with this proposal
        const emailRes = await fetch(`/api/proposals/by-email?proposalId=${session.proposalId}`)
        if (emailRes.ok) {
          const emailData = await emailRes.json()
          email = emailData.email
        }
      }

      // Create new session with email if available
      const res = await fetch('/api/intake/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(email ? { email } : {}),
      })
      if (!res.ok) throw new Error('Failed to create session')
      const newSessionData: SessionData = await res.json()
      storeSession(newSessionData)

      // Reset all state
      nameManuallyEditedRef.current = false
      setAppName('')
      setNameInputValue('')
      localStorage.removeItem('lamba_app_name')
      setCurrentIdea('')
      setLiveModuleCount(0)
      setLiveConfidenceScore(0)
      setProposalOpen(false)

      // If email was set, the new proposal is auto-linked
      if (email) {
        localStorage.setItem(`lamba_email_verified_${newSessionData.proposalId}`, '1')
        setEmailVerified(true)
      }

      // Update URL
      window.history.replaceState(null, '', `?c=${newSessionData.proposalId}`)

      // Trigger remount
      setSession(newSessionData)

      // Refresh proposals list to include the new one
      if (email) {
        fetchProposals(newSessionData.proposalId)
      }
    } catch (err) {
      console.error('Failed to create new proposal:', err)
    }
  }, [session, emailVerified, proposals, fetchProposals])

  const handleStateChange = useCallback((m: number, c: number, pName?: string) => {
    setLiveModuleCount(m)
    setLiveConfidenceScore(c)
    // Auto-update the app name with the AI-generated project name —
    // but only if the user hasn't manually set their own name
    if (pName && pName.trim() && !nameManuallyEditedRef.current) {
      setAppName(pName.trim())
      setNameInputValue(pName.trim())
    }
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

  // ── Handle save modal close → re-check email verified ──
  function handleSaveModalClose() {
    setSaveModalOpen(false)
    if (session && localStorage.getItem(`lamba_email_verified_${session.proposalId}`)) {
      setEmailVerified(true)
    }
  }

  return (
    <>
      {/* MinimizedBar — always rendered when minimized */}
      {minimized && (
        <MinimizedBar
          appName={appName}
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

            {/* Left: Hamburger + App name */}
            <div className="flex items-center gap-2">
              {/* Hamburger / drawer toggle */}
              <button
                onClick={() => setDrawerOpen(true)}
                className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors cursor-pointer
                  ${theme === 'light'
                    ? 'hover:bg-black/5 text-[var(--ov-text-muted,#727272)] hover:text-[var(--ov-text,#1a1a1a)]'
                    : 'hover:bg-white/10 text-[var(--ov-text-muted,#727272)] hover:text-[var(--ov-text,#ffffff)]'
                  }`}
                aria-label="Open proposals drawer"
              >
                <Menu className="w-4 h-4" />
              </button>

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
                  className="font-bebas text-xl tracking-widest text-[var(--ov-text,#ffffff)] bg-transparent border-b border-[var(--ov-accent-border,rgba(255,252,0,0.50))] outline-none uppercase w-36"
                />
              ) : (
                <button
                  onClick={() => { setNameInputValue(appName); setEditingName(true) }}
                  className="font-bebas text-xl tracking-widest text-[var(--ov-text,#ffffff)] hover:opacity-75 transition-opacity cursor-pointer group flex items-center gap-1.5"
                  title="Click to rename"
                >
                  {appName ? appName.toUpperCase() : <span className="text-[var(--ov-text-muted,#727272)]">YOUR APP</span>}
                  <span className="opacity-0 group-hover:opacity-100 transition-opacity text-[10px] text-[var(--ov-text-muted,#727272)] font-sans tracking-normal normal-case leading-none">✎</span>
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              {/* Save for later — hidden on mobile (available in drawer), hidden when email verified or proposal panel open */}
              {!proposalOpen && !emailVerified && (
                <button
                  type="button"
                  className="hidden md:block text-xs text-[var(--ov-text-muted,#727272)] hover:text-[var(--ov-text,#ffffff)] transition-colors cursor-pointer px-2 py-1.5"
                  title="Save for later"
                  onClick={() => setSaveModalOpen(true)}
                >
                  Save for later
                </button>
              )}

              {/* View / Hide Proposal button — desktop only, mobile uses bottom drawer */}
              <button
                onClick={() => setProposalOpen(p => !p)}
                className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer border border-[var(--ov-border,rgba(255,255,255,0.10))] hover:border-[var(--ov-text-muted,rgba(255,255,255,0.20))] bg-transparent text-[var(--ov-text,#ffffff)]"
              >
                {proposalOpen ? (
                  'Hide proposal'
                ) : (
                  <>View Proposal <span className="text-[var(--ov-accent-strong,#fffc00)]">{liveConfidenceScore}%</span></>
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

          {/* Main content — key change forces clean remount when switching proposals */}
          <IntakeLayout
            key={session.proposalId}
            proposalId={session.proposalId}
            initialMessage={currentIdea}
            onStateChange={handleStateChange}
            onResetRef={resetRef}
            onReset={doReset}
            theme={theme}
            proposalOpen={proposalOpen}
            onProposalToggle={() => setProposalOpen(p => !p)}
            onSaveLater={() => setSaveModalOpen(true)}
          />

          {/* Proposal Drawer */}
          <ProposalDrawer
            open={drawerOpen}
            onClose={() => setDrawerOpen(false)}
            emailVerified={emailVerified}
            currentProposalId={session.proposalId}
            currentAppName={appName}
            currentConfidence={liveConfidenceScore}
            proposals={proposals}
            loading={loadingProposals}
            onSwitchProposal={switchToProposal}
            onNewProposal={handleNewProposal}
            onSaveEmail={() => {
              setDrawerOpen(false)
              setSaveModalOpen(true)
            }}
            theme={theme}
          />
        </div>
      )}

      {saveModalOpen && session && (
        <SaveForLaterModal
          proposalId={session.proposalId}
          sessionId={session.sessionId}
          projectName={appName || undefined}
          onClose={handleSaveModalClose}
        />
      )}
    </>
  )
}
