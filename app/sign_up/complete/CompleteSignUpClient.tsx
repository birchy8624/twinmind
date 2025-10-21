'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

import { createBrowserClient } from '@/lib/supabase/browser'

type CompletionStatus = 'verifying' | 'redirecting' | 'error'

type SessionParams = {
  accessToken: string
  refreshToken: string
}

type ResolvedAuthParams =
  | { status: 'session'; params: SessionParams }
  | { status: 'error'; message: string }

function collectAuthParams(): ResolvedAuthParams {
  if (typeof window === 'undefined') {
    return { status: 'error', message: 'This confirmation link is not valid in the current context.' }
  }

  const aggregate = new URLSearchParams()
  const applyParams = (raw: string | null | undefined) => {
    if (!raw) {
      return
    }

    const parsed = new URLSearchParams(raw)

    for (const [key, value] of parsed.entries()) {
      aggregate.set(key, value)
    }
  }

  const hash = window.location.hash.startsWith('#') ? window.location.hash.slice(1) : window.location.hash
  const search = window.location.search.startsWith('?') ? window.location.search.slice(1) : window.location.search

  applyParams(hash)
  applyParams(search)

  const errorDescription = aggregate.get('error_description') || aggregate.get('error')

  if (errorDescription) {
    return {
      status: 'error',
      message: errorDescription,
    }
  }

  const accessToken = aggregate.get('access_token') || aggregate.get('token')
  const refreshToken = aggregate.get('refresh_token')

  if (!accessToken || !refreshToken) {
    return {
      status: 'error',
      message: 'This confirmation link is invalid or has expired. Please request a new invite or sign up again.',
    }
  }

  return {
    status: 'session',
    params: {
      accessToken,
      refreshToken,
    },
  }
}

function clearAuthParamsFromUrl() {
  if (typeof window === 'undefined') {
    return
  }

  window.history.replaceState({}, document.title, window.location.pathname)
}

export default function CompleteSignUpClient() {
  const router = useRouter()
  const supabase = useMemo(createBrowserClient, [])
  const [status, setStatus] = useState<CompletionStatus>('verifying')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    const resolution = collectAuthParams()

    if (resolution.status === 'error') {
      setStatus('error')
      setErrorMessage(resolution.message)
      return
    }

    void (async () => {
      try {
        const { params } = resolution
        const { data, error } = await supabase.auth.setSession({
          access_token: params.accessToken,
          refresh_token: params.refreshToken,
        })

        if (error) {
          throw new Error(error.message)
        }

        clearAuthParamsFromUrl()

        if (data.session) {
          try {
            await fetch('/api/auth/callback', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'same-origin',
              keepalive: true,
              body: JSON.stringify({ event: 'SIGNED_IN', session: data.session }),
            })
          } catch (callbackError) {
            console.error('Failed to persist Supabase session during sign up completion', callbackError)
          }
        }

        setStatus('redirecting')
        router.replace('/app/setup-account')
        router.refresh()
      } catch (cause) {
        console.error('Failed to complete email confirmation flow', cause)
        setStatus('error')
        setErrorMessage(
          cause instanceof Error
            ? cause.message ||
              'We could not verify your confirmation link. Please request a new invite or try signing up again.'
            : 'We could not verify your confirmation link. Please request a new invite or try signing up again.'
        )
      }
    })()
  }, [router, supabase])

  if (status === 'redirecting') {
    return (
      <div className="space-y-4 text-center">
        <div className="flex items-center justify-center">
          <span className="h-12 w-12 animate-spin rounded-full border-2 border-limeglow-500/60 border-t-transparent" />
        </div>
        <div className="space-y-1">
          <h2 className="text-xl font-semibold text-white">Email confirmed!</h2>
          <p className="text-sm text-white/70">Redirecting you to finish setting up your TwinMinds Studio account.</p>
        </div>
        <p className="text-xs text-white/50">If you are not redirected automatically, continue below.</p>
        <Link href="/app/setup-account" className="btn btn-primary w-full">
          Continue to account setup
        </Link>
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className="space-y-4 text-center">
        <h2 className="text-xl font-semibold text-white">We couldn&apos;t confirm your email</h2>
        <p className="text-sm text-white/70">{errorMessage}</p>
        <div className="space-y-2">
          <Link href="/sign_in" className="btn btn-primary w-full">
            Return to sign in
          </Link>
          <a
            href="mailto:hello@twinminds.studio"
            className="block text-sm font-medium text-limeglow-400 transition hover:text-limeglow-300"
          >
            Contact support
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4 text-center">
      <div className="flex items-center justify-center">
        <span className="h-12 w-12 animate-spin rounded-full border-2 border-limeglow-500/60 border-t-transparent" />
      </div>
      <div className="space-y-1">
        <h2 className="text-xl font-semibold text-white">Confirming your email…</h2>
        <p className="text-sm text-white/70">Sit tight while we securely verify your TwinMinds Studio invitation.</p>
      </div>
    </div>
  )
}
