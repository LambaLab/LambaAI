import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const { email, otp, proposalId } = await req.json()
  if (!email || !otp || !proposalId) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
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
  const { error: updateError } = await supabase
    .from('proposals')
    .update({ user_id: data.user.id, status: 'pending_review' })
    .eq('id', proposalId)

  if (updateError) {
    console.error('Proposal link error:', updateError)
    // Non-fatal — proposal still submitted
  }

  return NextResponse.json({ success: true, userId: data.user.id })
}
