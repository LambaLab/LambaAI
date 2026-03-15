import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

type MessageInput = { role: 'user' | 'assistant'; content: string }

export async function POST(req: NextRequest) {
  const { proposalId, sessionId, messages, brief, modules, confidenceScore } = await req.json()

  if (!proposalId || !sessionId || !Array.isArray(messages)) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }

  const supabase = createServiceClient()

  // Validate ownership — same pattern as send-otp
  const { data: proposal } = await supabase
    .from('proposals')
    .select('id')
    .eq('id', proposalId)
    .eq('session_id', sessionId)
    .single()

  if (!proposal) {
    return NextResponse.json({ error: 'Invalid proposal or session' }, { status: 404 })
  }

  if (messages.length > 0) {
    const rows = (messages as MessageInput[]).map((m) => ({
      proposal_id: proposalId,
      role: m.role,
      content: m.content,
    }))

    const { error } = await supabase.from('chat_messages').insert(rows)
    if (error) {
      console.error('sync-messages insert error:', error)
      return NextResponse.json({ error: 'Failed to save messages' }, { status: 500 })
    }
  }

  // Bump saved_at and persist proposal metadata so cross-device restore works
  const proposalUpdate: Record<string, unknown> = { saved_at: new Date().toISOString() }
  if (typeof brief === 'string' && brief) proposalUpdate.brief = brief
  if (Array.isArray(modules)) proposalUpdate.modules = modules
  if (typeof confidenceScore === 'number') proposalUpdate.confidence_score = confidenceScore

  const { error: updateError } = await supabase
    .from('proposals')
    .update(proposalUpdate)
    .eq('id', proposalId)

  if (updateError) {
    console.error('sync-messages saved_at update error:', updateError)
    return NextResponse.json({ error: 'Failed to update saved_at' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
