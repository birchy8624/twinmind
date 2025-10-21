import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { createServerSupabase } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import type { Database } from '@/types/supabase'
import type { ClientDetailsQuery } from '@/lib/api/clients'

const PROJECT_FILES_BUCKET = 'project-files' as const

const ACCOUNT_STATUS_SCHEMA = z.enum(['active', 'inactive', 'invited', 'archived'])

const updateClientSchema = z.object({
  name: z.string().trim().min(2, 'Client name is required'),
  account_status: ACCOUNT_STATUS_SCHEMA,
  website: z
    .string()
    .trim()
    .refine((value) => value.length === 0 || isValidUrl(value), { message: 'Enter a valid URL' }),
  notes: z.string().optional().transform((value) => value ?? '')
})

export const runtime = 'nodejs'

function isClientDetailsRow(value: unknown): value is ClientDetailsQuery {
  return typeof value === 'object' && value !== null && 'id' in value && 'name' in value
}

export async function GET(
  _request: Request,
  context: { params: { clientId: string } }
) {
  const clientId = context.params.clientId
  const supabase = createServerSupabase()

  const { data, error } = await supabase
    .from('clients')
    .select(
      `
        id,
        name,
        website,
        notes,
        account_id,
        account_status,
        created_at,
        updated_at,
        client_members:client_members (
          id,
          role,
          created_at,
          profile:profiles!client_members_profile_id_fkey (
            id,
            full_name,
            email
          )
        ),
        contacts:contacts (
          id,
          first_name,
          last_name,
          email,
          phone,
          title,
          is_primary,
          created_at,
          profile_id,
          profile:profiles!contacts_profile_id_fkey (
            timezone
          )
        ),
        invites:invites (
          id,
          email,
          created_at,
          expires_at,
          accepted_profile_id,
          profile:profiles!invites_accepted_profile_id_fkey (
            id,
            full_name,
            email
          )
        ),
        projects:projects (
          id,
          name,
          status,
          due_date,
          created_at,
          updated_at,
          archived
        )
      `
    )
    .filter('id', 'eq', clientId)
    .maybeSingle<ClientDetailsQuery>()

  if (error) {
    console.error('Load client details error:', error)
    return NextResponse.json(
      { message: 'Unable to load client details.' },
      { status: 500 }
    )
  }

  if (!isClientDetailsRow(data)) {
    return NextResponse.json({ message: 'Client not found.' }, { status: 404 })
  }

  return NextResponse.json({ client: data })
}

function normalizeWebsite(value: string) {
  const trimmed = value.trim()
  if (!trimmed) {
    return null
  }

  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed
  }

  return `https://${trimmed}`
}

function isValidUrl(value: string) {
  try {
    const url = new URL(value)
    return Boolean(url.protocol && url.host)
  } catch (error) {
    try {
      const url = new URL(`https://${value}`)
      return Boolean(url.host)
    } catch (nestedError) {
      return false
    }
  }
}

export async function PATCH(
  request: Request,
  context: { params: { clientId: string } }
) {
  const supabase = createServerSupabase()

  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return NextResponse.json({ message: 'Not authenticated.' }, { status: 401 })
  }

  const { data: profileRow, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle<{ role: Database['public']['Enums']['role_enum'] | null }>()

  if (profileError) {
    console.error('updateClient profile error:', profileError)
    return NextResponse.json({ message: 'Unable to verify permissions.' }, { status: 500 })
  }

  if (profileRow?.role !== 'owner') {
    return NextResponse.json(
      { message: 'Only workspace owners can update clients.' },
      { status: 403 }
    )
  }

  let payload: unknown

  try {
    payload = await request.json()
  } catch (error) {
    console.error('updateClient parse error:', error)
    return NextResponse.json({ message: 'Invalid input.' }, { status: 400 })
  }

  const parsed = updateClientSchema.safeParse(payload)

  if (!parsed.success) {
    return NextResponse.json({ message: 'Invalid input.' }, { status: 400 })
  }

  const { name, account_status, website, notes } = parsed.data

  const updatePayload: Database['public']['Tables']['clients']['Update'] = {
    name: name.trim(),
    account_status,
    website: normalizeWebsite(website),
    notes: notes.trim() ? notes.trim() : null
  }

  type ClientUpdateRow = Pick<
    Database['public']['Tables']['clients']['Row'],
    'id' | 'name' | 'website' | 'notes' | 'account_status' | 'created_at' | 'updated_at' | 'account_id'
  >

  const { data, error } = await supabase
    .from('clients')
    // Supabase's helper infers the update payload type as `never` here despite the table generics,
    // so cast through `never` until the upstream typings are fixed.
    .update(updatePayload as never)
    .eq('id', context.params.clientId)
    .select('id, name, website, notes, account_status, created_at, updated_at, account_id')
    .maybeSingle<ClientUpdateRow>()

  if (error) {
    console.error('updateClient update error:', error)
    return NextResponse.json({ message: 'Unable to update client.' }, { status: 500 })
  }

  if (!data) {
    return NextResponse.json({ message: 'Client not found.' }, { status: 404 })
  }

  revalidatePath('/app/clients')
  revalidatePath('/app/projects')
  revalidatePath('/app/dashboard')

  return NextResponse.json({ client: data })
}

