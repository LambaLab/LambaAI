import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, createServiceClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const proposalId = requestUrl.searchParams.get('proposalId')
  const sessionId = requestUrl.searchParams.get('sessionId')

  if (!code || !proposalId || !sessionId) {
    console.error('Auth callback: missing params', { code: !!code, proposalId, sessionId })
    return NextResponse.redirect(new URL('/?error=auth_failed', requestUrl.origin))
  }

  const supabase = await createServerSupabaseClient()

  // Exchange the PKCE code for a session
  const { data, error } = await supabase.auth.exchangeCodeForSession(code)

  if (error || !data.user) {
    console.error('Auth callback: exchange failed', error)
    return NextResponse.redirect(new URL('/?error=auth_failed', requestUrl.origin))
  }

  // Validate proposal belongs to this session and link to user
  const serviceClient = createServiceClient()

  const { data: proposal } = await serviceClient
    .from('proposals')
    .select('id, session_id')
    .eq('id', proposalId)
    .eq('session_id', sessionId)
    .single()

  if (!proposal) {
    console.error('Auth callback: proposal not found or session mismatch')
    return NextResponse.redirect(new URL('/?error=proposal_not_found', requestUrl.origin))
  }

  const { error: updateError, count } = await serviceClient
    .from('proposals')
    .update({ user_id: data.user.id, status: 'pending_review' }, { count: 'exact' })
    .eq('id', proposalId)
    .eq('session_id', sessionId)
    .is('user_id', null)

  if (updateError) {
    console.error('Auth callback: proposal update failed', updateError)
    return NextResponse.redirect(new URL('/?error=update_failed', requestUrl.origin))
  }

  if (count === 0) {
    // Proposal already claimed
    return NextResponse.redirect(new URL(`/proposal/${proposalId}?status=pending`, requestUrl.origin))
  }

  return NextResponse.redirect(new URL(`/proposal/${proposalId}?status=pending`, requestUrl.origin))
}
