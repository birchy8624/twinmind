import { NextResponse } from 'next/server'

import { createServerSupabase } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import type { Database } from '@/types/supabase'

const STORAGE_BUCKET = 'project-files' as const

export const runtime = 'nodejs'

type StorageFileObject = {
  name: string
  id: string | null
  created_at: string | null
  updated_at: string | null
  last_accessed_at: string | null
  metadata: { size?: number | string } | null
}

type ProjectFileResponse = {
  files: Array<{
    path: string
    name: string
    id: string | null
    created_at: string | null
    updated_at: string | null
    last_accessed_at: string | null
    size: number | null
  }>
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
    console.error('files profile error:', profileError)
    throw new Error('Unable to verify permissions.')
  }

  const role = profileRow?.role ?? null

  if (role !== 'client') {
    return
  }

  type ClientMembershipRow = Pick<Database['public']['Tables']['client_members']['Row'], 'client_id'>

  const { data: membershipRows, error: membershipError } = await supabase
    .from('client_members')
    .select('client_id')
    .eq('profile_id', profileId)
    .returns<ClientMembershipRow[]>()

  if (membershipError) {
    console.error('files membership error:', membershipError)
    throw new Error('Unable to load memberships.')
  }

  const clientIds = (membershipRows ?? [])
    .map((row) => row?.client_id)
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
    console.error('files project verification error:', projectError)
    throw new Error('Unable to load project.')
  }

  if (!projectRow?.client_id || !clientIds.includes(projectRow.client_id)) {
    throw Object.assign(new Error('Project not found.'), { status: 404 })
  }
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

  const admin = supabaseAdmin()

  const { data, error } = await admin.storage.from(STORAGE_BUCKET).list(context.params.projectId, {
    limit: 100,
    sortBy: { column: 'updated_at', order: 'desc' }
  })

  if (error) {
    console.error('project files list error:', error)
    return NextResponse.json({ message: 'Unable to load files.' }, { status: 500 })
  }

  const files = (data ?? []).map((file) => {
    const entry = file as StorageFileObject
    const metadata = entry.metadata ?? {}
    let size: number | null = null

    if (typeof metadata.size === 'number') {
      size = metadata.size
    } else if (typeof metadata.size === 'string') {
      const parsed = Number.parseInt(metadata.size, 10)
      size = Number.isNaN(parsed) ? null : parsed
    }

    return {
      path: `${context.params.projectId}/${entry.name}`,
      name: entry.name,
      id: entry.id ?? null,
      created_at: entry.created_at ?? null,
      updated_at: entry.updated_at ?? null,
      last_accessed_at: entry.last_accessed_at ?? null,
      size
    }
  })

  const response: ProjectFileResponse = {
    files
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

  let file: File

  try {
    const formData = await request.formData()
    const entry = formData.get('file')

    if (!(entry instanceof File)) {
      return NextResponse.json({ message: 'File upload payload is required.' }, { status: 400 })
    }

    file = entry
  } catch (error) {
    console.error('project file upload parse error:', error)
    return NextResponse.json({ message: 'Invalid upload request.' }, { status: 400 })
  }

  const fileName = file.name?.trim()

  if (!fileName) {
    return NextResponse.json({ message: 'File name is required.' }, { status: 400 })
  }

  const path = `${context.params.projectId}/${fileName}`

  try {
    const buffer = Buffer.from(await file.arrayBuffer())
    const admin = supabaseAdmin()
    const { error: uploadError } = await admin.storage.from(STORAGE_BUCKET).upload(path, buffer, {
      upsert: true,
      contentType: file.type || 'application/octet-stream'
    })

    if (uploadError) {
      console.error('project file upload error:', uploadError)
      return NextResponse.json({ message: 'Unable to upload file.' }, { status: 500 })
    }

    return NextResponse.json({ success: true, path })
  } catch (error) {
    console.error('project file upload unexpected error:', error)
    return NextResponse.json({ message: 'Unable to upload file.' }, { status: 500 })
  }
}

export async function DELETE(
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

  let payload: { path?: string }

  try {
    payload = (await request.json()) as { path?: string }
  } catch (error) {
    console.error('project file delete parse error:', error)
    return NextResponse.json({ message: 'Invalid request body.' }, { status: 400 })
  }

  const path = typeof payload.path === 'string' ? payload.path.trim() : ''

  if (!path || !path.startsWith(`${context.params.projectId}/`)) {
    return NextResponse.json({ message: 'Invalid file path.' }, { status: 400 })
  }

  const admin = supabaseAdmin()
  const { error } = await admin.storage.from(STORAGE_BUCKET).remove([path])

  if (error) {
    console.error('project file delete error:', error)
    return NextResponse.json({ message: 'Unable to delete file.' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
