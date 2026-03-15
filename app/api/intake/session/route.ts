import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, createServiceClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient()

  // Sign in anonymously — creates a real Supabase user with UUID
  const { data: authData, error: authError } = await supabase.auth.signInAnonymously()
  if (authError || !authData.user) {
    return NextResponse.json({ error: 'Failed to create session' }, { status: 500 })
  }

  const userId = authData.user.id

  const body = await req.json().catch(() => ({} as Record<string, unknown>))
  const email = typeof body.email === 'string' && body.email ? body.email : null

  // Create session row
  const { data: session, error: sessionError } = await supabase
    .from('sessions')
    .insert({ user_id: userId })
    .select()
    .single()

  if (sessionError || !session) {
    // Clean up orphaned auth user
    const adminClient = await createServiceClient()
    await adminClient.auth.admin.deleteUser(userId)
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
    // Clean up orphaned auth user
    const adminClient = await createServiceClient()
    await adminClient.auth.admin.deleteUser(userId)
    return NextResponse.json({ error: 'Failed to create proposal' }, { status: 500 })
  }

  return NextResponse.json({
    sessionId: session.id,
    proposalId: proposal.id,
    userId,
  })
}
