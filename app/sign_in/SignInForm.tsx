'use client'

import { useMemo, useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'

import { createBrowserClient } from '@/lib/supabase/browser'

export default function SignInForm() {
  const router = useRouter()
  const supabase = useMemo(createBrowserClient, [])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [isResetMode, setIsResetMode] = useState(false)
  const [resetError, setResetError] = useState<string | null>(null)
  const [resetSuccess, setResetSuccess] = useState<string | null>(null)
  const [resetLoading, setResetLoading] = useState(false)

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
    const formData = new FormData(event.currentTarget)
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

      const { error: resetPasswordError } = await supabase.auth.resetPasswordForEmail(email)

      if (resetPasswordError) {
        setResetError(resetPasswordError.message)
        return
      }

      event.currentTarget.reset()
      setResetSuccess('Check your email for a link to reset your password.')
    } catch (cause) {
      console.error('Failed to send password reset email', cause)
      setResetError('Something went wrong while requesting a password reset. Please try again.')
    } finally {
      setResetLoading(false)
    }
  }

  if (isResetMode) {
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
            setIsResetMode(false)
            setResetError(null)
            setResetSuccess(null)
          }}
        >
          Back to sign in
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
              setIsResetMode(true)
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
            className="h-4 w-4 rounded border border-limeglow-500/40 bg-base-900/80 accent-limeglow-500 focus:ring-limeglow-500/40"
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
        <a href="#contact" className="text-limeglow-400 hover:text-limeglow-300">
          Talk to our team
        </a>
      </p>
    </form>
  )
}
