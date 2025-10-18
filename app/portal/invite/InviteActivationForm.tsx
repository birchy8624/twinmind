'use client'

import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'

import { createBrowserClient } from '@/lib/supabase/browser'

const MIN_PASSWORD_LENGTH = 8

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

export default function InviteActivationForm() {
  const router = useRouter()
  const supabase = useMemo(createBrowserClient, [])

  const [status, setStatus] = useState<FormStatus>('initializing')
  const [error, setError] = useState<string | null>(null)
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

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

        if (!isMounted) {
          return
        }

        setEmail(user.email ?? '')
        const derivedFullName = typeof user.user_metadata?.full_name === 'string' ? user.user_metadata.full_name : ''
        setFullName(derivedFullName)
        setStatus('ready')
        setError(null)
      } catch (cause) {
        console.error('Failed to prepare invite session', cause)

        if (!isMounted) {
          return
        }

        setStatus('error')
        setError(
          cause instanceof Error
            ? cause.message
            : 'We could not verify your invitation link. Please request a new invite from your TwinMinds contact.'
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

    if (status !== 'ready') {
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

      const { error: updateError } = await supabase.auth.updateUser({ password })

      if (updateError) {
        throw new Error(updateError.message)
      }

      setStatus('success')
      router.replace('/portal')
      router.refresh()
    } catch (cause) {
      console.error('Failed to activate invite', cause)
      setStatus('ready')
      setError(
        cause instanceof Error
          ? cause.message
          : 'Something went wrong while creating your password. Please try again.'
      )
    }
  }

  const isSubmitting = status === 'submitting'

  return (
    <section className="mx-auto w-full max-w-xl space-y-6">
      <div className="rounded-2xl border border-white/10 bg-base-900/50 p-8 shadow-lg shadow-black/10">
        <header className="space-y-2">
          <span className="text-xs font-semibold uppercase tracking-[0.3em] text-limeglow-400/70">Client portal</span>
          <h2 className="text-2xl font-semibold text-white">Set your password to get started</h2>
          <p className="text-sm text-white/70">
            Your email has been verified. Choose a secure password to finish activating your TwinMinds portal access.
          </p>
        </header>

        {status === 'initializing' ? (
          <p className="mt-6 rounded-lg border border-white/10 bg-base-900/70 px-4 py-3 text-sm text-white/70">
            Verifying your invitation…
          </p>
        ) : null}

        {status === 'error' ? (
          <div className="mt-6 space-y-3">
            <p className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
              {error ?? 'We could not verify your invitation link. Please request a new invite from your TwinMinds contact.'}
            </p>
            <p className="text-xs text-white/50">
              Need help? <a href="mailto:hello@twinminds.studio" className="text-limeglow-400 hover:text-limeglow-300">Contact our team</a>.
            </p>
          </div>
        ) : null}

        {status === 'ready' || status === 'submitting' ? (
          <form onSubmit={handleSubmit} className="mt-6 space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-white/60">Full name</label>
                <input
                  type="text"
                  value={fullName}
                  readOnly
                  className="mt-2 w-full rounded-lg border border-white/10 bg-base-900/60 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-white/30 focus:outline-none focus:ring-2 focus:ring-white/20"
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

            <button
              type="submit"
              disabled={isSubmitting}
              className="btn btn-primary w-full"
            >
              {isSubmitting ? 'Saving password…' : 'Start using the portal'}
            </button>
          </form>
        ) : null}

        {status === 'success' ? (
          <div className="mt-6 rounded-lg border border-limeglow-400/30 bg-limeglow-400/10 px-4 py-3 text-sm text-limeglow-100">
            Password saved! Redirecting you to your portal…
          </div>
        ) : null}
      </div>

      <p className="text-center text-xs text-white/50">
        Having trouble? <a href="mailto:hello@twinminds.studio" className="text-limeglow-400 hover:text-limeglow-300">Reach out to TwinMinds support</a> for assistance.
      </p>
    </section>
  )
}
