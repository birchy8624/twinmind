import { NextResponse } from 'next/server'

import type { Database } from '@/types/supabase'

import { getAccessContext, HttpError } from '../../_lib/access'

const PROJECTS = 'projects' as const
const PIPELINE_STATUSES: Database['public']['Enums']['project_status'][] = [
  'Backlog',
  'Call Arranged',
  'Brief Gathered',
  'Build',
  'Closed',
]

export const runtime = 'nodejs'

type KanbanProjectRow = Database['public']['Tables']['projects']['Row'] & {
  clients: Pick<Database['public']['Tables']['clients']['Row'], 'id' | 'name'> | null
  assignee_profile: Pick<Database['public']['Tables']['profiles']['Row'], 'id' | 'full_name'> | null
}

type KanbanProjectsResponse = { projects: KanbanProjectRow[] }

export async function GET() {
  try {
    const { supabase, role, clientMemberships } = await getAccessContext({
      allowEmptyClientMemberships: true,
    })

    if (role === 'client' && clientMemberships.length === 0) {
      return NextResponse.json<KanbanProjectsResponse>({ projects: [] })
    }

    let query = supabase
      .from(PROJECTS)
      .select(
        `
          id,
          name,
          status,
          value_quote,
          due_date,
          created_at,
          labels,
          tags,
          client_id,
          clients:client_id ( id, name ),
          assignee_profile:assignee_profile_id ( id, full_name )
        `,
      )
      .in('status', PIPELINE_STATUSES)
      .order('created_at', { ascending: false })

    if (role === 'client') {
      query = query.in('client_id', clientMemberships)
    }

    const { data, error } = await query

    if (error) {
      console.error('kanban projects query error:', error)
      return NextResponse.json({ message: 'Unable to load projects.' }, { status: 500 })
    }

    const projects = Array.isArray(data)
      ? (data as KanbanProjectRow[]).filter((project): project is KanbanProjectRow => typeof project?.id === 'string')
      : []

    return NextResponse.json<KanbanProjectsResponse>({ projects })
  } catch (error) {
    if (error instanceof HttpError) {
      return NextResponse.json({ message: error.message }, { status: error.status })
    }

    console.error('kanban projects unexpected error:', error)
    return NextResponse.json({ message: 'Unable to load projects.' }, { status: 500 })
  }
}
