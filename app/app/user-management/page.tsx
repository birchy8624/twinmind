import { redirect } from 'next/navigation'

import { createServerSupabase } from '@/lib/supabase/server'
import type { Database } from '@/types/supabase'

import UserManagementClient, { type AccountAccess, type AccountMember } from './UserManagementClient'

type AccountRow = Database['public']['Tables']['accounts']['Row']
type AccountMemberRow = Database['public']['Tables']['account_members']['Row']
type ProfileRow = Database['public']['Tables']['profiles']['Row']
type ProfileRole = Database['public']['Enums']['role']

type MembershipQueryRow = Pick<AccountMemberRow, 'account_id' | 'role' | 'created_at'> & {
  accounts: Pick<AccountRow, 'id' | 'name' | 'created_at'> | null
}

type AccountMemberWithProfile = Pick<
  AccountMemberRow,
  'id' | 'account_id' | 'profile_id' | 'role' | 'created_at'
> & {
  profiles: Pick<ProfileRow, 'id' | 'full_name' | 'email'> | null
}

const resolveAccountName = (account: Pick<AccountRow, 'name'> | null | undefined) => {
  if (!account) {
    return 'Untitled account'
  }

  return account.name
}

const resolveFullName = (profile: Pick<ProfileRow, 'full_name' | 'email'> | null | undefined) => {
  const candidate = profile?.full_name?.trim()

  if (candidate && candidate.length > 0) {
    return candidate
  }

  if (profile?.email) {
    return profile.email
  }

  return 'Unknown member'
}

export default async function UserManagementPage() {
  const supabase = createServerSupabase()
  const {
    data: { user }
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/sign_in')
  }

  const [{ data: profile, error: profileError }, { data: membershipRows, error: membershipError }] = await Promise.all([
    supabase.from('profiles').select('id, role, full_name').eq('id', user.id).maybeSingle(),
    supabase
      .from('account_members')
      .select('account_id, role, created_at, accounts(id, name, created_at)')
      .eq('profile_id', user.id)
  ])

  if (profileError) {
    console.error('Failed to load profile for user management:', profileError)
  }

  if (membershipError) {
    console.error('Failed to load account memberships:', membershipError)
  }

  const membershipRowsTyped = membershipRows as MembershipQueryRow[] | null | undefined

  const membershipAccounts = (membershipRowsTyped ?? []).flatMap<AccountAccess>((row) => {
    if (!row.accounts) {
      return []
    }

    return [
      {
        id: row.accounts.id,
        name: resolveAccountName(row.accounts),
        createdAt: row.accounts.created_at,
        membershipRole: row.role,
        accessType: 'member'
      }
    ]
  })

  const isPlatformOwner: boolean = profile?.role === ('owner' satisfies ProfileRole)

  let accounts: AccountAccess[] = membershipAccounts

  if (isPlatformOwner) {
    const { data: allAccounts, error: allAccountsError } = await supabase
      .from('accounts')
      .select('id, name, created_at')
      .order('name', { ascending: true })

    if (allAccountsError) {
      console.error('Failed to load all accounts for owner:', allAccountsError)
    }

    const combined = new Map<string, AccountAccess>()

    membershipAccounts.forEach((account) => {
      combined.set(account.id, account)
    })

    ;(allAccounts ?? []).forEach((account) => {
      if (combined.has(account.id)) {
        return
      }

      combined.set(account.id, {
        id: account.id,
        name: resolveAccountName(account),
        createdAt: account.created_at,
        membershipRole: null,
        accessType: 'platform-owner'
      })
    })

    accounts = Array.from(combined.values()).sort((a, b) => a.name.localeCompare(b.name))
  } else {
    accounts = [...membershipAccounts].sort((a, b) => a.name.localeCompare(b.name))
  }

  const uniqueAccountIds = Array.from(new Set(accounts.map((account) => account.id)))

  let membersByAccount: Record<string, AccountMember[]> = {}

  if (uniqueAccountIds.length > 0) {
    const { data: memberRows, error: membersError } = await supabase
      .from('account_members')
      .select('id, account_id, profile_id, role, created_at, profiles!inner(id, full_name, email)')
      .in('account_id', uniqueAccountIds)

    if (membersError) {
      console.error('Failed to load account members:', membersError)
    }

    membersByAccount = (memberRows as AccountMemberWithProfile[] | null | undefined)?.reduce<Record<string, AccountMember[]>>(
      (accumulator, row) => {
        const profileDetails = row.profiles
        const accountId = row.account_id

        if (!accumulator[accountId]) {
          accumulator[accountId] = []
        }

        accumulator[accountId]?.push({
          id: row.id,
          accountId,
          profileId: row.profile_id,
          fullName: resolveFullName(profileDetails),
          email: profileDetails?.email ?? '—',
          role: row.role,
          addedAt: row.created_at
        })

        return accumulator
      },
      {}
    ) ?? {}
  }

  return <UserManagementClient accounts={accounts} membersByAccount={membersByAccount} />
}
