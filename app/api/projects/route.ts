import { NextResponse } from 'next/server'

import type { Database } from '@/types/supabase'

import { getAccessContext, HttpError } from '../_lib/access'

const PROJECTS = 'projects' as const

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type ProjectRow = Database['public']['Tables']['projects']['Row']

type ProjectListRow = ProjectRow & {
  clients: Pick<Database['public']['Tables']['clients']['Row'], 'id' | 'name'> | null
  assignee_profile: Pick<Database['public']['Tables']['profiles']['Row'], 'id' | 'full_name'> | null
}

export async function GET() {
  try {
    const { supabase, role, clientMemberships } = await getAccessContext({
      allowEmptyClientMemberships: true,
    })

    if (role === 'client' && clientMemberships.length === 0) {
      return NextResponse.json({ projects: [] })
    }

    let query = supabase
      .from(PROJECTS)
      .select(
        `
          id,
          name,
          status,
          description,
          due_date,
          created_at,
          clients:client_id ( id, name ),
          assignee_profile:assignee_profile_id ( id, full_name )
        `,
      )
      .order('created_at', { ascending: false })

    if (role === 'client') {
      query = query.in('client_id', clientMemberships)
    }

    const { data, error } = await query.returns<ProjectListRow[] | null>()

    if (error) {
      console.error('projects list query error:', error)
      return NextResponse.json({ message: 'Unable to load projects.' }, { status: 500 })
    }

    const projectRows = Array.isArray(data) ? (data as ProjectListRow[]) : []

    const projects = projectRows.map(({ clients, assignee_profile, ...rest }) => ({
      ...rest,
      client: clients ?? null,
      assignee: assignee_profile ?? null,
    }))

    return NextResponse.json({ projects })
  } catch (error) {
    if (error instanceof HttpError) {
      return NextResponse.json({ message: error.message }, { status: error.status })
    }

    console.error('projects list unexpected error:', error)
    return NextResponse.json({ message: 'Unable to load projects.' }, { status: 500 })
  }
}
