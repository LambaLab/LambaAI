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
