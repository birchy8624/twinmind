'use client'

import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import type { Session } from '@supabase/supabase-js'

import { fetchSetupProfile, updateSetupProfile } from '@/lib/api/profile'
import { createBrowserClient } from '@/lib/supabase/browser'

const MIN_PASSWORD_LENGTH = 8

type FormStatus = 'initializing' | 'ready' | 'submitting' | 'success' | 'error'

type UrlAuthParams = {
  code: string | null
  accessToken: string | null
  refreshToken: string | null
}

function getAuthParamsFromUrl(): UrlAuthParams {
  if (typeof window === 'undefined') {
    return { code: null, accessToken: null, refreshToken: null }
  }

  const hash = window.location.hash.startsWith('#') ? window.location.hash.slice(1) : ''
  const search = window.location.search.startsWith('?') ? window.location.search.slice(1) : ''

  const hashParams = hash ? new URLSearchParams(hash) : null
  const searchParams = search ? new URLSearchParams(search) : null

  const code = searchParams?.get('code') ?? hashParams?.get('code') ?? null
  const accessToken = hashParams?.get('access_token') ?? searchParams?.get('access_token') ?? null
  const refreshToken = hashParams?.get('refresh_token') ?? searchParams?.get('refresh_token') ?? null

  return { code, accessToken, refreshToken }
}

function clearAuthParamsFromUrl() {
  if (typeof window === 'undefined') {
    return
  }

  const url = new URL(window.location.href)

  url.hash = ''

  const authParams = ['code', 'token', 'type', 'access_token', 'refresh_token', 'error', 'error_description', 'state']

  for (const param of authParams) {
    url.searchParams.delete(param)
  }

  const cleanUrl = `${url.pathname}${url.search}`
  window.history.replaceState(null, document.title, cleanUrl)
}

async function syncServerAuthSession(
  supabase: ReturnType<typeof createBrowserClient>,
  initialSession: Session | null
) {
  let session = initialSession

  if (!session) {
    const { data, error } = await supabase.auth.getSession()

    if (error) {
      throw new Error(error.message)
    }

    session = data.session
  }

  if (!session) {
    throw new Error('We could not verify your confirmation link.')
  }

  try {
    const accessToken = session.access_token
    const refreshToken = session.refresh_token

    if (typeof accessToken !== 'string' || typeof refreshToken !== 'string') {
      console.warn('Missing Supabase session tokens while syncing auth cookie; skipping callback sync.')
      return
    }

    const response = await fetch('/api/auth/callback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      keepalive: true,
      body: JSON.stringify({
        event: 'SIGNED_IN',
        session: {
          ...session,
          access_token: accessToken,
          refresh_token: refreshToken
        }
      })
    })

    if (!response.ok) {
      const text = await response.text().catch(() => null)
      console.error('Failed to sync auth session with server', response.status, text)
      throw new Error('We could not verify your confirmation link. Please request a new email.')
    }
  } catch (error) {
    console.error('Failed to persist auth session cookie', error)
    throw new Error('We could not verify your confirmation link. Please request a new email.')
  }
}

function resolveMetadataName(metadata: Record<string, unknown> | undefined): string | null {
  if (!metadata) {
    return null
  }

  const candidates: unknown[] = [
    metadata['full_name'],
    metadata['name'],
    metadata['first_name'],
    metadata['last_name']
  ]

  const resolved = candidates
    .map((value) => (typeof value === 'string' ? value.trim() : ''))
    .filter(Boolean)

  if (resolved.length === 0) {
    return null
  }

  if (resolved[0] && resolved[1] && !resolved[0]?.includes(' ')) {
    return `${resolved[0]} ${resolved[1]}`.trim()
  }

  return resolved[0]
}

