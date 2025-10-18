'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState } from 'react'

import { useToast } from './toast-context'
import { createBrowserClient } from '@/lib/supabase/browser'

type WorkspaceAccountMenuProps = {
  className?: string
}

const PROFILES = 'profiles' as const

export function WorkspaceAccountMenu({ className }: WorkspaceAccountMenuProps) {
  const router = useRouter()
  const { pushToast } = useToast()
  const supabase = useMemo(createBrowserClient, [])
  const [isOpen, setIsOpen] = useState(false)
  const [signingOut, setSigningOut] = useState(false)
  const [profileName, setProfileName] = useState<string | null>(null)
  const [isLoadingProfile, setIsLoadingProfile] = useState(true)

  useEffect(() => {
    let isMounted = true

    const resolveMetadataName = (metadata: Record<string, unknown> | undefined) => {
      if (!metadata) {
        return null
      }

      const firstName = typeof metadata['first_name'] === 'string' ? metadata['first_name'] : null
      const lastName = typeof metadata['last_name'] === 'string' ? metadata['last_name'] : null
      const fullName = typeof metadata['full_name'] === 'string' ? metadata['full_name'] : null
      const name =
        firstName && lastName
          ? `${firstName} ${lastName}`
          : fullName ?? firstName ?? (typeof metadata['name'] === 'string' ? metadata['name'] : null)

      const trimmed = typeof name === 'string' ? name.trim() : ''

      return trimmed ? trimmed : null
    }

    const loadProfileName = async () => {
      if (isMounted) {
        setIsLoadingProfile(true)
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
            setProfileName(null)
          }
          return
        }

        const metadataName = resolveMetadataName(user.user_metadata)

        const { data: profile, error: profileError } = await supabase
          .from(PROFILES)
          .select('full_name')
          .eq('id', user.id)
          .maybeSingle()

        if (profileError) {
          throw profileError
        }

        const profileFullName =
          typeof profile?.full_name === 'string' ? profile.full_name.trim() : ''
        const userEmail = typeof user.email === 'string' ? user.email.trim() : ''

        const resolvedName = profileFullName || metadataName || userEmail || null

        if (isMounted) {
          setProfileName(resolvedName)
        }
      } catch (error) {
        console.error('Failed to load active profile', error)

        if (isMounted) {
          setProfileName(null)
        }
      } finally {
        if (isMounted) {
          setIsLoadingProfile(false)
        }
      }
    }

    void loadProfileName()

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange(() => {
      void loadProfileName()
    })

    return () => {
      isMounted = false
      subscription.unsubscribe()
    }
  }, [supabase])

  const initials = useMemo(() => {
    if (!profileName) {
      return '??'
    }

    const parts = profileName
      .split(/\s+/)
      .map((segment) => segment.trim())
      .filter(Boolean)

    if (parts.length >= 2) {
      const letters = `${parts[0]?.[0] ?? ''}${parts[1]?.[0] ?? ''}`.toUpperCase()
      return letters.trim() ? letters : '??'
    }

    if (parts.length === 1) {
      const [firstPart] = parts
      if (!firstPart) {
        return '??'
      }

      const [firstChar = '', secondChar = ''] = firstPart
      const fallback = `${firstChar}${secondChar}`.toUpperCase().trim()
      return fallback || firstChar.toUpperCase() || '??'
    }

    return '??'
  }, [profileName])

  const displayName = profileName ?? (isLoadingProfile ? 'Loading…' : 'Account')

  const handleSignOut = useCallback(async () => {
    if (signingOut) {
      return
    }

    setSigningOut(true)

    try {
      const { error } = await supabase.auth.signOut()

      if (error) {
        pushToast({
          title: 'Unable to sign out',
          description: error.message,
          variant: 'error'
        })
        return
      }

      setIsOpen(false)
      router.replace('/?signed_out=1')
    } catch (error) {
      console.error('Failed to sign out', error)
      pushToast({
        title: 'Unable to sign out',
        description: 'Something went wrong. Please try again.',
        variant: 'error'
      })
    } finally {
      setSigningOut(false)
    }
  }, [signingOut, supabase, pushToast, router])

  return (
    <details
      className={['relative ml-2 hidden md:block', className].filter(Boolean).join(' ')}
      open={isOpen}
      onToggle={(event) => setIsOpen(event.currentTarget.open)}
    >
      <summary className="flex cursor-pointer list-none items-center gap-3 rounded-full border border-white/10 bg-base-900/60 px-3 py-1.5 text-left text-sm text-white/80 transition hover:border-white/20 hover:text-white">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-limeglow-500 via-limeglow-600 to-limeglow-700 text-sm font-semibold text-base-900">
          {initials}
        </span>
        <span className="hidden text-xs uppercase tracking-wide text-white/60 lg:block">{displayName}</span>
      </summary>
      <div className="absolute right-0 mt-2 w-48 overflow-hidden rounded-xl border border-white/10 bg-base-900/80 p-2 shadow-lg">
        <Link
          href="/app/settings"
          className="block rounded-lg px-3 py-2 text-sm text-white/70 transition hover:bg-white/10 hover:text-white"
        >
          View profile
        </Link>
        <button
          type="button"
          onClick={handleSignOut}
          disabled={signingOut}
          className="block w-full rounded-lg px-3 py-2 text-left text-sm text-rose-300 transition hover:bg-white/10 hover:text-rose-200 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Sign out
        </button>
      </div>
    </details>
  )
}
