import type { User } from '@supabase/supabase-js'

import type { Database } from '@/types/supabase'
import { createServerSupabase } from '@/lib/supabase/server'
import { syncWorkspaceSubscription } from '@/lib/subscription'

export type ServerSupabaseClient = ReturnType<typeof createServerSupabase>

type ProfileRole = Database['public']['Enums']['role_enum'] | null

type AccessContext = {
  supabase: ServerSupabaseClient
  userId: string
  role: ProfileRole
  clientMemberships: string[]
  user: User
  accountId: string | null
}

type AccessContextOptions = {
  allowEmptyClientMemberships?: boolean
}

class HttpError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

async function resolveProfileRole(supabase: ServerSupabaseClient, profileId: string): Promise<ProfileRole> {
  const { data, error } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', profileId)
    .maybeSingle<{ role: ProfileRole }>()

  if (error) {
    console.error('resolveProfileRole error:', error)
    throw new HttpError('Unable to verify permissions.', 500)
  }

  return data?.role ?? null
}

async function resolveClientMemberships(
  supabase: ServerSupabaseClient,
  profileId: string,
): Promise<string[]> {
  const { data, error } = await supabase
    .from('client_members')
    .select('client_id')
    .eq('profile_id', profileId)
    .returns<Array<Pick<Database['public']['Tables']['client_members']['Row'], 'client_id'>>>()

  if (error) {
    console.error('resolveClientMemberships error:', error)
    throw new HttpError('Unable to load client memberships.', 500)
  }

  return (data ?? [])
    .map((row) => row?.client_id)
    .filter((value): value is string => typeof value === 'string' && value.length > 0)
}

export async function getAccessContext(options: AccessContextOptions = {}): Promise<AccessContext> {
  const supabase = createServerSupabase()
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    throw new HttpError('Not authenticated.', 401)
  }

  const role = await resolveProfileRole(supabase, user.id)
  let clientMemberships: string[] = []
  let accountId: string | null = null

  if (role === 'client') {
    clientMemberships = await resolveClientMemberships(supabase, user.id)

    if (clientMemberships.length === 0 && !options.allowEmptyClientMemberships) {
      throw new HttpError('No associated clients.', 404)
    }
  } else {
    const { data: membership, error: membershipError } = await supabase
      .from('account_members')
      .select('account_id')
      .eq('profile_id', user.id)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle<{ account_id: string | null }>()

    if (membershipError) {
      console.error('workspace membership lookup error:', membershipError)
    } else {
      accountId = membership?.account_id ?? null
    }

    if (accountId) {
      try {
        await syncWorkspaceSubscription({ supabase, accountId })
      } catch (error) {
        console.error('workspace subscription sync error:', error)
      }
    }
  }

  return { supabase, userId: user.id, role, clientMemberships, user, accountId }
}

export { HttpError }
