import { NextResponse } from 'next/server'

import type { Database } from '@/types/supabase'

import { getAccessContext, HttpError } from '../_lib/access'

const PROFILES = 'profiles' as const

export const runtime = 'nodejs'

type ProfileRow = Database['public']['Tables']['profiles']['Row']

type UpdateProfilePayload = {
  name: string
  email: string
  role: Database['public']['Enums']['role_enum']
}

const isValidEmail = (value: string) => {
  if (!value) return false
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

const allowedRoles = new Set<Database['public']['Enums']['role_enum']>(['owner', 'client'])

export async function GET() {
  try {
    const { supabase, user, role, clientMemberships } = await getAccessContext({
      allowEmptyClientMemberships: true,
    })

    const { data, error } = await supabase
      .from(PROFILES)
      .select('id, full_name, role, email')
      .eq('id', user.id)
      .maybeSingle<Pick<ProfileRow, 'id' | 'full_name' | 'role' | 'email'>>()

    if (error) {
      console.error('profile lookup error:', error)
      return NextResponse.json({ message: 'Unable to load profile.' }, { status: 500 })
    }

    return NextResponse.json({
      profile: {
        id: user.id,
        full_name: data?.full_name ?? null,
        role: data?.role ?? null,
        email: data?.email ?? null,
      },
      metadata: user.user_metadata ?? null,
      userEmail: typeof user.email === 'string' ? user.email : null,
      clientIds: role === 'client' ? clientMemberships : [],
    })
  } catch (error) {
    if (error instanceof HttpError) {
      return NextResponse.json({ message: error.message }, { status: error.status })
    }

    console.error('profile route unexpected error:', error)
    return NextResponse.json({ message: 'Unable to load profile.' }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    const { supabase, userId } = await getAccessContext({
      allowEmptyClientMemberships: true,
    })

    let body: unknown = null

    try {
      body = await request.json()
    } catch (parseError) {
      console.error('profile update parse error:', parseError)
      return NextResponse.json({ message: 'Invalid JSON payload.' }, { status: 400 })
    }

    const payload = body as Partial<UpdateProfilePayload> | null

    const name = typeof payload?.name === 'string' ? payload.name.trim() : ''
    const email = typeof payload?.email === 'string' ? payload.email.trim() : ''
    const role = payload?.role ?? null

    if (name.length < 2) {
      return NextResponse.json({ message: 'Name must be at least 2 characters.' }, { status: 400 })
    }

    if (!isValidEmail(email)) {
      return NextResponse.json({ message: 'Enter a valid email address.' }, { status: 400 })
    }

    if (!role || !allowedRoles.has(role)) {
      return NextResponse.json({ message: 'Select a valid workspace role.' }, { status: 400 })
    }

    const updatePayload: Database['public']['Tables']['profiles']['Insert'] = {
      id: userId,
      full_name: name,
      role,
      email,
      updated_at: new Date().toISOString(),
    }

    const { error } = await supabase.from(PROFILES).upsert(updatePayload).eq('id', userId)

    if (error) {
      console.error('profile update error:', error)
      return NextResponse.json({ message: 'Unable to save profile.' }, { status: 500 })
    }

    return NextResponse.json({
      profile: {
        id: userId,
        full_name: name,
        role,
        email,
      },
    })
  } catch (error) {
    if (error instanceof HttpError) {
      return NextResponse.json({ message: error.message }, { status: error.status })
    }

    console.error('profile update unexpected error:', error)
    return NextResponse.json({ message: 'Unable to save profile.' }, { status: 500 })
  }
}
