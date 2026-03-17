import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

/**
 * POST /api/auth/verify-token
 * Validates a one-time email auth token and returns restore data.
 * Used when a user clicks the proposal link from their email inbox.
 */
export async function POST(req: NextRequest) {
  const { token, proposalId } = await req.json()
  if (!token || !proposalId) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }

  const supabase = createServiceClient()

  // Look up proposal by ID and verify token matches
  const { data: proposal, error } = await supabase
    .from('proposals')
    .select('id, session_id, user_id, brief, email, modules, confidence_score, metadata, slug, email_auth_token, email_auth_token_expires_at')
    .eq('id', proposalId)
    .single()

  if (error || !proposal) {
    return NextResponse.json({ error: 'Proposal not found' }, { status: 404 })
  }

  // Validate token
  if (!proposal.email_auth_token || proposal.email_auth_token !== token) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
  }

  // Check expiry (30-day tokens)
  if (proposal.email_auth_token_expires_at && new Date(proposal.email_auth_token_expires_at) < new Date()) {
    return NextResponse.json({ error: 'Token expired' }, { status: 401 })
  }

  // Token is valid — fetch messages for full restore
  const { data: dbMessages } = await supabase
    .from('chat_messages')
    .select('role, content')
    .eq('proposal_id', proposalId)
    .order('created_at', { ascending: true })

  const messages = (dbMessages ?? []).map((m) => ({
    id: crypto.randomUUID(),
    role: m.role as 'user' | 'assistant',
    content: m.content,
  }))

  const brief = proposal.brief
    || messages.find((m) => m.role === 'user')?.content
    || ''

  const meta = (proposal as Record<string, unknown>).metadata as Record<string, unknown> | null

  return NextResponse.json({
    proposalId: proposal.id,
    sessionId: proposal.session_id,
    userId: proposal.user_id ?? '',
    brief,
    email: proposal.email ?? null,
    modules: Array.isArray(proposal.modules) ? proposal.modules : [],
    confidenceScore: typeof proposal.confidence_score === 'number' ? proposal.confidence_score : 0,
    messages,
    metadata: meta ?? null,
    slug: (proposal as Record<string, unknown>).slug ?? null,
    verified: true, // signals auto-authentication
  })
}
