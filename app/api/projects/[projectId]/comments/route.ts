import { NextResponse } from 'next/server'

import type { SupabaseClient } from '@supabase/supabase-js'

import { createServerSupabase } from '@/lib/supabase/server'
import type { Database } from '@/types/supabase'

const COMMENTS = 'comments' as const
const PROFILES = 'profiles' as const
const PROJECTS = 'projects' as const

export const runtime = 'nodejs'

type CommentRow = Database['public']['Tables']['comments']['Row'] & {
  author_profile: Pick<Database['public']['Tables']['profiles']['Row'], 'id' | 'full_name' | 'role'> | null
}

type CommentResponse = {
  comments: Array<
    Database['public']['Tables']['comments']['Row'] & {
      author: Pick<Database['public']['Tables']['profiles']['Row'], 'id' | 'full_name' | 'role'> | null
    }
  >
}

type CreateCommentPayload = {
  body: string
  visibility: Database['public']['Enums']['visibility_enum']
}

async function ensureProjectAccess(
  supabase: ReturnType<typeof createServerSupabase>,
  projectId: string,
  profileId: string
) {
  const typedSupabase = supabase as unknown as SupabaseClient<Database>

  const { data: profileRow, error: profileError } = await typedSupabase
    .from(PROFILES)
    .select('role')
    .eq('id', profileId)
    .maybeSingle<{ role: Database['public']['Enums']['role_enum'] | null }>()

  if (profileError) {
    console.error('comments profile error:', profileError)
    throw new Error('Unable to verify permissions.')
  }

  const role = profileRow?.role ?? null

  if (role !== 'client') {
    return { role }
  }

  type ClientMembershipRow = Pick<Database['public']['Tables']['client_members']['Row'], 'client_id'>

  const { data: membershipRows, error: membershipError } = await typedSupabase
    .from('client_members')
    .select('client_id')
    .eq('profile_id', profileId)
    .returns<ClientMembershipRow[]>()

  if (membershipError) {
    console.error('comments membership error:', membershipError)
    throw new Error('Unable to load memberships.')
  }

  const clientIds = (membershipRows ?? [])
    .map((row) => row?.client_id)
    .filter((value): value is string => typeof value === 'string' && value.length > 0)

  if (clientIds.length === 0) {
    throw Object.assign(new Error('Project not found.'), { status: 404 })
  }

  const { data: projectRow, error: projectError } = await typedSupabase
    .from(PROJECTS)
    .select('id, client_id')
    .eq('id', projectId)
    .maybeSingle<{ id: string; client_id: string | null }>()

  if (projectError) {
    console.error('comments project verification error:', projectError)
    throw new Error('Unable to load project.')
  }

  if (!projectRow || !projectRow.client_id || !clientIds.includes(projectRow.client_id)) {
    throw Object.assign(new Error('Project not found.'), { status: 404 })
  }

  return { role }
}

export async function GET(
  _request: Request,
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

  const typedSupabase = supabase as unknown as SupabaseClient<Database>

  const { data, error } = await typedSupabase
    .from(COMMENTS)
    .select(
      `
        id,
        body,
        created_at,
        updated_at,
        visibility,
        author_profile_id,
        project_id,
        author_profile:${PROFILES}!comments_author_profile_id_fkey ( id, full_name, role )
      `
    )
    .eq('project_id', context.params.projectId)
    .order('created_at', { ascending: false })
    .returns<CommentRow[]>()

  if (error) {
    console.error('project comments fetch error:', error)
    return NextResponse.json({ message: 'Unable to load comments.' }, { status: 500 })
  }

  const typedComments = (data ?? []).map((row) => {
    const { author_profile, ...rest } = row
    return {
      ...rest,
      author: author_profile ?? null
    }
  })

  const response: CommentResponse = {
    comments: typedComments
  }

  return NextResponse.json(response)
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

  let access: { role: Database['public']['Enums']['role_enum'] | null }
  try {
    access = await ensureProjectAccess(supabase, context.params.projectId, user.id)
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

  let payload: CreateCommentPayload
  try {
    payload = (await request.json()) as CreateCommentPayload
  } catch (error) {
    console.error('create comment parse error:', error)
    return NextResponse.json({ message: 'Invalid request body.' }, { status: 400 })
  }

  const trimmedBody = payload.body?.trim()

  if (!trimmedBody) {
    return NextResponse.json({ message: 'Comment body is required.' }, { status: 400 })
  }

  const visibility =
    access.role === 'owner'
      ? payload.visibility
      : payload.visibility === 'owner'
        ? 'both'
        : payload.visibility

  const typedSupabase = supabase as unknown as SupabaseClient<Database>

  const { data, error } = await typedSupabase
    .from(COMMENTS)
    .insert({
      project_id: context.params.projectId,
      body: trimmedBody,
      visibility,
      author_profile_id: user.id
    })
    .select(
      `
        id,
        body,
        created_at,
        updated_at,
        visibility,
        author_profile:author_profile_id ( id, full_name, role )
      `
    )
    .maybeSingle<CommentRow>()

  if (error) {
    console.error('project comment insert error:', error)
    return NextResponse.json({ message: 'Unable to post comment.' }, { status: 500 })
  }

  if (!data) {
    return NextResponse.json({ message: 'Unable to post comment.' }, { status: 500 })
  }

  const comment = {
    ...data,
    author: data.author_profile ?? null
  }

  return NextResponse.json({ comment })
}
