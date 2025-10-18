export const runtime = 'nodejs'

import { NextResponse } from 'next/server'

import { createServerSupabase } from '@/lib/supabase/server'
import type { Database } from '@/types/supabase'

type ProjectStatus = Database['public']['Enums']['project_status']

const PROJECTS = 'projects' as const
const ALLOWED_STATUSES = [
  'Backlog',
  'Call Arranged',
  'Brief Gathered',
  'Build',
  'Closed'
] as const satisfies ReadonlyArray<ProjectStatus>
const STATUS_FILTER = `(${ALLOWED_STATUSES.map((status) => `"${status}"`).join(',')})`

export async function GET() {
  const supabase = createServerSupabase()
  const {
    data: { session }
  } = await supabase.auth.getSession()
  const user = session?.user ?? null
  const sel =
    'id,name,status,value_quote,due_date,created_at,labels,tags,clients:client_id(id,name),assignee_profile:assignee_profile_id(id,full_name)'
  const { data, error } = await supabase
    .from(PROJECTS)
    .select(sel)
    .filter('status', 'in', STATUS_FILTER)
    .order('created_at', { ascending: false })
  return NextResponse.json({
    auth: { uid: user?.id ?? null, hasSession: !!session },
    result: { rows: data?.length ?? 0, error: error?.message ?? null },
    firstRow: data?.[0] ?? null
  })
}
