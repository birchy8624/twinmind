'use client'

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

import { createBrowserClient } from '@/lib/supabase/browser'
import type { Database } from '@/types/supabase'

type ProfileRow = Database['public']['Tables']['profiles']['Row']
type AccountMemberRow = Database['public']['Tables']['account_members']['Row']
type AccountRow = Database['public']['Tables']['accounts']['Row']
type AccountRole = Database['public']['Enums']['account_role']

const PROFILES = 'profiles' as const
const ACCOUNT_MEMBERS = 'account_members' as const

type ActiveAccountDetails = {
  id: string
  name: string
  role: AccountRole
}

type ActiveProfileDetails = {
  id: string
  role: AccountRole | null
  fullName: string | null
  email: string | null
  displayName: string
}

type ActiveProfileContextValue = {
  loading: boolean
  profile: ActiveProfileDetails | null
  account: ActiveAccountDetails | null
  memberships: ActiveAccountDetails[]
}

const ActiveProfileContext = createContext<ActiveProfileContextValue | null>(null)

type ActiveProfileProviderProps = {
  children: ReactNode
}

const candidateRoleMetadataKeys = ['role', 'title', 'position'] as const

const resolveMetadataRole = (metadata: Record<string, unknown> | undefined): AccountRole | null => {
  if (!metadata) {
    return null
  }

  for (const key of candidateRoleMetadataKeys) {
    const value = metadata[key]
    if (typeof value !== 'string') {
      continue
    }

    const normalized = value.trim().toLowerCase()

    if (normalized === 'owner' || normalized === 'member') {
      return normalized as AccountRole
    }
  }

  return null
}

const resolveMetadataName = (metadata: Record<string, unknown> | undefined): string | null => {
  if (!metadata) {
    return null
  }

  const firstName = typeof metadata['first_name'] === 'string' ? metadata['first_name'] : null
  const lastName = typeof metadata['last_name'] === 'string' ? metadata['last_name'] : null
  const fullName = typeof metadata['full_name'] === 'string' ? metadata['full_name'] : null

  const composed =
    firstName && lastName
      ? `${firstName} ${lastName}`
      : fullName ?? firstName ?? (typeof metadata['name'] === 'string' ? metadata['name'] : null)

  const trimmed = typeof composed === 'string' ? composed.trim() : ''

  return trimmed ? trimmed : null
}

export function ActiveProfileProvider({ children }: ActiveProfileProviderProps) {
  const supabase = useMemo(createBrowserClient, [])
  const [state, setState] = useState<ActiveProfileContextValue>({
    loading: true,
    profile: null,
    account: null,
    memberships: []
  })

  useEffect(() => {
    let isMounted = true

    const loadProfile = async () => {
      if (isMounted) {
        setState((previous) => ({ ...previous, loading: true }))
      }

      try {
        const {
          data: { user },
          error: userError
        } = await supabase.auth.getUser()

        if (userError) {
          throw userError
        }

        if (!user) {
          if (isMounted) {
            setState({ loading: false, profile: null, account: null, memberships: [] })
          }
          return
        }

        const metadataRole = resolveMetadataRole(user.user_metadata)
        const metadataName = resolveMetadataName(user.user_metadata)

        const { data: profileRow, error: profileError } = await supabase
          .from(PROFILES)
          .select('id, full_name, email, role')
          .eq('id', user.id)
          .maybeSingle()

        if (profileError) {
          throw profileError
        }

        const typedProfile = (profileRow ?? null) as Pick<ProfileRow, 'id' | 'full_name' | 'email' | 'role'> | null

        const profileFullName = typedProfile?.full_name?.trim() || ''
        const profileEmail = typedProfile?.email?.trim() || (typeof user.email === 'string' ? user.email.trim() : '')
        const profileRole = typedProfile?.role ?? null
        const resolvedRole = profileRole ?? metadataRole ?? null
        const resolvedFullName = profileFullName || metadataName || null
        const resolvedDisplayName = resolvedFullName ?? profileEmail ?? 'Account'
        const { data: membershipRows, error: membershipError } = await supabase
          .from(ACCOUNT_MEMBERS)
          .select('account_id, role, accounts:account_id ( id, name )')
          .eq('profile_id', user.id)
          .order('created_at', { ascending: true })

        if (membershipError) {
          throw membershipError
        }

        type MembershipRow = Pick<AccountMemberRow, 'account_id' | 'role'> & {
          accounts: Pick<AccountRow, 'id' | 'name'> | null
        }

        const typedMemberships = (membershipRows ?? []) as MembershipRow[]

        const memberships: ActiveAccountDetails[] = typedMemberships
          .map((membership) => {
            const accountId = membership.account_id
            const accountName = membership.accounts?.name?.trim() || null
            const resolvedName = accountName && accountName.length > 0 ? accountName : 'Workspace'
            return {
              id: accountId,
              name: resolvedName,
              role: membership.role ?? 'member'
            }
          })
          .filter((membership) => typeof membership.id === 'string' && membership.id.length > 0)

        const activeAccount = memberships[0] ?? null

        if (isMounted) {
          setState({
            loading: false,
            memberships,
            account: activeAccount,
            profile: {
              id: user.id,
              role: activeAccount?.role ?? resolvedRole,
              fullName: resolvedFullName,
              email: profileEmail || null,
              displayName: resolvedDisplayName
            }
          })
        }
      } catch (error) {
        console.error('Failed to load active profile', error)
        if (isMounted) {
          setState({ loading: false, profile: null, account: null, memberships: [] })
        }
      }
    }

    void loadProfile()

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange(() => {
      void loadProfile()
    })

    return () => {
      isMounted = false
      subscription.unsubscribe()
    }
  }, [supabase])

  return <ActiveProfileContext.Provider value={state}>{children}</ActiveProfileContext.Provider>
}

export function useActiveProfile(): ActiveProfileContextValue {
  const context = useContext(ActiveProfileContext)

  if (!context) {
    throw new Error('useActiveProfile must be used within an ActiveProfileProvider')
  }

  return context
}
