'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

import { ACTIVE_ACCOUNT_COOKIE, ACTIVE_ACCOUNT_STORAGE_KEY } from '@/lib/active-account'
import { createBrowserClient } from '@/lib/supabase/browser'
import type { Database } from '@/types/supabase'

type ProfileRow = Database['public']['Tables']['profiles']['Row']
type AccountMemberRow = Database['public']['Tables']['account_members']['Row']
type AccountRow = Database['public']['Tables']['accounts']['Row']
type ProfileRole = Database['public']['Enums']['role']
type AccountRole = Database['public']['Enums']['account_role']

const PROFILES = 'profiles' as const
const ACCOUNT_MEMBERS = 'account_members' as const

const candidateRoleMetadataKeys = ['role', 'title', 'position'] as const

type AccountMembership = {
  accountId: string
  accountName: string
  role: AccountRole
}

type ActiveProfileDetails = {
  id: string
  role: ProfileRole | null
  fullName: string | null
  email: string | null
  displayName: string
  accountId: string | null
  accountName: string | null
}

type ActiveProfileContextState = {
  loading: boolean
  profile: ActiveProfileDetails | null
  memberships: AccountMembership[]
  activeAccountId: string | null
}

type ActiveProfileContextValue = ActiveProfileContextState & {
  activeAccount: AccountMembership | null
  setActiveAccountId: (accountId: string | null) => void
}

const ActiveProfileContext = createContext<ActiveProfileContextValue | null>(null)

type ActiveProfileProviderProps = {
  children: ReactNode
}

const resolveMetadataRole = (metadata: Record<string, unknown> | undefined): ProfileRole | null => {
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
      return normalized as ProfileRole
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
  const nameCandidate =
    firstName && lastName
      ? `${firstName} ${lastName}`
      : fullName ?? firstName ?? (typeof metadata['name'] === 'string' ? metadata['name'] : null)

  const trimmed = typeof nameCandidate === 'string' ? nameCandidate.trim() : ''

  return trimmed ? trimmed : null
}

const readCookieAccountId = (): string | null => {
  if (typeof document === 'undefined') {
    return null
  }

  const pattern = new RegExp(`(?:^|; )${ACTIVE_ACCOUNT_COOKIE}=([^;]*)`)
  const match = document.cookie.match(pattern)

  if (!match) {
    return null
  }

  const value = decodeURIComponent(match[1] ?? '').trim()

  return value.length > 0 ? value : null
}

const readStoredAccountId = () => {
  if (typeof window === 'undefined') {
    return null
  }

  try {
    const value = window.localStorage.getItem(ACTIVE_ACCOUNT_STORAGE_KEY)
    if (value && value.trim().length > 0) {
      return value
    }
  } catch (error) {
    console.error('Failed to read active account id from storage', error)
  }

  try {
    return readCookieAccountId()
  } catch (error) {
    console.error('Failed to read active account id from cookie', error)
  }

  return null
}

const writeStoredAccountId = (accountId: string | null) => {
  if (typeof window === 'undefined') {
    return
  }

  try {
    if (accountId) {
      window.localStorage.setItem(ACTIVE_ACCOUNT_STORAGE_KEY, accountId)
    } else {
      window.localStorage.removeItem(ACTIVE_ACCOUNT_STORAGE_KEY)
    }
  } catch (error) {
    console.error('Failed to persist active account id', error)
  }

  try {
    const secureFlag = window.location.protocol === 'https:' ? '; Secure' : ''

    if (accountId) {
      document.cookie = `${ACTIVE_ACCOUNT_COOKIE}=${encodeURIComponent(accountId)}; Path=/; Max-Age=${60 * 60 * 24 * 365}; SameSite=Lax${secureFlag}`
    } else {
      document.cookie = `${ACTIVE_ACCOUNT_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax${secureFlag}`
    }
  } catch (error) {
    console.error('Failed to persist active account cookie', error)
  }
}

