export const runtime = 'nodejs'

import { NextResponse } from 'next/server'

import { createServerSupabase } from '@/lib/supabase/server'

export async function GET() {
  const supabase = createServerSupabase()
  const {
    data: { user, session }
  } = await supabase.auth.getSession()
  const PROJECTS = 'projects' as const
  const sel =
    'id,name,status,value_quote,due_date,created_at,labels,tags,clients:client_id(id,name),assignee_profile:assignee_profile_id(id,full_name)'
  const { data, error } = await supabase
    .from(PROJECTS)
    .select(sel)
    .in('status', ['Backlog', 'Call Arranged', 'Brief Gathered', 'Build', 'Closed'])
    .order('created_at', { ascending: false })
  return NextResponse.json({
    auth: { uid: user?.id ?? null, hasSession: !!session },
    result: { rows: data?.length ?? 0, error: error?.message ?? null },
    firstRow: data?.[0] ?? null
  })
}
