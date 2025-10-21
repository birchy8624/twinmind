'use client'

import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'

import { completeSignUp, fetchSignUpProfile } from '@/lib/api/signUp'
import { createBrowserClient } from '@/lib/supabase/browser'

type FormStatus = 'initializing' | 'ready' | 'submitting' | 'success' | 'error'

function hasAuthParamsInUrl() {
  if (typeof window === 'undefined') {
    return false
  }

  const hash = window.location.hash.startsWith('#') ? window.location.hash.slice(1) : ''

  if (hash) {
    const hashParams = new URLSearchParams(hash)

    if (hashParams.get('access_token') || hashParams.get('refresh_token') || hashParams.get('code')) {
      return true
    }
  }

  const search = window.location.search.startsWith('?') ? window.location.search.slice(1) : ''

  if (!search) {
    return false
  }

  const searchParams = new URLSearchParams(search)
  const authKeys = ['code', 'token', 'access_token', 'refresh_token']

  return authKeys.some((key) => searchParams.has(key))
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

export default function CompleteSignUpForm() {
  const router = useRouter()
  const supabase = useMemo(createBrowserClient, [])

  const [status, setStatus] = useState<FormStatus>('initializing')
  const [error, setError] = useState<string | null>(null)
  const [fullName, setFullName] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [email, setEmail] = useState('')

  useEffect(() => {
    let isMounted = true

    const prepareSession = async () => {
      try {
        setStatus('initializing')

        if (hasAuthParamsInUrl()) {
          const currentUrl = window.location.href
          const { error: sessionError } = await supabase.auth.exchangeCodeForSession(currentUrl)

          if (sessionError && sessionError.message !== 'Auth session missing!') {
            throw new Error(sessionError.message)
          }

          clearAuthParamsFromUrl()
        }

        const { data: userData, error: userError } = await supabase.auth.getUser()

        if (userError) {
          throw new Error(userError.message)
        }

        if (!userData.user) {
          throw new Error('We could not verify your email confirmation link.')
        }

        const profileResponse = await fetchSignUpProfile()

        if (!isMounted) {
          return
        }

        const derivedFullName = profileResponse.profile.full_name?.trim() ?? ''
        const derivedCompany = profileResponse.account?.name?.trim() ?? profileResponse.profile.company?.trim() ?? ''
        const derivedEmail = profileResponse.profile.email?.trim() || userData.user.email || ''

        setFullName(derivedFullName)
        setCompanyName(derivedCompany)
        setEmail(derivedEmail)
        setStatus('ready')
        setError(null)
      } catch (cause) {
        console.error('Failed to prepare sign-up completion session', cause)

        if (!isMounted) {
          return
        }

        setStatus('error')
        setError(
          cause instanceof Error
            ? cause.message || 'We could not verify your confirmation link. Please request a new email.'
            : 'We could not verify your confirmation link. Please request a new email.'
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

    const trimmedName = fullName.trim()
    const trimmedCompany = companyName.trim()

    if (!trimmedName) {
      setError('Please enter your name to continue.')
      return
    }

    if (!trimmedCompany) {
      setError('Please enter your company name to continue.')
      return
    }

    try {
      setStatus('submitting')
      setError(null)

      await completeSignUp({
        fullName: trimmedName,
        companyName: trimmedCompany
      })

      setStatus('success')
      router.replace('/app/clients/new')
      router.refresh()
    } catch (cause) {
      console.error('Failed to complete sign-up details', cause)
      setStatus('ready')
      setError(
        cause instanceof Error
          ? cause.message || 'Something went wrong while saving your details. Please try again.'
          : 'Something went wrong while saving your details. Please try again.'
      )
    }
  }

  if (status === 'initializing') {
    return (
      <section className="mx-auto w-full max-w-2xl space-y-6">
        <div className="rounded-2xl border border-white/10 bg-base-900/60 p-8 shadow-lg shadow-black/10">
          <header className="space-y-2">
            <span className="text-xs font-semibold uppercase tracking-[0.3em] text-limeglow-400/70">Welcome aboard</span>
            <h2 className="text-2xl font-semibold text-white">Confirming your access…</h2>
            <p className="text-sm text-white/70">We&apos;re validating your confirmation link and loading your workspace details.</p>
          </header>
          <p className="mt-6 rounded-lg border border-white/10 bg-base-900/70 px-4 py-3 text-sm text-white/70">
            Preparing your account…
          </p>
        </div>
      </section>
    )
  }

  if (status === 'error') {
    return (
      <section className="mx-auto w-full max-w-2xl space-y-6 text-center">
        <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-8 text-white">
          <h2 className="text-2xl font-semibold">We couldn&apos;t finish your sign up</h2>
          <p className="mt-3 text-sm text-rose-100/80">
            {error ?? 'This confirmation link may have expired. Please request a new email to continue.'}
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

  const isSubmitting = status === 'submitting'

  return (
    <section className="mx-auto w-full max-w-2xl space-y-6">
      <div className="rounded-2xl border border-white/10 bg-base-900/60 p-8 shadow-lg shadow-black/10">
        <header className="space-y-2">
          <span className="text-xs font-semibold uppercase tracking-[0.3em] text-limeglow-400/70">Finish setup</span>
          <h2 className="text-2xl font-semibold text-white">Add your workspace details</h2>
          <p className="text-sm text-white/70">
            Tell us who you are and the company you&apos;re representing so we can personalise your TwinMinds workspace.
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
              className="mt-2 w-full cursor-not-allowed rounded-lg border border-white/10 bg-base-900/60 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-white/30 focus:outline-none focus:ring-2 focus:ring-white/20"
            />
          </div>

          {error ? (
            <p className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">{error}</p>
          ) : null}

          <button type="submit" disabled={isSubmitting} className="btn btn-primary w-full">
            {isSubmitting ? 'Saving your details…' : 'Save and continue'}
          </button>
        </form>

        {status === 'success' ? (
          <div className="mt-6 rounded-lg border border-limeglow-400/30 bg-limeglow-400/10 px-4 py-3 text-sm text-limeglow-100">
            Details saved! Redirecting you to create your first client…
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
