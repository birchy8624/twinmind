import { NextResponse } from 'next/server'

import type { Database } from '@/types/supabase'

import { getAccessContext, HttpError } from '../../../_lib/access'

const BRIEFS = 'briefs' as const
const PROJECTS = 'projects' as const

export const runtime = 'nodejs'

type BriefAnswers = Database['public']['Tables']['briefs']['Row']['answers']

type BriefPayload = {
  answers: BriefAnswers
}

async function ensureProjectAccess(
  supabase: Awaited<ReturnType<typeof getAccessContext>>['supabase'],
  projectId: string,
  role: Database['public']['Enums']['role_enum'] | null,
  clientMemberships: string[],
) {
  if (role !== 'client') {
    return
  }

  const { data, error } = await supabase
    .from(PROJECTS)
    .select('client_id')
    .eq('id', projectId)
    .maybeSingle<{ client_id: string | null }>()

  if (error) {
    console.error('brief project verification error:', error)
    throw new HttpError('Unable to verify project access.', 500)
  }

  if (!data?.client_id || !clientMemberships.includes(data.client_id)) {
    throw new HttpError('Project not found.', 404)
  }
}

export async function PUT(
  request: Request,
  context: { params: { projectId: string } },
) {
  try {
    const access = await getAccessContext()
    await ensureProjectAccess(access.supabase, context.params.projectId, access.role, access.clientMemberships)

    let payload: BriefPayload
    try {
      payload = (await request.json()) as BriefPayload
    } catch (error) {
      console.error('brief payload parse error:', error)
      return NextResponse.json({ message: 'Invalid request body.' }, { status: 400 })
    }

    const { error } = await access.supabase
      .from(BRIEFS)
      .upsert({ project_id: context.params.projectId, answers: payload.answers })

    if (error) {
      console.error('brief upsert error:', error)
      return NextResponse.json({ message: 'Unable to save brief.' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof HttpError) {
      return NextResponse.json({ message: error.message }, { status: error.status })
    }

    console.error('brief upsert unexpected error:', error)
    return NextResponse.json({ message: 'Unable to save brief.' }, { status: 500 })
  }
}

export async function DELETE(
  _request: Request,
  context: { params: { projectId: string } },
) {
  try {
    const access = await getAccessContext()
    await ensureProjectAccess(access.supabase, context.params.projectId, access.role, access.clientMemberships)

    const { error } = await access.supabase
      .from(BRIEFS)
      .delete()
      .eq('project_id', context.params.projectId)

    if (error) {
      console.error('brief delete error:', error)
      return NextResponse.json({ message: 'Unable to clear brief.' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof HttpError) {
      return NextResponse.json({ message: error.message }, { status: error.status })
    }

    console.error('brief delete unexpected error:', error)
    return NextResponse.json({ message: 'Unable to clear brief.' }, { status: 500 })
  }
}
