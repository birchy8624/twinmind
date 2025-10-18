export const runtime = 'nodejs'

import { cookies } from 'next/headers'
import { NextResponse, type NextRequest } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'

import type { Database } from '@/types/supabase'

export async function POST(request: NextRequest) {
  const supabase = createRouteHandlerClient<Database>({ cookies })
  const { event, session } = await request.json()

  if (event === 'SIGNED_OUT') {
    await supabase.auth.signOut()
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
