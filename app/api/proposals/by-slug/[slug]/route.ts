import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  const supabase = createServiceClient()

  const { data: proposal } = await supabase
    .from('proposals')
    .select('id, slug')
    .eq('slug', slug)
    .single()

  if (proposal) {
    return NextResponse.json({ proposalId: proposal.id, slug: proposal.slug })
  }

  const { data: history } = await supabase
    .from('proposal_slug_history')
    .select('proposal_id')
    .eq('slug', slug)
    .single()

  if (history) {
    const { data: target } = await supabase
      .from('proposals')
      .select('slug')
      .eq('id', history.proposal_id)
      .single()

    return NextResponse.json({
      redirect: true,
      proposalId: history.proposal_id,
      currentSlug: target?.slug ?? null,
    })
  }

  return NextResponse.json({ error: 'Not found' }, { status: 404 })
}
