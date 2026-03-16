import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: proposalId } = await params
  const supabase = createServiceClient()

  const { data: proposal, error: proposalError } = await supabase
    .from('proposals')
    .select('id, session_id, user_id, brief, email, modules, confidence_score, metadata, slug')
    .eq('id', proposalId)
    .single()

  if (proposalError && proposalError.code !== 'PGRST116') {
    console.error('[restore] proposal fetch error:', proposalError)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
  if (!proposal) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const { data: dbMessages, error: messagesError } = await supabase
    .from('chat_messages')
    .select('role, content')
    .eq('proposal_id', proposalId)
    .order('created_at', { ascending: true })

  if (messagesError) {
    console.error('[restore] messages fetch error:', messagesError)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }

  const messages = (dbMessages ?? []).map((m) => ({
    id: crypto.randomUUID(),
    role: m.role as 'user' | 'assistant',
    content: m.content,
  }))

  // brief may be null if it was never persisted — fall back to first user message
  const brief = proposal.brief
    || messages.find((m) => m.role === 'user')?.content
    || ''

  // Parse metadata blob (projectName, productOverview, moduleSummaries, lastQR)
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
  })
}
