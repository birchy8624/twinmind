'use client'

import { useEffect, useMemo, useState, type FormEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

import { createBrowserClient } from '@/lib/supabase/browser'

const MIN_PASSWORD_LENGTH = 8

export default function ResetPasswordForm() {
  const router = useRouter()
  const supabase = useMemo(createBrowserClient, [])
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isVerifying, setIsVerifying] = useState(true)
  const [tokenError, setTokenError] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''))
    const type = hashParams.get('type')
    const accessToken = hashParams.get('access_token')
    const refreshToken = hashParams.get('refresh_token')

    if (type !== 'recovery' || !accessToken || !refreshToken) {
      setTokenError('This password reset link is invalid or has expired. Please request a new one from the sign in page.')
      setIsVerifying(false)
      return
    }

    void (async () => {
      try {
        const { data, error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        })

        if (error) {
          console.error('Failed to set Supabase session from recovery link', error)
          setTokenError('We could not verify your password reset link. Please request a new one from the sign in page.')
          return
        }

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
            console.error('Failed to persist Supabase session during password recovery', callbackError)
          }
        }

        window.history.replaceState({}, document.title, window.location.pathname + window.location.search)
        setTokenError(null)
      } catch (cause) {
        console.error('Unexpected error while verifying recovery link', cause)
        setTokenError('We could not verify your password reset link. Please request a new one from the sign in page.')
      } finally {
        setIsVerifying(false)
      }
    })()
  }, [supabase])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (isSubmitting || successMessage || tokenError) {
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
      setIsSubmitting(true)
      setError(null)

      const { error: updateError } = await supabase.auth.updateUser({ password })

      if (updateError) {
        setError(updateError.message || 'We could not update your password. Please try again.')
        return
      }

      setSuccessMessage('Your password has been updated. You can now continue to your workspace.')
      setPassword('')
      setConfirmPassword('')
    } catch (cause) {
      console.error('Failed to update password', cause)
      setError('Something went wrong while updating your password. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isVerifying) {
    return (
      <div className="space-y-4 text-center">
        <div className="flex items-center justify-center">
          <span className="h-12 w-12 animate-spin rounded-full border-2 border-limeglow-500/60 border-t-transparent" />
        </div>
        <div className="space-y-1">
          <h2 className="text-xl font-semibold text-white">Verifying reset link…</h2>
          <p className="text-sm text-white/70">Hang tight while we confirm your password reset request.</p>
        </div>
      </div>
    )
  }

  if (tokenError) {
    return (
      <div className="space-y-4 text-center">
        <h2 className="text-xl font-semibold text-white">Password reset link expired</h2>
        <p className="text-sm text-white/70">{tokenError}</p>
        <div className="space-y-2">
          <Link href="/sign_in" className="btn btn-primary w-full">
            Return to sign in
          </Link>
          <Link href="/sign_in" className="block text-sm font-medium text-limeglow-400 transition hover:text-limeglow-300">
            Request a new password reset link
          </Link>
        </div>
      </div>
    )
  }

  if (successMessage) {
    return (
      <div className="space-y-4 text-center">
        <h2 className="text-xl font-semibold text-white">Password updated</h2>
        <p className="text-sm text-white/70">{successMessage}</p>
        <div className="space-y-2">
          <button
            type="button"
            className="btn btn-primary w-full"
            onClick={() => {
              router.replace('/app/dashboard')
              router.refresh()
            }}
          >
            Go to your workspace
          </button>
          <Link href="/sign_in" className="block text-sm font-medium text-limeglow-400 transition hover:text-limeglow-300">
            Return to the sign in page
          </Link>
        </div>
      </div>
    )
  }

  return (
    <form className="space-y-5" onSubmit={handleSubmit}>
      <div className="space-y-1">
        <h2 className="text-xl font-semibold text-white">Choose a new password</h2>
        <p className="text-sm text-white/70">
          Enter a secure password you will use to access your TwinMinds Studio workspace.
        </p>
      </div>
      <div>
        <label htmlFor="password" className="block text-sm text-white/80">
          New password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={MIN_PASSWORD_LENGTH}
          required
          className="mt-2 w-full rounded-xl bg-base-700/60 px-4 py-3 text-base text-white ring-1 ring-white/10 outline-none transition focus:ring-2 focus:ring-limeglow-500/40"
          placeholder="Enter a new password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          disabled={isSubmitting}
        />
        <p className="mt-1 text-xs text-white/50">Minimum {MIN_PASSWORD_LENGTH} characters.</p>
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
        />
      </div>
      {error ? (
        <p className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">{error}</p>
      ) : null}
      <button type="submit" className="btn btn-primary w-full" disabled={isSubmitting}>
        {isSubmitting ? 'Saving new password…' : 'Save new password'}
      </button>
    </form>
  )
}
