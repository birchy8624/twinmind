'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { isAccountRoleAtLeast } from '@/lib/active-account'
import { createServerSupabase } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import type { Database } from '@/types/supabase'

const deleteClientSchema = z.object({
  clientId: z.string().min(1, 'Client identifier is required'),
  accountId: z.string().uuid('Workspace identifier is required')
})

const PROJECT_FILES_BUCKET = 'project-files' as const

type ActionResult = {
  ok: boolean
  message?: string
}

export async function deleteClient(input: unknown): Promise<ActionResult> {
  const parsed = deleteClientSchema.safeParse(input)

  if (!parsed.success) {
    return { ok: false, message: 'Invalid client details provided.' }
  }

  const { clientId, accountId } = parsed.data

  const supabase = createServerSupabase()
  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return { ok: false, message: 'Not authenticated.' }
  }

  const { data: membershipRow, error: membershipError } = await supabase
    .from('account_members')
    .select('role')
    .eq('profile_id', user.id)
    .eq('account_id', accountId)
    .maybeSingle()

  if (membershipError) {
    console.error('deleteClient membership error:', membershipError)
    return { ok: false, message: 'Unable to verify workspace permissions.' }
  }

  if (!isAccountRoleAtLeast(membershipRow?.role, 'owner')) {
    return { ok: false, message: 'Only workspace owners can delete clients.' }
  }

  const { data: clientRow, error: clientFetchError } = await supabase
    .from('clients')
    .select('account_id')
    .eq('id', clientId)
    .maybeSingle()

  if (clientFetchError) {
    console.error('deleteClient client fetch error:', clientFetchError)
    return { ok: false, message: 'Unable to load client details.' }
  }

  if (!clientRow || clientRow.account_id !== accountId) {
    return { ok: false, message: 'Client does not belong to this workspace.' }
  }

  const admin = supabaseAdmin()

  const { data: projectRows, error: projectQueryError } = await admin
    .from('projects')
    .select('id')
    .eq('client_id', clientId)
    .eq('account_id', accountId)

  if (projectQueryError) {
    console.error('deleteClient projects query error:', projectQueryError)
    return { ok: false, message: 'Unable to load client projects.' }
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
      return { ok: false, message: 'Unable to load project files.' }
    }

    const storagePaths = (fileRows ?? [])
      .map((file) => file?.storage_path)
      .filter((value): value is string => typeof value === 'string' && value.length > 0)

    if (storagePaths.length > 0) {
      const { error: storageError } = await admin.storage.from(PROJECT_FILES_BUCKET).remove(storagePaths)

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
        return { ok: false, message: `Unable to remove ${label}.` }
      }
    }

    const { error: projectDeleteError } = await admin
      .from('projects')
      .delete()
      .in('id', projectIds)

    if (projectDeleteError) {
      console.error('deleteClient projects delete error:', projectDeleteError)
      return { ok: false, message: 'Unable to remove client projects.' }
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
      return { ok: false, message: `Unable to remove ${label}.` }
    }
  }

  const { error: clientDeleteError } = await admin
    .from('clients')
    .delete()
    .eq('id', clientId)
    .eq('account_id', accountId)

  if (clientDeleteError) {
    console.error('deleteClient client delete error:', clientDeleteError)
    return { ok: false, message: 'Unable to delete this client.' }
  }

  revalidatePath('/app/clients')
  revalidatePath('/app/dashboard')
  revalidatePath('/app/projects')
  revalidatePath('/app/kanban')

  return { ok: true }
}
