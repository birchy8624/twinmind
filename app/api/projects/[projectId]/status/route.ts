import { NextResponse } from 'next/server'

import type { Database } from '@/types/supabase'

import { getAccessContext, HttpError } from '../../../_lib/access'

const PROJECTS = 'projects' as const

const PIPELINE_STATUSES: Database['public']['Enums']['project_status'][] = [
  'Backlog',
  'Call Arranged',
  'Brief Gathered',
  'Build',
  'Closed',
]

export const runtime = 'nodejs'

type UpdateStatusPayload = {
  status?: Database['public']['Enums']['project_status']
}

type UpdatedProjectResponse = {
  project: { id: string; status: Database['public']['Enums']['project_status'] }
}

function isValidStatus(value: string | undefined): value is Database['public']['Enums']['project_status'] {
  if (!value) {
    return false
  }

  return PIPELINE_STATUSES.includes(value as Database['public']['Enums']['project_status'])
}

export async function PATCH(request: Request, context: { params: { projectId: string } }) {
  const projectId = context.params.projectId

  let payload: UpdateStatusPayload
  try {
    payload = (await request.json()) as UpdateStatusPayload
  } catch (error) {
    console.error('project status update parse error:', error)
    return NextResponse.json({ message: 'Invalid request body.' }, { status: 400 })
  }

  if (!isValidStatus(payload.status)) {
    return NextResponse.json({ message: 'Invalid project status.' }, { status: 400 })
  }

  try {
    const { supabase, role, clientMemberships } = await getAccessContext()

    let updateQuery = supabase
      .from(PROJECTS)
      .update({ status: payload.status })
      .eq('id', projectId)

    if (role === 'client') {
      updateQuery = updateQuery.in('client_id', clientMemberships)
    }

    const { data, error } = await updateQuery
      .select('id, status')
      .maybeSingle<{ id: string; status: Database['public']['Enums']['project_status'] }>()

    if (error) {
      console.error('project status update error:', error)
      return NextResponse.json({ message: 'Unable to update project.' }, { status: 500 })
    }

    if (!data) {
      return NextResponse.json({ message: 'Project not found.' }, { status: 404 })
    }

    return NextResponse.json<UpdatedProjectResponse>({ project: data })
  } catch (error) {
    if (error instanceof HttpError) {
      return NextResponse.json({ message: error.message }, { status: error.status })
    }

    console.error('project status update unexpected error:', error)
    return NextResponse.json({ message: 'Unable to update project.' }, { status: 500 })
  }
}
