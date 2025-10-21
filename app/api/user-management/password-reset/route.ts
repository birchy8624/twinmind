import { NextResponse } from 'next/server'
import { z } from 'zod'

import { createServerSupabase } from '@/lib/supabase/server'

const passwordResetSchema = z.object({
  email: z.string().email()
})

export async function POST(request: Request) {
  let payload: unknown

  try {
    payload = await request.json()
  } catch (error) {
    console.error('Failed to parse password reset payload:', error)
    return NextResponse.json({ message: 'Invalid email address provided.' }, { status: 400 })
  }

  const parsed = passwordResetSchema.safeParse(payload)

  if (!parsed.success) {
    return NextResponse.json({ message: 'Invalid email address provided.' }, { status: 400 })
  }

  const supabase = createServerSupabase()
  const {
    data: { user: currentUser }
  } = await supabase.auth.getUser()

  if (!currentUser) {
    return NextResponse.json({ message: 'Not authenticated.' }, { status: 401 })
  }

  const { email } = parsed.data

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE

  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json(
      { message: 'Supabase credentials are not configured.' },
      { status: 500 }
    )
  }

  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.NEXT_PUBLIC_VERCEL_URL ? `https://${process.env.NEXT_PUBLIC_VERCEL_URL}` : 'http://localhost:3000')

  const redirectTo = new URL('/reset-password', siteUrl).toString()

  try {
    const response = await fetch(`${supabaseUrl}/auth/v1/recover`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`
      },
      body: JSON.stringify({ email, redirect_to: redirectTo })
    })

    if (!response.ok) {
      const message = await response.text()
      throw new Error(message || 'Failed to trigger password reset email.')
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('sendWorkspacePasswordReset error:', error)

    if (error instanceof Error && 'message' in error) {
      return NextResponse.json({ message: error.message }, { status: 500 })
    }

    return NextResponse.json(
      { message: 'Unable to send password reset email.' },
      { status: 500 }
    )
  }
}
