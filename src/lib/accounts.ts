import type { SupabaseClient } from '@supabase/supabase-js'

import type { Database } from '@/types/supabase'

export type AccountRole = Database['public']['Enums']['account_role']

export type AccountMembership = {
  accountId: string
  role: AccountRole
}

type AccountSupabaseClient = Pick<SupabaseClient<Database>, 'from'>

export async function getPrimaryAccountMembership(
  supabase: AccountSupabaseClient,
  profileId: string
): Promise<AccountMembership | null> {
  const { data, error } = await supabase
    .from('account_members')
    .select('account_id, role, created_at')
    .eq('profile_id', profileId)
    .order('created_at', { ascending: true })

  if (error) {
    throw error
  }

  const membership = data?.[0]

  if (!membership || !membership.account_id) {
    return null
  }

  return {
    accountId: membership.account_id,
    role: membership.role
  }
}
