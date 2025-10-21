'use client'

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

import { fetchActiveProfile } from '@/lib/api/profile'
import { createBrowserClient } from '@/lib/supabase/browser'
import type { Database } from '@/types/supabase'

type ProfileRole = Database['public']['Enums']['role_enum']

type ActiveProfileDetails = {
  id: string
  role: ProfileRole | null
  fullName: string | null
  email: string | null
  displayName: string
}

type ActiveProfileContextValue = {
  loading: boolean
  profile: ActiveProfileDetails | null
  clientIds: string[]
}

const ActiveProfileContext = createContext<ActiveProfileContextValue | null>(null)

type ActiveProfileProviderProps = {
  children: ReactNode
}

const candidateRoleMetadataKeys = ['role', 'title', 'position'] as const

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

    if (normalized === 'owner' || normalized === 'client') {
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
    clientIds: []
  })

  useEffect(() => {
    let isMounted = true

    const loadProfile = async () => {
      if (isMounted) {
        setState((previous) => ({ ...previous, loading: true }))
      }

      try {
        const response = await fetchActiveProfile()

        if (!isMounted) {
          return
        }

        if (!response) {
          setState({ loading: false, profile: null, clientIds: [] })
          return
        }

        const metadataRole = resolveMetadataRole(response.metadata ?? undefined)
        const metadataName = resolveMetadataName(response.metadata ?? undefined)

        const profileFullName = response.profile.full_name?.trim() || ''
        const resolvedEmail = response.profile.email?.trim() || response.userEmail?.trim() || ''
        const resolvedRole = response.profile.role ?? metadataRole ?? null
        const resolvedFullName = profileFullName || metadataName || null
        const displayName = resolvedFullName ?? resolvedEmail || 'Account'

        setState({
          loading: false,
          clientIds: response.clientIds,
          profile: {
            id: response.profile.id,
            role: resolvedRole,
            fullName: resolvedFullName,
            email: resolvedEmail ? resolvedEmail : null,
            displayName
          }
        })
      } catch (error) {
        console.error('Failed to load active profile', error)
        if (isMounted) {
          setState({ loading: false, profile: null, clientIds: [] })
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
