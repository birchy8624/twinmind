'use client'

import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'

import { createBrowserClient } from '@/lib/supabase/browser'

const MIN_PASSWORD_LENGTH = 8

const PROFILES_TABLE = 'profiles' as const

type FormStatus = 'initializing' | 'ready' | 'submitting' | 'success' | 'error'

type SessionParams = {
  accessToken: string
  refreshToken: string
}

function getSessionParamsFromUrl(): SessionParams | null {
  if (typeof window === 'undefined') {
    return null
  }

  const hash = window.location.hash.startsWith('#') ? window.location.hash.slice(1) : ''
  const search = window.location.search.startsWith('?') ? window.location.search.slice(1) : ''
  const rawParams = hash || search

  if (!rawParams) {
    return null
  }

  const params = new URLSearchParams(rawParams)
  const accessToken = params.get('access_token')
  const refreshToken = params.get('refresh_token')

  if (!accessToken || !refreshToken) {
    return null
  }

  return { accessToken, refreshToken }
}

function clearAuthParamsFromUrl() {
  if (typeof window === 'undefined') {
    return
  }

  const { pathname, search } = window.location
  const cleanUrl = `${pathname}${search}`
  window.history.replaceState(null, document.title, cleanUrl)
}

function resolveMetadataName(metadata: Record<string, unknown> | undefined): string | null {
  if (!metadata) {
    return null
  }

  const fullName = typeof metadata['full_name'] === 'string' ? metadata['full_name'] : null
  const firstName = typeof metadata['first_name'] === 'string' ? metadata['first_name'] : null
  const lastName = typeof metadata['last_name'] === 'string' ? metadata['last_name'] : null
  const fallback = typeof metadata['name'] === 'string' ? metadata['name'] : null

  const combined = fullName || (firstName && lastName ? `${firstName} ${lastName}` : firstName || fallback)
  const trimmed = typeof combined === 'string' ? combined.trim() : ''

  return trimmed || null
}

