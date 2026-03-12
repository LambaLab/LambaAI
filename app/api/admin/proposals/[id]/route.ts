import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, createServiceClient } from '@/lib/supabase/server'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userSupabase = await createServerSupabaseClient()
  const { data: { user } } = await userSupabase.auth.getUser()
  const adminEmails = (process.env.ADMIN_EMAILS ?? '').split(',').map((e) => e.trim()).filter(Boolean)
  if (!user || !adminEmails.includes(user.email ?? '')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const supabase = await createServiceClient()
  const { id } = await params
  const updates = await req.json()

  const allowedFields = ['modules', 'price_min', 'price_max', 'admin_notes', 'status']
  const filteredUpdates = Object.fromEntries(
    Object.entries(updates).filter(([key]) => allowedFields.includes(key))
  )

  const { data, error } = await supabase
    .from('proposals')
    .update(filteredUpdates)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
