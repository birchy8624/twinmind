import { NextResponse } from 'next/server'

import type { SupabaseClient } from '@supabase/supabase-js'

import type { Database } from '@/types/supabase'
import { createServerSupabase } from '@/lib/supabase/server'

export const runtime = 'nodejs'

const PROFILES = 'profiles' as const

type SetupProfile = {
  id: string
  full_name: string | null
  email: string | null
}

type SetupProfileResponse = {
  profile: SetupProfile
}

type UpdateSetupProfilePayload = {
  fullName: string
  email: string | null
}

export async function GET() {
  const supabase = createServerSupabase()

  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return NextResponse.json({ message: 'Not authenticated.' }, { status: 401 })
  }

  const typedSupabase = supabase as unknown as SupabaseClient<Database>

  const { data, error } = await typedSupabase
    .from(PROFILES)
    .select('id, full_name, email')
    .eq('id', user.id)
    .maybeSingle<SetupProfile>()

  if (error) {
    console.error('setup profile fetch error:', error)
    return NextResponse.json({ message: 'Unable to load profile.' }, { status: 500 })
  }

  if (!data) {
    return NextResponse.json({ message: 'Profile not found.' }, { status: 404 })
  }

  return NextResponse.json<SetupProfileResponse>({ profile: data })
}

export async function PATCH(request: Request) {
  const supabase = createServerSupabase()

  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return NextResponse.json({ message: 'Not authenticated.' }, { status: 401 })
  }

  let payload: UpdateSetupProfilePayload

  try {
    payload = (await request.json()) as UpdateSetupProfilePayload
  } catch (error) {
    console.error('setup profile update parse error:', error)
    return NextResponse.json({ message: 'Invalid request body.' }, { status: 400 })
  }

  const trimmedName = payload.fullName.trim()
  const trimmedEmail = payload.email ? payload.email.trim() : null

  const updatePayload: Database['public']['Tables']['profiles']['Update'] = {
    full_name: trimmedName,
    email: trimmedEmail,
    updated_at: new Date().toISOString()
  }

  const typedSupabase = supabase as unknown as SupabaseClient<Database>

  const { error } = await typedSupabase
    .from(PROFILES)
    .update(updatePayload)
    .eq('id', user.id)

  if (error) {
    console.error('setup profile update error:', error)
    return NextResponse.json({ message: 'Unable to update profile.' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
