export const runtime = 'nodejs'

import { cookies } from 'next/headers'
import { NextResponse, type NextRequest } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'

import type { Database } from '@/types/supabase'

function clearSupabaseAuthCookies() {
  const cookieStore = cookies()
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL

  if (!supabaseUrl) {
    return
  }

  let projectRef: string | null = null

  try {
    const { hostname } = new URL(supabaseUrl)
    projectRef = hostname.split('.')[0] ?? null
  } catch (error) {
    console.error('Failed to parse Supabase URL while clearing auth cookies', error)
  }

  if (!projectRef) {
    return
  }

  const authCookieName = `sb-${projectRef}-auth-token`
  const codeVerifierCookie = `${authCookieName}-code-verifier`

  for (const cookie of cookieStore.getAll()) {
    if (cookie.name === authCookieName || cookie.name.startsWith(`${authCookieName}.`)) {
      cookieStore.delete(cookie.name)
    }
  }

  if (cookieStore.get(codeVerifierCookie)) {
    cookieStore.delete(codeVerifierCookie)
  }
}

export async function POST(request: NextRequest) {
  const supabase = createRouteHandlerClient<Database>({ cookies })
  const { event, session } = await request.json()

  if (event === 'SIGNED_OUT') {
    await supabase.auth.signOut({ scope: 'global' })
    clearSupabaseAuthCookies()
    return NextResponse.json({ cleared: true })
  }

  if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
    const accessToken = session?.access_token
    const refreshToken = session?.refresh_token

    if (typeof accessToken === 'string' && typeof refreshToken === 'string') {
      await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken })
      return NextResponse.json({ stored: true })
    }
  }

  return NextResponse.json({ received: true })
}
