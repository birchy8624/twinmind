'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useMemo, useState } from 'react'

import { useToast } from './toast-context'
import { createClient } from '@/utils/supabaseBrowser'

type WorkspaceAccountMenuProps = {
  className?: string
}

export function WorkspaceAccountMenu({ className }: WorkspaceAccountMenuProps) {
  const router = useRouter()
  const { pushToast } = useToast()
  const supabase = useMemo(() => createClient(), [])
  const [isOpen, setIsOpen] = useState(false)
  const [signingOut, setSigningOut] = useState(false)

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
          EL
        </span>
        <span className="hidden text-xs uppercase tracking-wide text-white/60 lg:block">Evelyn Lopez</span>
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