export function ActiveProfileProvider({ children }: ActiveProfileProviderProps) {
  const supabase = useMemo(createBrowserClient, [])
  const [state, setState] = useState<ActiveProfileContextState>({
    loading: true,
    profile: null,
    memberships: [],
    activeAccountId: null
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
            setState({ loading: false, profile: null, memberships: [], activeAccountId: null })
          }
          writeStoredAccountId(null)
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
        const resolvedFullName = profileFullName || metadataName || null
        const resolvedDisplayName = resolvedFullName ?? profileEmail ?? 'Account'
        const fallbackRole = (typedProfile?.role ?? metadataRole ?? null) as ProfileRole | null

        const { data: membershipRows, error: membershipError } = await supabase
          .from(ACCOUNT_MEMBERS)
          .select('account_id, role, accounts:account_id ( id, name )')
          .eq('profile_id', user.id)

        if (membershipError) {
          throw membershipError
        }

        type AccountMembershipQuery = AccountMemberRow & {
          accounts: Pick<AccountRow, 'id' | 'name'> | null
        }

        const typedMemberships = (membershipRows ?? []) as AccountMembershipQuery[]

        const memberships: AccountMembership[] = typedMemberships
          .map((row) => {
            const accountId = typeof row.account_id === 'string' ? row.account_id.trim() : ''
            const role = row.role ?? null

            if (!accountId || !role) {
              return null
            }

            const accountName = row.accounts?.name?.trim() || 'Workspace'

            return {
              accountId,
              accountName,
              role
            }
          })
          .filter((membership): membership is AccountMembership => membership !== null)

        const membershipMap = new Map(memberships.map((membership) => [membership.accountId, membership]))

        let nextAccountId = readStoredAccountId()

        if (nextAccountId && !membershipMap.has(nextAccountId)) {
          nextAccountId = null
        }

        if (!nextAccountId && memberships.length > 0) {
          nextAccountId = memberships[0]?.accountId ?? null
        }

        const activeMembership = nextAccountId ? membershipMap.get(nextAccountId) ?? null : null

        writeStoredAccountId(activeMembership?.accountId ?? null)

        const resolvedRole: ProfileRole | null =
          (activeMembership?.role as ProfileRole | null) ?? fallbackRole ?? null

        const resolvedProfile: ActiveProfileDetails = {
          id: user.id,
          role: resolvedRole,
          fullName: resolvedFullName,
          email: profileEmail || null,
          displayName: resolvedDisplayName,
          accountId: activeMembership?.accountId ?? null,
          accountName: activeMembership?.accountName ?? null
        }

        if (isMounted) {
          setState({
            loading: false,
            profile: resolvedProfile,
            memberships,
            activeAccountId: activeMembership?.accountId ?? null
          })
        }
      } catch (error) {
        console.error('Failed to load active profile', error)
        writeStoredAccountId(null)
        if (isMounted) {
          setState({ loading: false, profile: null, memberships: [], activeAccountId: null })
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

  const setActiveAccountId = useCallback((accountId: string | null) => {
    setState((previous) => {
      if (previous.loading) {
        return previous
      }

      const membership = accountId
        ? previous.memberships.find((item) => item.accountId === accountId) ?? null
        : null

      writeStoredAccountId(membership?.accountId ?? null)

      const nextProfile = previous.profile
        ? {
            ...previous.profile,
            role: (membership?.role as ProfileRole | null) ?? null,
            accountId: membership?.accountId ?? null,
            accountName: membership?.accountName ?? null
          }
        : null

      return {
        ...previous,
        profile: nextProfile,
        activeAccountId: membership?.accountId ?? null
      }
    })
  }, [])

  const activeAccount = useMemo(() => {
    if (!state.activeAccountId) {
      return null
    }

    return state.memberships.find((membership) => membership.accountId === state.activeAccountId) ?? null
  }, [state.activeAccountId, state.memberships])

  const contextValue = useMemo<ActiveProfileContextValue>(
    () => ({
      ...state,
      activeAccount,
      setActiveAccountId
    }),
    [activeAccount, setActiveAccountId, state]
  )

  return <ActiveProfileContext.Provider value={contextValue}>{children}</ActiveProfileContext.Provider>
}

export function useActiveProfile(): ActiveProfileContextValue {
  const context = useContext(ActiveProfileContext)

  if (!context) {
    throw new Error('useActiveProfile must be used within an ActiveProfileProvider')
  }

  return context
}
