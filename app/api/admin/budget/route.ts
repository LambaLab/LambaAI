import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin } from '@/lib/admin/auth'
import { createServiceClient } from '@/lib/supabase/server'
import { resend, FROM_EMAIL } from '@/lib/email/resend'
import { buildBudgetProposedEmail } from '@/lib/email/templates/budget-proposed'

export async function POST(req: NextRequest) {
  const auth = await verifyAdmin()
  if (!auth.admin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { proposalId, amount, clientNotes, internalNotes } = await req.json()

  if (!proposalId || !amount || amount <= 0) {
    return NextResponse.json({ error: 'Missing proposalId or valid amount' }, { status: 400 })
  }

  const supabase = createServiceClient()

  // Create budget proposal
  const { data: budget, error: budgetError } = await supabase
    .from('budget_proposals')
    .insert({
      proposal_id: proposalId,
      amount,
      client_notes: clientNotes,
      internal_notes: internalNotes,
    })
    .select()
    .single()

  if (budgetError) {
    return NextResponse.json({ error: budgetError.message }, { status: 500 })
  }

  // Update proposal status
  await supabase
    .from('proposals')
    .update({ status: 'budget_proposed' })
    .eq('id', proposalId)

  // Send email notification if email exists
  const { data: proposal } = await supabase
    .from('proposals')
    .select('email, slug, metadata')
    .eq('id', proposalId)
    .single()

  if (proposal?.email) {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://lambalab.com'
    const slug = proposal.slug ?? proposalId
    const meta = (proposal.metadata ?? {}) as Record<string, unknown>
    const projectName = (meta.projectName as string) ?? 'Your project'
    const budgetUrl = `${appUrl}/proposal/${slug}/budget`

    const { subject, html } = buildBudgetProposedEmail({
      amount,
      projectName,
      clientNotes,
      budgetUrl,
    })

    await resend.emails.send({
      from: FROM_EMAIL,
      to: proposal.email,
      subject,
      html,
    })
  }

  return NextResponse.json(budget)
}
