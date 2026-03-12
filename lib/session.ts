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
    const raw = sessionStorage.getItem(SESSION_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return isValidSession(parsed) ? parsed : null
  } catch {
    return null
  }
}

export function storeSession(data: SessionData) {
  if (typeof window === 'undefined') return
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(data))
}

export async function getOrCreateSession(): Promise<SessionData> {
  const stored = getStoredSession()
  if (stored) return stored

  const res = await fetch('/api/intake/session', { method: 'POST' })
  if (!res.ok) throw new Error('Failed to create session')
  const data: SessionData = await res.json()
  storeSession(data)
  return data
}
