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

export default function ResetPasswordForm() {
  const router = useRouter()
  const supabase = useMemo(createBrowserClient, [])

  const [status, setStatus] = useState<FormStatus>('initializing')
  const [error, setError] = useState<string | null>(null)
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
          throw new Error('We could not find a valid password reset session. Please request a new reset link.')
        }

        if (!isMounted) {
          return
        }

        setEmail(user.email ?? '')
        setStatus('ready')
        setError(null)
      } catch (cause) {
        console.error('Failed to prepare password recovery session', cause)

        if (!isMounted) {
          return
        }

        setStatus('error')
        setError(
          cause instanceof Error
            ? cause.message
            : 'We could not verify your password reset link. Please request a new link and try again.'
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
      router.replace('/app/dashboard')
      router.refresh()
    } catch (cause) {
      console.error('Failed to reset password', cause)
      setStatus('ready')
      setError(
        cause instanceof Error
          ? cause.message
          : 'Something went wrong while updating your password. Please try again.'
      )
    }
  }

  const isSubmitting = status === 'submitting'

  return (
    <section className="mx-auto w-full max-w-xl space-y-6">
      <div className="rounded-2xl border border-white/10 bg-base-900/50 p-8 shadow-lg shadow-black/10">
        <header className="space-y-2">
          <span className="text-xs font-semibold uppercase tracking-[0.3em] text-limeglow-400/70">Password reset</span>
          <h2 className="text-2xl font-semibold text-white">Choose a new password</h2>
          <p className="text-sm text-white/70">
            {email
              ? `Reset the password for ${email}. Enter a new password below to regain access to your TwinMinds account.`
              : 'Enter a new password below to regain access to your TwinMinds account.'}
          </p>
        </header>

        {status === 'initializing' ? (
          <p className="mt-6 rounded-lg border border-white/10 bg-base-900/70 px-4 py-3 text-sm text-white/70">
            Verifying your password reset link…
          </p>
        ) : null}

        {status === 'error' ? (
          <div className="mt-6 space-y-3">
            <p className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
              {error ?? 'We could not verify your password reset link. Please request a new link and try again.'}
            </p>
            <p className="text-xs text-white/50">
              Need help?{' '}
              <a href="mailto:hello@twinminds.studio" className="text-limeglow-400 hover:text-limeglow-300">
                Contact our team
              </a>
              .
            </p>
          </div>
        ) : null}

        {status === 'ready' || status === 'submitting' ? (
          <form onSubmit={handleSubmit} className="mt-6 space-y-5">
            <div>
              <label htmlFor="password" className="block text-sm text-white/80">
                New password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                required
                className="mt-2 w-full rounded-xl bg-base-700/60 px-4 py-3 text-base text-white ring-1 ring-white/10 outline-none transition focus:ring-2 focus:ring-limeglow-500/40"
                placeholder="Enter a new password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                disabled={isSubmitting}
                minLength={MIN_PASSWORD_LENGTH}
              />
            </div>
            <div>
              <label htmlFor="confirm-password" className="block text-sm text-white/80">
                Confirm password
              </label>
              <input
                id="confirm-password"
                name="confirm-password"
                type="password"
                autoComplete="new-password"
                required
                className="mt-2 w-full rounded-xl bg-base-700/60 px-4 py-3 text-base text-white ring-1 ring-white/10 outline-none transition focus:ring-2 focus:ring-limeglow-500/40"
                placeholder="Re-enter your new password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                disabled={isSubmitting}
                minLength={MIN_PASSWORD_LENGTH}
              />
            </div>
            {error && status !== 'error' ? (
              <p className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">{error}</p>
            ) : null}
            <button type="submit" className="btn btn-primary w-full" disabled={isSubmitting}>
              {isSubmitting ? 'Saving new password…' : 'Save new password'}
            </button>
          </form>
        ) : null}
      </div>
    </section>
  )
}