export default function SetupAccountForm() {
  const router = useRouter()
  const supabase = useMemo(createBrowserClient, [])

  const [status, setStatus] = useState<FormStatus>('initializing')
  const [error, setError] = useState<string | null>(null)
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [activeProfileId, setActiveProfileId] = useState<string | null>(null)
  const [hasExistingAccount, setHasExistingAccount] = useState(true)

  useEffect(() => {
    let isMounted = true

    const prepareSession = async () => {
      try {
        setStatus('initializing')

        const { code, accessToken, refreshToken } = getAuthParamsFromUrl()
        let sessionFromAuth: Session | null = null

        if (code) {
          const currentUrl = window.location.href
          const { data, error: sessionError } = await supabase.auth.exchangeCodeForSession(currentUrl)

          if (sessionError && sessionError.message !== 'Auth session missing!') {
            throw new Error(sessionError.message)
          }

          sessionFromAuth = data.session
          clearAuthParamsFromUrl()
        } else if (accessToken && refreshToken) {
          const { data, error: sessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken
          })

          if (sessionError && sessionError.message !== 'Auth session missing!') {
            throw new Error(sessionError.message)
          }

          sessionFromAuth = data.session
          clearAuthParamsFromUrl()
        }

        await syncServerAuthSession(supabase, sessionFromAuth)

        const { data: userData, error: userError } = await supabase.auth.getUser()

        if (userError) {
          throw new Error(userError.message)
        }

        const user = userData?.user

        if (!user) {
          throw new Error('We could not verify your confirmation link.')
        }

        let derivedName = resolveMetadataName(user.user_metadata)
        let derivedCompany: string | null = null
        let accountExists = true

        try {
          const response = await fetchSetupProfile()

          const profileRow = response.profile
          const profileName = typeof profileRow.full_name === 'string' ? profileRow.full_name.trim() : ''
          if (profileName) {
            derivedName = profileName
          }

          const profileEmail = typeof profileRow.email === 'string' ? profileRow.email.trim() : ''
          if (profileEmail) {
            setEmail(profileEmail)
          }

          const profileCompany = typeof profileRow.company === 'string' ? profileRow.company.trim() : ''
          if (profileCompany) {
            derivedCompany = profileCompany
          }

          accountExists = Boolean(response.account)
        } catch (profileError) {
          console.error('Failed to load profile details while preparing setup form', profileError)
        }

        const resolvedEmail = user.email ? user.email.trim() : ''

        if (isMounted) {
          setActiveProfileId(user.id)
          setFullName((derivedName ?? resolvedEmail) || '')
          setEmail((previous) => previous || resolvedEmail)
          setCompanyName(derivedCompany ?? '')
          setHasExistingAccount(accountExists)
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
            : 'We could not verify your confirmation link. Please request a new link to continue.'
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
    const trimmedCompany = companyName.trim()
    const trimmedEmail = email.trim()

    if (!trimmedName) {
      setError('Please enter your full name to continue.')
      return
    }

    if (!hasExistingAccount && !trimmedCompany) {
      setError('Please enter your company name to continue.')
      return
    }

    const shouldUpdatePassword = hasExistingAccount

    if (shouldUpdatePassword) {
      if (!password || password.length < MIN_PASSWORD_LENGTH) {
        setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters long.`)
        return
      }

      if (password !== confirmPassword) {
        setError('Passwords do not match. Please try again.')
        return
      }
    }

    try {
      setStatus('submitting')
      setError(null)

      const { error: updateError } = await supabase.auth.updateUser(
        shouldUpdatePassword
          ? { password, data: { full_name: trimmedName } }
          : { data: { full_name: trimmedName } }
      )

      if (updateError) {
        throw new Error(updateError.message)
      }

      const response = await updateSetupProfile({
        fullName: trimmedName,
        email: trimmedEmail || null,
        companyName: trimmedCompany || null
      })

      setStatus('success')

      const nextRoute = response.createdAccount ? '/app/clients/new' : '/app/dashboard'
      router.replace(nextRoute)
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
  const shouldShowPasswordFields = hasExistingAccount

  if (status === 'initializing') {
    return (
      <section className="mx-auto w-full max-w-2xl space-y-6">
        <div className="rounded-2xl border border-white/10 bg-base-900/60 p-8 shadow-lg shadow-black/10">
          <header className="space-y-2">
            <span className="text-xs font-semibold uppercase tracking-[0.3em] text-limeglow-400/70">Workspace setup</span>
            <h2 className="text-2xl font-semibold text-white">Preparing your account…</h2>
            <p className="text-sm text-white/70">Hold tight while we confirm your access and load your account details.</p>
          </header>
          <p className="mt-6 rounded-lg border border-white/10 bg-base-900/70 px-4 py-3 text-sm text-white/70">Preparing your workspace…</p>
        </div>
      </section>
    )
  }

  if (status === 'error') {
    return (
      <section className="mx-auto w-full max-w-2xl space-y-6 text-center">
        <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-8 text-white">
          <h2 className="text-2xl font-semibold">We could not verify your account</h2>
          <p className="mt-3 text-sm text-rose-100/80">
            {error ?? 'This confirmation link may have expired. Please request a new link to continue.'}
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
            Set your details so we can personalise your TwinMinds workspace. We&apos;ll use this information to finish preparing your
            access.
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
            <label className="text-xs font-semibold uppercase tracking-wide text-white/60">Company name</label>
            <input
              type="text"
              value={companyName}
              onChange={(event) => setCompanyName(event.target.value)}
              required={!hasExistingAccount}
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

          {shouldShowPasswordFields ? (
            <>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-white/60">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  minLength={MIN_PASSWORD_LENGTH}
                  autoComplete="new-password"
                  required={shouldShowPasswordFields}
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
                  required={shouldShowPasswordFields}
                  disabled={isSubmitting}
                  className="mt-2 w-full rounded-lg border border-white/10 bg-base-900/60 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-white/30 focus:outline-none focus:ring-2 focus:ring-white/20 disabled:opacity-50"
                />
              </div>
            </>
          ) : null}

          {error ? (
            <p className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">{error}</p>
          ) : null}

          <button type="submit" disabled={isSubmitting} className="btn btn-primary w-full">
            {isSubmitting ? 'Saving your details…' : 'Save and continue'}
          </button>
        </form>

        {status === 'success' ? (
          <div className="mt-6 rounded-lg border border-limeglow-400/30 bg-limeglow-400/10 px-4 py-3 text-sm text-limeglow-100">
            Details saved! Redirecting you to your workspace…
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
