import { NextResponse } from 'next/server'

import { createServerSupabase } from '@/lib/supabase/server'

import { supabaseAdmin } from '@/lib/supabaseAdmin'

const STORAGE_BUCKET = 'project-files' as const

export const runtime = 'nodejs'

type SignedUrlPayload = {
  path: string
}

async function ensureProjectAccess(
  supabase: ReturnType<typeof createServerSupabase>,
  projectId: string,
  profileId: string
) {
  const { data: profileRow, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', profileId)
    .maybeSingle<{ role: string | null }>()

  if (profileError) {
    console.error('signed url profile error:', profileError)
    throw new Error('Unable to verify permissions.')
  }

  const role = profileRow?.role ?? null

  if (role !== 'client') {
    return
  }

  const { data: membershipRows, error: membershipError } = await supabase
    .from('client_members')
    .select('client_id')
    .eq('profile_id', profileId)
    .returns<Array<{ client_id: string | null }>>()

  if (membershipError) {
    console.error('signed url membership error:', membershipError)
    throw new Error('Unable to verify permissions.')
  }

  const clientIds = (membershipRows ?? [])
    .map((row) => row.client_id)
    .filter((value): value is string => typeof value === 'string' && value.length > 0)

  if (clientIds.length === 0) {
    throw Object.assign(new Error('Project not found.'), { status: 404 })
  }

  const { data: projectRow, error: projectError } = await supabase
    .from('projects')
    .select('client_id')
    .eq('id', projectId)
    .maybeSingle<{ client_id: string | null }>()

  if (projectError) {
    console.error('signed url project verification error:', projectError)
    throw new Error('Unable to verify permissions.')
  }

  if (!projectRow?.client_id || !clientIds.includes(projectRow.client_id)) {
    throw Object.assign(new Error('Project not found.'), { status: 404 })
  }
}

export async function POST(
  request: Request,
  context: { params: { projectId: string } }
) {
  const supabase = createServerSupabase()

  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return NextResponse.json({ message: 'Not authenticated.' }, { status: 401 })
  }

  try {
    await ensureProjectAccess(supabase, context.params.projectId, user.id)
  } catch (error) {
    if (error instanceof Error && 'status' in error) {
      const status = typeof (error as { status?: number }).status === 'number' ? (error as { status?: number }).status : 500
      return NextResponse.json({ message: error.message }, { status })
    }

    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Unable to verify access.' },
      { status: 500 }
    )
  }

  let payload: SignedUrlPayload

  try {
    payload = (await request.json()) as SignedUrlPayload
  } catch (error) {
    console.error('signed url payload parse error:', error)
    return NextResponse.json({ message: 'Invalid request body.' }, { status: 400 })
  }

  const path = typeof payload.path === 'string' ? payload.path.trim() : ''

  if (!path || !path.startsWith(`${context.params.projectId}/`)) {
    return NextResponse.json({ message: 'Invalid file path.' }, { status: 400 })
  }

  const admin = supabaseAdmin()
  const { data, error } = await admin.storage.from(STORAGE_BUCKET).createSignedUrl(path, 60)

  if (error || !data?.signedUrl) {
    console.error('signed url generation error:', error)
    return NextResponse.json({ message: 'Unable to generate download link.' }, { status: 500 })
  }

  return NextResponse.json({ url: data.signedUrl })
}