export default function SetupAccountForm() {
  const router = useRouter()
  const supabase = useMemo(createBrowserClient, [])

  const [status, setStatus] = useState<FormStatus>('initializing')
  const [error, setError] = useState<string | null>(null)
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [activeProfileId, setActiveProfileId] = useState<string | null>(null)

  useEffect(() => {
    let isMounted = true

    const prepareSession = async () => {
      try {
        const urlParams = getSessionParamsFromUrl()

        if (urlParams) {
          const { error: sessionError } = await supabase.auth.setSession({
            access_token: urlParams.accessToken,
            refresh_token: urlParams.refreshToken
          })

          if (sessionError) {
            throw new Error(sessionError.message)
          }

          clearAuthParamsFromUrl()
        }

        const { data: userData, error: userError } = await supabase.auth.getUser()

        if (userError) {
          throw new Error(userError.message)
        }

        const user = userData?.user

        if (!user) {
          throw new Error('Invitation session is missing user information.')
        }

        let derivedName = resolveMetadataName(user.user_metadata)

        try {
          const { data: profileRow, error: profileError } = await supabase
            .from(PROFILES_TABLE)
            .select('full_name, email')
            .eq('id', user.id)
            .maybeSingle()

          if (profileError) {
            throw profileError
          }

          const profileName = typeof profileRow?.full_name === 'string' ? profileRow.full_name.trim() : ''
          if (profileName) {
            derivedName = profileName
          }

          const profileEmail = typeof profileRow?.email === 'string' ? profileRow.email.trim() : ''
          if (profileEmail) {
            setEmail(profileEmail)
          }
        } catch (profileError) {
          console.error('Failed to load profile details while preparing setup form', profileError)
        }

        const resolvedEmail = user.email ? user.email.trim() : ''

        if (isMounted) {
          setActiveProfileId(user.id)
          setFullName(derivedName ?? resolvedEmail)
          setEmail((previous) => previous || resolvedEmail)
          setStatus('ready')
          setError(null)
        }
      } catch (cause) {
        console.error('Failed to prepare account setup session', cause)

        if (!isMounted) {
          return
        }

        setStatus('error')
        setError(
          cause instanceof Error
            ? cause.message
            : 'We could not verify your invitation link. Please request a new invite from your TwinMinds administrator.'
        )
      }
    }

    void prepareSession()

    return () => {
      isMounted = false
    }
  }, [supabase])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (status !== 'ready' || !activeProfileId) {
      return
    }

    const trimmedName = fullName.trim()

    if (!trimmedName) {
      setError('Please enter your full name to continue.')
      return
    }

    if (!password || password.length < MIN_PASSWORD_LENGTH) {
      setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters long.`)
      return
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match. Please try again.')
      return
    }

    try {
      setStatus('submitting')
      setError(null)

      const { error: updateError } = await supabase.auth.updateUser({
        password,
        data: { full_name: trimmedName }
      })

      if (updateError) {
        throw new Error(updateError.message)
      }

      const { error: profileError } = await supabase
        .from(PROFILES_TABLE)
        .update({
          full_name: trimmedName,
          email: email.trim() || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', activeProfileId)

      if (profileError) {
        throw profileError
      }

      setStatus('success')
      router.replace('/app/dashboard')
      router.refresh()
    } catch (cause) {
      console.error('Failed to complete account setup', cause)
      setStatus('ready')
      setError(
        cause instanceof Error
          ? cause.message || 'Something went wrong while saving your details. Please try again.'
          : 'Something went wrong while saving your details. Please try again.'
      )
    }
  }

  const isSubmitting = status === 'submitting'

  if (status === 'initializing') {
    return (
      <section className="mx-auto w-full max-w-2xl space-y-6">
        <div className="rounded-2xl border border-white/10 bg-base-900/60 p-8 shadow-lg shadow-black/10">
          <header className="space-y-2">
            <span className="text-xs font-semibold uppercase tracking-[0.3em] text-limeglow-400/70">Workspace setup</span>
            <h2 className="text-2xl font-semibold text-white">Preparing your account…</h2>
            <p className="text-sm text-white/70">Hold tight while we confirm your invitation and load your account details.</p>
          </header>
          <p className="mt-6 rounded-lg border border-white/10 bg-base-900/70 px-4 py-3 text-sm text-white/70">Verifying your invitation…</p>
        </div>
      </section>
    )
  }

  if (status === 'error') {
    return (
      <section className="mx-auto w-full max-w-2xl space-y-6 text-center">
        <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-8 text-white">
          <h2 className="text-2xl font-semibold">We could not verify your invite</h2>
          <p className="mt-3 text-sm text-rose-100/80">
            {error ?? 'This invitation link may have expired. Please request a new invite from your TwinMinds administrator.'}
          </p>
        </div>
        <p className="text-xs text-white/50">
          Need help?{' '}
          <a href="mailto:hello@twinminds.studio" className="text-limeglow-400 hover:text-limeglow-300">
            Contact our team
          </a>
          .
        </p>
      </section>
    )
  }

  return (
    <section className="mx-auto w-full max-w-2xl space-y-6">
      <div className="rounded-2xl border border-white/10 bg-base-900/60 p-8 shadow-lg shadow-black/10">
        <header className="space-y-2">
          <span className="text-xs font-semibold uppercase tracking-[0.3em] text-limeglow-400/70">Workspace setup</span>
          <h2 className="text-2xl font-semibold text-white">Complete your TwinMinds account</h2>
          <p className="text-sm text-white/70">
            Set your name and choose a secure password so you can start collaborating inside the TwinMinds workspace.
          </p>
        </header>

        <form onSubmit={handleSubmit} className="mt-6 space-y-5">
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-white/60">Full name</label>
            <input
              type="text"
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              required
              disabled={isSubmitting}
              className="mt-2 w-full rounded-lg border border-white/10 bg-base-900/60 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-white/30 focus:outline-none focus:ring-2 focus:ring-white/20 disabled:opacity-50"
            />
          </div>

          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-white/60">Email</label>
            <input
              type="email"
              value={email}
              readOnly
              className="mt-2 w-full rounded-lg border border-white/10 bg-base-900/60 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-white/30 focus:outline-none focus:ring-2 focus:ring-white/20"
            />
          </div>

          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-white/60">Password</label>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              minLength={MIN_PASSWORD_LENGTH}
              autoComplete="new-password"
              required
              disabled={isSubmitting}
              className="mt-2 w-full rounded-lg border border-white/10 bg-base-900/60 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-white/30 focus:outline-none focus:ring-2 focus:ring-white/20 disabled:opacity-50"
            />
            <p className="mt-1 text-xs text-white/50">Minimum {MIN_PASSWORD_LENGTH} characters.</p>
          </div>

          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-white/60">Confirm password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              autoComplete="new-password"
              required
              disabled={isSubmitting}
              className="mt-2 w-full rounded-lg border border-white/10 bg-base-900/60 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-white/30 focus:outline-none focus:ring-2 focus:ring-white/20 disabled:opacity-50"
            />
          </div>

          {error ? (
            <p className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">{error}</p>
          ) : null}

          <button type="submit" disabled={isSubmitting} className="btn btn-primary w-full">
            {isSubmitting ? 'Saving your account…' : 'Save and continue'}
          </button>
        </form>

        {status === 'success' ? (
          <div className="mt-6 rounded-lg border border-limeglow-400/30 bg-limeglow-400/10 px-4 py-3 text-sm text-limeglow-100">
            Account saved! Redirecting you to your dashboard…
          </div>
        ) : null}
      </div>

      <p className="text-center text-xs text-white/50">
        Need help?{' '}
        <a href="mailto:hello@twinminds.studio" className="text-limeglow-400 hover:text-limeglow-300">
          Contact TwinMinds support
        </a>{' '}
        for assistance.
      </p>
    </section>
  )
}
