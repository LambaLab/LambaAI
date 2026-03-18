import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

/**
 * Lightweight endpoint to sync proposal metadata (confidence, modules, brief)
 * to Supabase without requiring email verification. This ensures proposals
 * appear in the admin dashboard as soon as the AI starts analyzing them.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const { sessionId, confidenceScore, modules, brief, metadata } = await req.json()

  if (!sessionId) {
    return NextResponse.json({ error: 'Missing sessionId' }, { status: 400 })
  }

  const supabase = createServiceClient()

  // Validate ownership
  const { data: proposal } = await supabase
    .from('proposals')
    .select('id')
    .eq('id', id)
    .eq('session_id', sessionId)
    .single()

  if (!proposal) {
    return NextResponse.json({ error: 'Invalid proposal or session' }, { status: 404 })
  }

  const update: Record<string, unknown> = {}
  if (typeof confidenceScore === 'number') update.confidence_score = confidenceScore
  if (Array.isArray(modules)) update.modules = modules
  if (typeof brief === 'string' && brief) update.brief = brief
  if (metadata && typeof metadata === 'object') update.metadata = metadata

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ success: true })
  }

  const { error } = await supabase
    .from('proposals')
    .update(update)
    .eq('id', id)

  if (error) {
    console.error('sync-metadata error:', error)
    return NextResponse.json({ error: 'Failed to sync' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
