'use client'

import { useMemo, useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'

import { createBrowserClient } from '@/lib/supabase/browser'

export default function SignInForm() {
  const router = useRouter()
  const supabase = useMemo(createBrowserClient, [])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

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
          <a href="https://supabase.com/auth/reset-password-for-email" className="text-xs font-medium text-limeglow-400 hover:text-limeglow-300">
            Forgot password?
          </a>
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
