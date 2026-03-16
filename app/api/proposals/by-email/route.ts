import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const proposalId = req.nextUrl.searchParams.get('proposalId')
  if (!proposalId) {
    return NextResponse.json({ error: 'Missing proposalId' }, { status: 400 })
  }

  const supabase = await createServiceClient()

  // Look up the anchor proposal to get its email
  const { data: anchor } = await supabase
    .from('proposals')
    .select('email')
    .eq('id', proposalId)
    .single()

  if (!anchor?.email) {
    return NextResponse.json({ error: 'Proposal not found or no email' }, { status: 404 })
  }

  // Fetch all proposals for that email
  const { data: proposals, error } = await supabase
    .from('proposals')
    .select('id, confidence_score, saved_at, metadata, slug')
    .eq('email', anchor.email)
    .order('saved_at', { ascending: false, nullsFirst: false })

  if (error) {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }

  return NextResponse.json({
    email: anchor.email,
    proposals: (proposals ?? []).map((p) => {
      const meta = (p.metadata && typeof p.metadata === 'object' && !Array.isArray(p.metadata))
        ? (p.metadata as Record<string, unknown>)
        : null
      return {
        id: p.id,
        projectName: (meta?.projectName as string) || 'Untitled Proposal',
        confidenceScore: p.confidence_score ?? 0,
        savedAt: p.saved_at,
        slug: (p as Record<string, unknown>).slug ?? null,
      }
    }),
  })
}
