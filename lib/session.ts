const SESSION_KEY = 'lamba_session'

export type SessionData = {
  sessionId: string
  proposalId: string
  userId: string
}

function isValidSession(data: unknown): data is SessionData {
  return (
    typeof data === 'object' &&
    data !== null &&
    typeof (data as SessionData).sessionId === 'string' &&
    typeof (data as SessionData).proposalId === 'string' &&
    typeof (data as SessionData).userId === 'string'
  )
}

export function getStoredSession(): SessionData | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return isValidSession(parsed) ? parsed : null
  } catch {
    return null
  }
}

export function storeSession(data: SessionData) {
  if (typeof window === 'undefined') return
  localStorage.setItem(SESSION_KEY, JSON.stringify(data))
}

export function storeIdeaForSession(proposalId: string, idea: string): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(`lamba_idea_${proposalId}`, idea)
}

export function getIdeaForSession(proposalId: string): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(`lamba_idea_${proposalId}`)
}

// In-flight guard — prevents concurrent API calls (e.g. React StrictMode double-fire)
let inflightPromise: Promise<SessionData> | null = null

// Retry up to 3 attempts with exponential backoff (800ms, 1600ms) before throwing
async function createNewSession(attempt = 1): Promise<SessionData> {
  const res = await fetch('/api/intake/session', { method: 'POST' })
  if (!res.ok) {
    if (attempt < 3) {
      await new Promise(r => setTimeout(r, 800 * attempt))
      return createNewSession(attempt + 1)
    }
    throw new Error('Failed to create session')
  }
  const data: SessionData = await res.json()
  storeSession(data)
  return data
}

export async function getOrCreateSession(): Promise<SessionData> {
  const stored = getStoredSession()
  if (stored) return stored

  // Deduplicate: if a creation request is already in-flight, reuse it
  if (inflightPromise) return inflightPromise

  inflightPromise = createNewSession().finally(() => {
    inflightPromise = null
  })
  return inflightPromise
}

/**
 * Hydrate localStorage with a restore response so useIntakeChat can load it.
 * Used by both HeroSection (cross-device restore) and IntakeOverlay (proposal switching).
 */
export function hydrateProposalFromRestore(data: {
  proposalId: string
  sessionId: string
  userId?: string
  brief?: string
  email?: string | null
  modules?: unknown[]
  confidenceScore?: number
  messages?: { role: string; content: string; question?: string; quickReplies?: unknown }[]
  metadata?: Record<string, unknown> | null
}): void {
  if (typeof window === 'undefined') return

  storeSession({
    sessionId: data.sessionId,
    proposalId: data.proposalId,
    userId: data.userId ?? '',
  })
  storeIdeaForSession(data.proposalId, data.brief || '')

  const meta = data.metadata && typeof data.metadata === 'object' ? data.metadata : {} as Record<string, unknown>

  localStorage.setItem(
    `lamba_proposal_${data.proposalId}`,
    JSON.stringify({
      activeModules: Array.isArray(data.modules) ? data.modules : [],
      confidenceScore: typeof data.confidenceScore === 'number' ? data.confidenceScore : 0,
      complexityMultiplier: 1.0,
      productOverview: meta.productOverview || '',
      moduleSummaries: meta.moduleSummaries || {},
      projectName: meta.projectName || '',
      brief: data.brief || '',
    })
  )

  if (meta.projectName) {
    localStorage.setItem('lamba_app_name', String(meta.projectName))
  }

  // Attach last QR state to the final assistant message so the card renders on restore.
  // Guard: only attach if options are populated — skeleton QR ({ style: 'list', options: [] })
  // can get persisted if the user navigated away mid-stream; attaching it would show an
  // eternal skeleton card with no rows.
  const qr = meta.lastQuickReplies as Record<string, unknown> | undefined
  const qrHasOptions = qr && Array.isArray(qr.options) && qr.options.length > 0
  if (qrHasOptions && Array.isArray(data.messages) && data.messages.length > 0) {
    for (let i = data.messages.length - 1; i >= 0; i--) {
      if (data.messages[i].role === 'assistant') {
        data.messages[i].question = (meta.lastQuestion as string) || undefined
        data.messages[i].quickReplies = meta.lastQuickReplies
        break
      }
    }
  }
  if (Array.isArray(data.messages) && data.messages.length > 0) {
    localStorage.setItem(`lamba_msgs_${data.proposalId}`, JSON.stringify(data.messages))
  }

  if (data.email) {
    localStorage.setItem(`lamba_email_verified_${data.proposalId}`, '1')
  }
  localStorage.setItem(
    `lamba_synced_count_${data.proposalId}`,
    String(data.messages?.length ?? 0)
  )
}

/** Remove all localStorage keys for a given proposal. */
export function clearProposalData(proposalId: string): void {
  if (typeof window === 'undefined') return
  const keys = [
    `lamba_idea_${proposalId}`,
    `lamba_msgs_${proposalId}`,
    `lamba_proposal_${proposalId}`,
    `lamba_email_verified_${proposalId}`,
    `lamba_synced_count_${proposalId}`,
    `lamba_paused_${proposalId}`,
    `lamba_paused_qr_${proposalId}`,
  ]
  keys.forEach((k) => localStorage.removeItem(k))
}
