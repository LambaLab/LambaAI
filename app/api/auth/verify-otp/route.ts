import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { resend, FROM_EMAIL } from '@/lib/email/resend'
import { buildConfirmationEmail } from '@/lib/email/templates/confirmation'

export async function POST(req: NextRequest) {
  const { email, otp, proposalId, sessionId, projectName } = await req.json()
  if (!email || !otp || !proposalId || !sessionId) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }

  const supabase = createServiceClient()

  // Look up a valid, unused, unexpired code
  const { data: otpRecord } = await supabase
    .from('otp_codes')
    .select('id, code')
    .eq('email', email)
    .eq('proposal_id', proposalId)
    .eq('session_id', sessionId)
    .eq('used', false)
    .gte('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (!otpRecord) {
    return NextResponse.json({ error: 'Code expired or not found. Request a new one.' }, { status: 400 })
  }

  if (otpRecord.code !== otp) {
    return NextResponse.json({ error: 'Incorrect code. Please try again.' }, { status: 400 })
  }

  // Mark code as used (single-use)
  await supabase.from('otp_codes').update({ used: true }).eq('id', otpRecord.id)

  // Link email to proposal
  const { error: updateError } = await supabase
    .from('proposals')
    .update({ email, saved_at: new Date().toISOString() })
    .eq('id', proposalId)
    .eq('session_id', sessionId)

  if (updateError) {
    console.error('Proposal update error:', updateError)
    return NextResponse.json({ error: 'Failed to save proposal. Please contact support.' }, { status: 500 })
  }

  // Send confirmation email with proposal link
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''
  const proposalUrl = `${appUrl}/?c=${proposalId}`
  const { subject, html } = buildConfirmationEmail({ projectName: projectName ?? '', proposalUrl })

  const { error: emailError } = await resend.emails.send({
    from: FROM_EMAIL,
    to: email,
    subject,
    html,
  })

  if (emailError) {
    // Non-fatal: proposal is saved, email just didn't send
    console.error('Resend confirmation error:', emailError)
  }

  return NextResponse.json({ success: true })
}
