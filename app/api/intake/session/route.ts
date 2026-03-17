import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  // Use the service client for everything — this avoids overwriting the
  // browser's auth cookies (which would sign out an admin testing in the
  // same browser).
  const supabase = createServiceClient()

  // Create an anonymous Supabase auth user (service-side, no cookies touched)
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email_confirm: true,
    // Anonymous user — no email, no password
    user_metadata: { anonymous: true },
  })
  if (authError || !authData.user) {
    return NextResponse.json({ error: 'Failed to create session' }, { status: 500 })
  }

  const userId = authData.user.id

  const body = await req.json().catch(() => ({} as Record<string, unknown>))
  const email = typeof body.email === 'string' && body.email ? body.email : null

  // Create session row (service client bypasses RLS)
  const { data: session, error: sessionError } = await supabase
    .from('sessions')
    .insert({ user_id: userId })
    .select()
    .single()

  if (sessionError || !session) {
    // Clean up orphaned auth user
    await supabase.auth.admin.deleteUser(userId)
    return NextResponse.json({ error: 'Failed to create session record' }, { status: 500 })
  }

  // Create initial proposal for this session
  const { data: proposal, error: proposalError } = await supabase
    .from('proposals')
    .insert({
      session_id: session.id,
      user_id: userId,
      ...(email ? { email, saved_at: new Date().toISOString() } : {}),
    })
    .select()
    .single()

  if (proposalError || !proposal) {
    await supabase.auth.admin.deleteUser(userId)
    return NextResponse.json({ error: 'Failed to create proposal' }, { status: 500 })
  }

  return NextResponse.json({
    sessionId: session.id,
    proposalId: proposal.id,
    userId,
  })
}
