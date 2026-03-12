import { createServiceClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import ProposalView from '@/components/proposal/ProposalView'

export default async function ApprovedProposalPage({ params }: { params: Promise<{ proposalId: string }> }) {
  const { proposalId } = await params
  const supabase = await createServiceClient()

  const { data: proposal } = await supabase
    .from('proposals')
    .select('*')
    .eq('id', proposalId)
    .single()

  if (!proposal) notFound()
  if (proposal.status !== 'approved' && proposal.status !== 'accepted') {
    redirect(`/proposal/${proposalId}`)
  }

  return <ProposalView proposal={proposal} />
}
