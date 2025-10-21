'use client'

import { useMemo, useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'

import { createBrowserClient } from '@/lib/supabase/browser'

type AuthMode = 'sign-in' | 'sign-up' | 'reset'

const MIN_PASSWORD_LENGTH = 8

export default function SignInForm() {
  const router = useRouter()
  const supabase = useMemo(createBrowserClient, [])
  const [mode, setMode] = useState<AuthMode>('sign-in')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [resetError, setResetError] = useState<string | null>(null)
  const [resetSuccess, setResetSuccess] = useState<string | null>(null)
  const [resetLoading, setResetLoading] = useState(false)
  const [signUpError, setSignUpError] = useState<string | null>(null)
  const [signUpSuccess, setSignUpSuccess] = useState<string | null>(null)
  const [signUpLoading, setSignUpLoading] = useState(false)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    const email = String(formData.get('email') ?? '').trim()
    const password = String(formData.get('password') ?? '')

    if (!email || !password) {
      setError('Please enter both your email and password.')
      return
    }

    try {
      setLoading(true)
      setError(null)

      const {
        data: { session },
        error: signInError
      } = await supabase.auth.signInWithPassword({
        email,
        password
      })

      if (signInError) {
        setError(signInError.message)
        return
      }

      if (session) {
        await fetch('/api/auth/callback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          keepalive: true,
          body: JSON.stringify({ event: 'SIGNED_IN', session })
        })
      }

      router.replace('/app/dashboard')
      router.refresh()
    } catch (cause) {
      console.error('Failed to sign in', cause)
      setError('Something went wrong while signing you in. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleResetSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = event.currentTarget
    const formData = new FormData(form)
    const email = String(formData.get('reset-email') ?? '').trim()

    if (!email) {
      setResetError('Please enter the email address associated with your account.')
      setResetSuccess(null)
      return
    }

    try {
      setResetLoading(true)
      setResetError(null)
      setResetSuccess(null)

      const redirectTo =
        typeof window !== 'undefined'
          ? new URL('/reset-password', window.location.origin).toString()
          : undefined

      const { error: resetPasswordError } = await supabase.auth.resetPasswordForEmail(
        email,
        redirectTo ? { redirectTo } : undefined,
      )

      if (resetPasswordError) {
        setResetError(resetPasswordError.message)
        return
      }

      form.reset()
      setResetSuccess('Check your email for a link to reset your password.')
    } catch (cause) {
      console.error('Failed to send password reset email', cause)
      setResetError('Something went wrong while requesting a password reset. Please try again.')
    } finally {
      setResetLoading(false)
    }
  }

  if (mode === 'reset') {
    return (
      <form className="space-y-5" onSubmit={handleResetSubmit}>
        <div className="space-y-1">
          <h2 className="text-xl font-semibold text-white">Reset your password</h2>
          <p className="text-sm text-white/70">
            Enter the email address associated with your TwinMinds Studio account and we will send you a password reset link.
          </p>
        </div>
        <div>
          <label htmlFor="reset-email" className="block text-sm text-white/80">
            Email address
          </label>
          <input
            id="reset-email"
            name="reset-email"
            type="email"
            autoComplete="email"
            required
            className="mt-2 w-full rounded-xl bg-base-700/60 px-4 py-3 text-base text-white ring-1 ring-white/10 outline-none transition focus:ring-2 focus:ring-limeglow-500/40"
            placeholder="you@company.com"
            disabled={resetLoading}
          />
        </div>
        {resetError ? (
          <p className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">{resetError}</p>
        ) : null}
        {resetSuccess ? (
          <p className="rounded-xl border border-limeglow-500/40 bg-limeglow-500/10 px-4 py-3 text-sm text-limeglow-100">{resetSuccess}</p>
        ) : null}
        <button type="submit" className="btn btn-primary w-full" disabled={resetLoading}>
          {resetLoading ? 'Sending reset link…' : 'Send reset link'}
        </button>
        <button
          type="button"
          className="w-full text-sm font-medium text-limeglow-400 transition hover:text-limeglow-300"
          onClick={() => {
            setMode('sign-in')
            setResetError(null)
            setResetSuccess(null)
          }}
        >
          Back to sign in
        </button>
      </form>
    )
  }

  if (mode === 'sign-up') {
    const handleSignUpSubmit = async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault()

      const form = event.currentTarget
      const formData = new FormData(form)
      const email = String(formData.get('email') ?? '').trim()
      const password = String(formData.get('password') ?? '')
      const confirmPassword = String(formData.get('confirm-password') ?? '')

      if (!email || !password || !confirmPassword) {
        setSignUpError('Please complete all fields to continue.')
        setSignUpSuccess(null)
        return
      }

      if (password.length < MIN_PASSWORD_LENGTH) {
        setSignUpError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters long.`)
        setSignUpSuccess(null)
        return
      }

      if (password !== confirmPassword) {
        setSignUpError('Passwords do not match. Please try again.')
        setSignUpSuccess(null)
        return
      }

      try {
        setSignUpLoading(true)
        setSignUpError(null)
        setSignUpSuccess(null)

        const emailRedirectTo =
          typeof window !== 'undefined'
            ? new URL('/app/setup-account/self-service?source=self-service', window.location.origin).toString()
            : undefined

        const { error: signUpResultError } = await supabase.auth.signUp({
          email,
          password,
          options: emailRedirectTo ? { emailRedirectTo } : undefined
        })

        if (signUpResultError) {
          throw new Error(signUpResultError.message)
        }

        setSignUpSuccess('Check your inbox to confirm your email. After confirming, you can finish setting up your account.')
        form.reset()
      } catch (cause) {
        console.error('Failed to sign up', cause)
        setSignUpError(
          cause instanceof Error
            ? cause.message || 'Something went wrong while creating your account. Please try again.'
            : 'Something went wrong while creating your account. Please try again.'
        )
      } finally {
        setSignUpLoading(false)
      }
    }

    return (
      <form className="space-y-5" onSubmit={handleSignUpSubmit}>
        <div className="space-y-1">
          <h2 className="text-xl font-semibold text-white">Create your TwinMinds account</h2>
          <p className="text-sm text-white/70">
            Enter your email and choose a secure password. We&apos;ll send a confirmation email so you can finish setting up
            your workspace.
          </p>
        </div>

        <div>
          <label htmlFor="sign-up-email" className="block text-sm text-white/80">
            Email address
          </label>
          <input
            id="sign-up-email"
            name="email"
            type="email"
            autoComplete="email"
            required
            className="mt-2 w-full rounded-xl bg-base-700/60 px-4 py-3 text-base text-white ring-1 ring-white/10 outline-none transition focus:ring-2 focus:ring-limeglow-500/40"
            placeholder="you@company.com"
            disabled={signUpLoading}
          />
        </div>

        <div>
          <label htmlFor="sign-up-password" className="block text-sm text-white/80">
            Password
          </label>
          <input
            id="sign-up-password"
            name="password"
            type="password"
            autoComplete="new-password"
            minLength={MIN_PASSWORD_LENGTH}
            required
            className="mt-2 w-full rounded-xl bg-base-700/60 px-4 py-3 text-base text-white ring-1 ring-white/10 outline-none transition focus:ring-2 focus:ring-limeglow-500/40"
            placeholder="Create a password"
            disabled={signUpLoading}
          />
          <p className="mt-1 text-xs text-white/50">Minimum {MIN_PASSWORD_LENGTH} characters.</p>
        </div>

        <div>
          <label htmlFor="sign-up-confirm-password" className="block text-sm text-white/80">
            Confirm password
          </label>
          <input
            id="sign-up-confirm-password"
            name="confirm-password"
            type="password"
            autoComplete="new-password"
            required
            className="mt-2 w-full rounded-xl bg-base-700/60 px-4 py-3 text-base text-white ring-1 ring-white/10 outline-none transition focus:ring-2 focus:ring-limeglow-500/40"
            placeholder="Re-enter your password"
            disabled={signUpLoading}
          />
        </div>

        {signUpError ? (
          <p className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">{signUpError}</p>
        ) : null}

        {signUpSuccess ? (
          <p className="rounded-xl border border-limeglow-500/40 bg-limeglow-500/10 px-4 py-3 text-sm text-limeglow-100">
            {signUpSuccess}
          </p>
        ) : null}

        <button type="submit" className="btn btn-primary w-full" disabled={signUpLoading}>
          {signUpLoading ? 'Creating your account…' : 'Create account'}
        </button>

        <button
          type="button"
          className="w-full text-sm font-medium text-limeglow-400 transition hover:text-limeglow-300"
          onClick={() => {
            setMode('sign-in')
            setSignUpError(null)
            setSignUpSuccess(null)
          }}
        >
          Already have an account? Sign in
        </button>
      </form>
    )
  }

  return (
    <form className="space-y-5" onSubmit={handleSubmit}>
      <div>
        <label htmlFor="email" className="block text-sm text-white/80">
          Email address
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          className="mt-2 w-full rounded-xl bg-base-700/60 px-4 py-3 text-base text-white ring-1 ring-white/10 outline-none transition focus:ring-2 focus:ring-limeglow-500/40"
          placeholder="you@company.com"
          disabled={loading}
        />
      </div>
      <div>
        <div className="flex items-center justify-between">
          <label htmlFor="password" className="block text-sm text-white/80">
            Password
          </label>
          <button
            type="button"
            className="text-xs font-medium text-limeglow-400 transition hover:text-limeglow-300"
            onClick={() => {
              setMode('reset')
              setResetError(null)
              setResetSuccess(null)
            }}
          >
            Forgot password?
          </button>
        </div>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="mt-2 w-full rounded-xl bg-base-700/60 px-4 py-3 text-base text-white ring-1 ring-white/10 outline-none transition focus:ring-2 focus:ring-limeglow-500/40"
          placeholder="Enter your password"
          disabled={loading}
        />
      </div>
      <div className="flex items-center justify-between text-sm text-white/70">
        <label className="inline-flex items-center gap-2">
          <input
            type="checkbox"
            name="remember"
            className="h-4 w-4 rounded border border-white/10 bg-base-900/80 brand-accent"
            disabled={loading}
          />
          Remember me
        </label>
        <span className="text-xs text-white/50">Secure workspace access</span>
      </div>
      {error ? (
        <p className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">{error}</p>
      ) : null}
      <button type="submit" className="btn btn-primary w-full" disabled={loading}>
        {loading ? 'Signing in…' : 'Sign in'}
      </button>
      <p className="text-center text-sm text-white/60">
        Don’t have an account yet?{' '}
        <button
          type="button"
          className="text-limeglow-400 transition hover:text-limeglow-300"
          onClick={() => {
            setMode('sign-up')
            setError(null)
            setSignUpError(null)
            setSignUpSuccess(null)
          }}
        >
          Sign up for free here.
        </button>
      </p>
    </form>
  )
}
