import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: proposalId } = await params
  const { sessionId } = await req.json()
  if (!proposalId || !sessionId) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }
  const supabase = createServiceClient()

  // Ownership check: caller's session must belong to a proposal with the same email
  const { data: callerProposal } = await supabase
    .from('proposals')
    .select('email')
    .eq('session_id', sessionId)
    .single()

  const { data: target } = await supabase
    .from('proposals')
    .select('email')
    .eq('id', proposalId)
    .single()

  if (!callerProposal?.email || !target?.email || callerProposal.email !== target.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  // Delete related records then proposal (cascade should handle some, but be explicit)
  await supabase.from('chat_messages').delete().eq('proposal_id', proposalId)
  await supabase.from('otp_codes').delete().eq('proposal_id', proposalId)
  await supabase.from('proposal_slug_history').delete().eq('proposal_id', proposalId)
  await supabase.from('proposals').delete().eq('id', proposalId)

  return NextResponse.json({ success: true })
}
