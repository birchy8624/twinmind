'use client'

import { useEffect } from 'react'

export default function SignUpCompleteRedirectPage() {
  useEffect(() => {
    const { search, hash } = window.location
    const nextPath = `/app/setup-account${search}${hash}`

    if (window.location.pathname !== '/app/setup-account') {
      window.location.replace(nextPath)
    }
  }, [])

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <p className="text-lg font-medium text-white">Redirecting you to complete your sign-up…</p>
      <p className="mt-2 text-sm text-white/60">If nothing happens, please <a className="underline" href="/app/setup-account">continue to account setup</a>.</p>
    </div>
  )
}
