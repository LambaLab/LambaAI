import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: proposalId } = await params
  const supabase = createServiceClient()

  const { data: proposal } = await supabase
    .from('proposals')
    .select('id, session_id, user_id, brief, email, modules, confidence_score')
    .eq('id', proposalId)
    .single()

  // Only restore proposals that have a verified email
  if (!proposal || !proposal.email) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

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

  return NextResponse.json({
    proposalId: proposal.id,
    sessionId: proposal.session_id,
    userId: proposal.user_id ?? '',
    brief: proposal.brief,
    email: proposal.email,
    modules: Array.isArray(proposal.modules) ? proposal.modules : [],
    confidenceScore: typeof proposal.confidence_score === 'number' ? proposal.confidence_score : 0,
    messages,
  })
}