export async function DELETE(
  _request: Request,
  context: { params: { clientId: string } }
) {
  const clientId = context.params.clientId

  const supabase = createServerSupabase()
  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return NextResponse.json({ message: 'Not authenticated.' }, { status: 401 })
  }

  type ProfileRoleRow = Pick<Database['public']['Tables']['profiles']['Row'], 'role'>

  const { data: profileRow, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle<ProfileRoleRow>()

  if (profileError) {
    console.error('deleteClient profile error:', profileError)
    return NextResponse.json(
      { message: 'Unable to verify permissions.' },
      { status: 500 }
    )
  }

  if (profileRow?.role !== 'owner') {
    return NextResponse.json(
      { message: 'Only workspace owners can delete clients.' },
      { status: 403 }
    )
  }

  const admin = supabaseAdmin()

  const { data: projectRows, error: projectQueryError } = await admin
    .from('projects')
    .select('id')
    .eq('client_id', clientId)

  if (projectQueryError) {
    console.error('deleteClient projects query error:', projectQueryError)
    return NextResponse.json(
      { message: 'Unable to load client projects.' },
      { status: 500 }
    )
  }

  const projectIds = (projectRows ?? [])
    .map((row) => row?.id)
    .filter((value): value is string => typeof value === 'string' && value.length > 0)

  if (projectIds.length > 0) {
    const { data: fileRows, error: fileQueryError } = await admin
      .from('files')
      .select('storage_path')
      .in('project_id', projectIds)

    if (fileQueryError) {
      console.error('deleteClient files query error:', fileQueryError)
      return NextResponse.json(
        { message: 'Unable to load project files.' },
        { status: 500 }
      )
    }

    const storagePaths = (fileRows ?? [])
      .map((file) => file?.storage_path)
      .filter((value): value is string => typeof value === 'string' && value.length > 0)

    if (storagePaths.length > 0) {
      const { error: storageError } = await admin.storage
        .from(PROJECT_FILES_BUCKET)
        .remove(storagePaths)

      if (storageError) {
        console.error('deleteClient storage removal error:', storageError)
      }
    }

    const projectDependencies: Array<{
      table: 'comments' | 'files' | 'project_stage_events' | 'briefs' | 'invoices'
      column: 'project_id'
      label: string
    }> = [
      { table: 'comments', column: 'project_id', label: 'project comments' },
      { table: 'files', column: 'project_id', label: 'project files' },
      { table: 'project_stage_events', column: 'project_id', label: 'project history' },
      { table: 'briefs', column: 'project_id', label: 'project briefs' },
      { table: 'invoices', column: 'project_id', label: 'project invoices' }
    ]

    for (const { table, column, label } of projectDependencies) {
      const { error } = await admin
        .from(table)
        .delete()
        .in(column, projectIds)

      if (error) {
        console.error(`deleteClient ${label} delete error:`, error)
        return NextResponse.json(
          { message: `Unable to remove ${label}.` },
          { status: 500 }
        )
      }
    }

    const { error: projectDeleteError } = await admin
      .from('projects')
      .delete()
      .in('id', projectIds)

    if (projectDeleteError) {
      console.error('deleteClient projects delete error:', projectDeleteError)
      return NextResponse.json(
        { message: 'Unable to remove client projects.' },
        { status: 500 }
      )
    }
  }

  const clientDependencies: Array<{
    table: 'contacts' | 'client_members' | 'invites'
    column: 'client_id'
    label: string
  }> = [
    { table: 'contacts', column: 'client_id', label: 'client contacts' },
    { table: 'client_members', column: 'client_id', label: 'client members' },
    { table: 'invites', column: 'client_id', label: 'client invites' }
  ]

  for (const { table, column, label } of clientDependencies) {
    const { error } = await admin
      .from(table)
      .delete()
      .eq(column, clientId)

    if (error) {
      console.error(`deleteClient ${label} delete error:`, error)
      return NextResponse.json(
        { message: `Unable to remove ${label}.` },
        { status: 500 }
      )
    }
  }

  const { error: clientDeleteError } = await admin
    .from('clients')
    .delete()
    .eq('id', clientId)

  if (clientDeleteError) {
    console.error('deleteClient client delete error:', clientDeleteError)
    return NextResponse.json(
      { message: 'Unable to delete this client.' },
      { status: 500 }
    )
  }

  revalidatePath('/app/clients')
  revalidatePath('/app/dashboard')
  revalidatePath('/app/projects')
  revalidatePath('/app/kanban')

  return NextResponse.json({ ok: true })
}
