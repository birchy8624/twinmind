'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useRef, useState } from 'react'

import { useActiveProfile } from './active-profile-context'
import { useToast } from './toast-context'
import { createBrowserClient } from '@/lib/supabase/browser'

import type { Database } from '@/types/supabase'

type WorkspaceAccountMenuProps = {
  className?: string
  showOnMobile?: boolean
}

type AccountRole = Database['public']['Enums']['account_role']

type SignOutScope = Parameters<ReturnType<typeof createBrowserClient>['auth']['signOut']>[0]

type SignOutPayload = SignOutScope extends { scope: infer Value } ? Value : never

export function WorkspaceAccountMenu({ className, showOnMobile = false }: WorkspaceAccountMenuProps) {
  const router = useRouter()
  const { pushToast } = useToast()
  const supabase = useMemo(createBrowserClient, [])
  const [isOpen, setIsOpen] = useState(false)
  const [signingOut, setSigningOut] = useState(false)
  const { profile, loading, account } = useActiveProfile()
  const containerRef = useRef<HTMLDetailsElement | null>(null)

  useEffect(() => {
    if (!isOpen) {
      return
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (!containerRef.current) {
        return
      }

      if (!containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    window.addEventListener('pointerdown', handlePointerDown)

    return () => {
      window.removeEventListener('pointerdown', handlePointerDown)
    }
  }, [isOpen])

  const profileRole: AccountRole | null = account?.role ?? profile?.role ?? null
  const displayName = profile?.displayName ?? (loading ? 'Loading…' : 'Account')

  const initials = useMemo(() => {
    if (!profile) {
      return '??'
    }

    const source = profile.displayName.trim() || profile.email?.trim() || ''
    if (!source || source === 'Account') {
      return '??'
    }

    const parts = source
      .split(/\s+/)
      .map((segment) => segment.trim())
      .filter(Boolean)

    if (parts.length >= 2) {
      return `${parts[0]?.[0] ?? ''}${parts[1]?.[0] ?? ''}`.toUpperCase() || '??'
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
  }, [profile])

  const handleSignOut = async () => {
    if (signingOut) {
      return
    }

    setSigningOut(true)

    try {
      const { error } = await supabase.auth.signOut({ scope: 'global' as SignOutPayload })

      if (error) {
        pushToast({
          title: 'Unable to sign out',
          description: error.message,
          variant: 'error'
        })
        setSigningOut(false)
        return
      }

      try {
        await fetch('/api/auth/callback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          keepalive: true,
          body: JSON.stringify({ event: 'SIGNED_OUT' })
        })
      } catch (callbackError) {
        console.error('Failed to sync server sign out state', callbackError)
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
  }

  const detailsClassName = [
    'relative',
    showOnMobile ? 'block' : 'hidden md:block',
    'ml-2',
    className
  ]
    .filter(Boolean)
    .join(' ')

  const isOwner = profileRole === 'owner'

  return (
    <details
      ref={containerRef}
      className={detailsClassName}
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
        {isOwner ? (
          <>
            <Link
              href="/app/billing"
              className="block rounded-lg px-3 py-2 text-sm text-white/70 transition hover:bg-white/10 hover:text-white"
            >
              Billing &amp; plans
            </Link>
            <Link
              href="/app/user-management"
              className="block rounded-lg px-3 py-2 text-sm text-white/70 transition hover:bg-white/10 hover:text-white"
            >
              User management
            </Link>
          </>
        ) : null}
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
