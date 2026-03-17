'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { CloudCheck, Menu, Minus, Sun, Moon, X } from 'lucide-react'
import { useTheme } from '@/hooks/useTheme'
import IntakeLayout from './IntakeLayout'
import MinimizedBar from './MinimizedBar'
import SaveForLaterModal from './SaveForLaterModal'
import ProposalDrawer, { type ProposalSummary } from './ProposalDrawer'
import {
  getOrCreateSession,
  getStoredSession,
  storeIdeaForSession,
  storeSession,
  hydrateProposalFromRestore,
  getIdeaForSession,
  clearProposalData,
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
  // Start mounted=true for returning users so the overlay is opaque on the
  // very first frame (no flash of the homepage behind the transparent overlay).
  // New users (no stored session) get the fade-in animation.
  const [mounted, setMounted] = useState(() => {
    if (typeof window === 'undefined') return false
    try { return !!getStoredSession() } catch { return false }
  })
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
  const [currentSlug, setCurrentSlug] = useState<string | null>(null)
  const cachedEmailRef = useRef<string | null>(null)
  const [showSaved, setShowSaved] = useState(false)
  const lastSyncedAtRef = useRef<number | null>(null)
  const [switchingProposal, setSwitchingProposal] = useState(false)

  const updateSlug = useCallback(async (proposalId: string, name: string) => {
    try {
      const res = await fetch(`/api/proposals/${proposalId}/slug`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      })
      if (!res.ok) return null
      const { slug } = await res.json()
      setCurrentSlug(slug)
      window.history.replaceState(null, '', `/proposal/${slug}`)
      return slug
    } catch {
      return null
    }
  }, [])

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
    if (session) {
      updateSlug(session.proposalId, trimmed)
    }
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
      window.history.replaceState(null, '', `/?c=${data.proposalId}`)
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
      cachedEmailRef.current = data.email ?? null
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
    // Show loader immediately — don't stay on old proposal
    setSwitchingProposal(true)
    try {
      // Preserve local messages — they have full fidelity (QR, isPause, question fields)
      // that the API restore doesn't carry. Only fall back to API messages if no local data.
      const existingLocalMsgs = localStorage.getItem(`lamba_msgs_${targetId}`)
      const existingProposalState = localStorage.getItem(`lamba_proposal_${targetId}`)

      const res = await fetch(`/api/proposals/${targetId}/restore`)
      if (!res.ok) throw new Error('Failed to restore')
      const data = await res.json()

      // Hydrate all localStorage keys for the target proposal
      hydrateProposalFromRestore(data)

      // If we had local messages with richer data (QR, isPause, etc.), restore them
      // over the degraded API data
      if (existingLocalMsgs) {
        localStorage.setItem(`lamba_msgs_${targetId}`, existingLocalMsgs)
      }
      if (existingProposalState) {
        localStorage.setItem(`lamba_proposal_${targetId}`, existingProposalState)
      }

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
      const targetSlug = (data as Record<string, unknown>).slug as string | null
      setCurrentSlug(targetSlug ?? null)
      window.history.replaceState(null, '', targetSlug ? `/proposal/${targetSlug}` : `/?c=${targetId}`)

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
    } finally {
      setSwitchingProposal(false)
    }
  }, [session])

  // ── Create a new proposal ──
  const handleNewProposal = useCallback(async () => {
    if (!session) return

    // ① Instant UI reset — synchronous, before any await
    setDrawerOpen(false)
    setAppName('')
    setNameInputValue('')
    setLiveConfidenceScore(0)
    setLiveModuleCount(0)
    setCurrentIdea('')
    setProposalOpen(false)
    setCurrentSlug(null)
    nameManuallyEditedRef.current = false
    localStorage.removeItem('lamba_app_name')

    // ② Temporary session — triggers immediate remount with blank chat
    const tempId = crypto.randomUUID()
    const tempSession: SessionData = { proposalId: tempId, sessionId: tempId, userId: '' }
    window.history.replaceState(null, '', '/?c=' + tempId)
    setSession(tempSession)

    // ③ Real session creation in background
    try {
      const email = cachedEmailRef.current || undefined
      const res = await fetch('/api/intake/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(email ? { email } : {}),
      })
      if (!res.ok) throw new Error('Failed to create session')
      const newSessionData: SessionData = await res.json()
      storeSession(newSessionData)

      if (email) {
        localStorage.setItem(`lamba_email_verified_${newSessionData.proposalId}`, '1')
        setEmailVerified(true)
      }

      // Swap temp → real (move any localStorage data the hook may have stored under tempId)
      const tempMsgs = localStorage.getItem(`lamba_msgs_${tempId}`)
      if (tempMsgs) {
        localStorage.setItem(`lamba_msgs_${newSessionData.proposalId}`, tempMsgs)
        localStorage.removeItem(`lamba_msgs_${tempId}`)
      }
      const tempProposal = localStorage.getItem(`lamba_proposal_${tempId}`)
      if (tempProposal) {
        localStorage.setItem(`lamba_proposal_${newSessionData.proposalId}`, tempProposal)
        localStorage.removeItem(`lamba_proposal_${tempId}`)
      }

      window.history.replaceState(null, '', '/?c=' + newSessionData.proposalId)
      setCurrentSlug(null)
      setSession(newSessionData)

      if (email) {
        fetchProposals(newSessionData.proposalId)
      }
    } catch (err) {
      console.error('Failed to create new proposal:', err)
    }
  }, [session, fetchProposals])

  // ── Delete a proposal ──
  const handleDeleteProposal = useCallback(async (targetId: string) => {
    if (!session) return
    try {
      const res = await fetch(`/api/proposals/${targetId}/delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: session.sessionId }),
      })
      if (!res.ok) throw new Error('Delete failed')

      // Remove from local state
      setProposals(prev => prev.filter(p => p.id !== targetId))
      // Clear localStorage for deleted proposal
      clearProposalData(targetId)

      // If we deleted the current proposal, switch to first remaining or create new
      if (targetId === session.proposalId) {
        const remaining = proposals.filter(p => p.id !== targetId)
        if (remaining.length > 0) {
          switchToProposal(remaining[0].id)
        } else {
          handleNewProposal()
        }
      }
    } catch (err) {
      console.error('Failed to delete proposal:', err)
    }
  }, [session, proposals, switchToProposal, handleNewProposal])

  const handleStateChange = useCallback((m: number, c: number, pName?: string, syncedAt?: number | null) => {
    setLiveModuleCount(m)
    setLiveConfidenceScore(c)
    // Auto-update the app name with the AI-generated project name —
    // but only if the user hasn't manually set their own name
    if (pName && pName.trim() && !nameManuallyEditedRef.current) {
      setAppName(pName.trim())
      setNameInputValue(pName.trim())
      // Generate/update slug when AI provides a project name
      if (session) {
        updateSlug(session.proposalId, pName.trim())
      }
    }
    if (syncedAt && syncedAt !== lastSyncedAtRef.current) {
      lastSyncedAtRef.current = syncedAt
      setShowSaved(true)
    }
  }, [session, updateSlug])

  useEffect(() => {
    if (!showSaved) return
    const timer = setTimeout(() => setShowSaved(false), 2500)
    return () => clearTimeout(timer)
  }, [showSaved])

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
        window.history.replaceState(null, '', `/?c=${data.proposalId}`)
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
      // Reset URL to "/" so the address bar shows the homepage
      window.history.replaceState(null, '', '/')
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
          onExpand={() => {
            setMinimized(false)
            // Restore the proposal URL when expanding back
            if (currentSlug) {
              window.history.replaceState(null, '', `/proposal/${currentSlug}`)
            }
          }}
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
                  className={`font-bebas text-xl tracking-widest cursor-pointer group flex items-center gap-1.5 transition-all
                    ${appName
                      ? 'text-[var(--ov-text,#ffffff)] hover:opacity-75'
                      : 'text-[var(--ov-text-muted,#727272)] border-b border-dashed border-[var(--ov-text-muted,rgba(114,114,114,0.4))] pb-0.5'
                    }`}
                  title="Click to rename"
                >
                  {appName ? appName.toUpperCase() : 'UNTITLED PROPOSAL'}
                  <span className={`transition-opacity text-[10px] text-[var(--ov-text-muted,#727272)] font-sans tracking-normal normal-case leading-none
                    ${appName ? 'opacity-0 group-hover:opacity-100' : 'opacity-60'}`}>✎</span>
                </button>
              )}
              {emailVerified && (
                <span
                  className={`ml-2 flex items-center transition-colors duration-300 relative group/cloud
                    ${showSaved ? 'text-green-500' : 'text-[var(--ov-text-muted,#727272)]'}`}
                  title="Auto-saved"
                >
                  <CloudCheck className="w-4 h-4" />
                  <span className="absolute left-1/2 -translate-x-1/2 top-full mt-1.5 px-2 py-1 rounded text-[10px] whitespace-nowrap opacity-0 group-hover/cloud:opacity-100 transition-opacity pointer-events-none bg-[#333] text-white">
                    Auto-saved
                  </span>
                </span>
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

          {/* Loading overlay when switching proposals */}
          {switchingProposal && (
            <div className="absolute inset-0 z-30 flex items-center justify-center bg-[var(--ov-bg,#1d1d1d)]/80 backdrop-blur-sm">
              <div className="flex flex-col items-center gap-3">
                <div className="w-6 h-6 border-2 border-[var(--ov-text-muted,#727272)] border-t-[var(--ov-accent-strong,#fffc00)] rounded-full animate-spin" />
                <span className="text-xs text-[var(--ov-text-muted,#727272)]">Loading proposal…</span>
              </div>
            </div>
          )}

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
            emailVerified={emailVerified}
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
            onDeleteProposal={handleDeleteProposal}
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
