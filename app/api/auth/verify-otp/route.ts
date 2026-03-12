import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, createServiceClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const { email, otp, proposalId, sessionId } = await req.json()
  if (!email || !otp || !proposalId || !sessionId) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }

  // Validate that proposalId belongs to the session before OTP verification
  const serviceClient = await createServiceClient()
  const { data: proposal } = await serviceClient
    .from('proposals')
    .select('id, session_id')
    .eq('id', proposalId)
    .eq('session_id', sessionId)
    .single()

  if (!proposal) {
    return NextResponse.json({ error: 'Invalid session or proposal' }, { status: 403 })
  }

  const supabase = await createServerSupabaseClient()

  const { data, error } = await supabase.auth.verifyOtp({
    email,
    token: otp,
    type: 'email',
  })

  if (error || !data.user) {
    return NextResponse.json({ error: error?.message ?? 'Verification failed' }, { status: 400 })
  }

  // Link proposal to the now-verified user
  const { error: updateError } = await serviceClient
    .from('proposals')
    .update({ user_id: data.user.id, status: 'pending_review' })
    .eq('id', proposalId)
    .eq('session_id', sessionId)

  if (updateError) {
    return NextResponse.json({ error: 'Failed to link proposal. Please contact support.' }, { status: 500 })
  }

  return NextResponse.json({ success: true, userId: data.user.id })
}
