import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin } from '@/lib/admin/auth'
import { createServiceClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const auth = await verifyAdmin()
  if (!auth.admin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { proposalId, content } = await req.json()

  if (!proposalId || !content?.trim()) {
    return NextResponse.json({ error: 'Missing proposalId or content' }, { status: 400 })
  }

  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('chat_messages')
    .insert({
      proposal_id: proposalId,
      role: 'admin',
      content: content.trim(),
      metadata: { admin_email: auth.email },
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}
