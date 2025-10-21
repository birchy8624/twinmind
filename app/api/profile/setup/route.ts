import { NextResponse } from 'next/server'

import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'

import type { Database } from '@/types/supabase'
import { createServerSupabase } from '@/lib/supabase/server'

export const runtime = 'nodejs'

type RoleEnum = Database['public']['Enums']['role_enum']

type ProfileRow = Database['public']['Tables']['profiles']['Row']
type AccountRow = Pick<Database['public']['Tables']['accounts']['Row'], 'id' | 'name'>
type AccountMemberRow = Database['public']['Tables']['account_members']['Row']

type SetupProfileResponse = {
  profile: Pick<ProfileRow, 'id' | 'full_name' | 'email' | 'company' | 'role'>
  account: AccountRow | null
}

const updateSetupSchema = z.object({
  fullName: z.string().trim().min(1, 'Full name is required').max(120, 'Full name is too long'),
  email: z
    .string()
    .trim()
    .min(1, 'Email is required')
    .max(320, 'Email is too long')
    .email('A valid email is required')
    .nullable(),
  companyName: z
    .string()
    .trim()
    .min(1, 'Company name is required')
    .max(160, 'Company name is too long')
    .nullable()
})

function resolveMetadataRole(metadata: Record<string, unknown> | undefined): RoleEnum {
  if (!metadata) {
    return 'owner'
  }

  const value = metadata['role']

  if (typeof value === 'string' && value.trim().toLowerCase() === 'client') {
    return 'client'
  }

  return 'owner'
}

function resolveMetadataString(metadata: Record<string, unknown> | undefined, key: string): string | null {
  if (!metadata) {
    return null
  }

  const value = metadata[key]

  if (typeof value !== 'string') {
    return null
  }

  const trimmed = value.trim()

  return trimmed.length > 0 ? trimmed : null
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

  const [
    { data: profileRow, error: profileError },
    { data: membershipRow, error: membershipError }
  ] = await Promise.all([
    typedSupabase
      .from('profiles')
      .select('id, full_name, email, company, role')
      .eq('id', user.id)
      .maybeSingle<Pick<ProfileRow, 'id' | 'full_name' | 'email' | 'company' | 'role'>>(),
    typedSupabase
      .from('account_members')
      .select('account_id, role, accounts ( id, name )')
      .eq('profile_id', user.id)
      .maybeSingle<{
        account_id: AccountMemberRow['account_id']
        role: AccountMemberRow['role']
        accounts: AccountRow | null
      }>()
  ])

  if (profileError) {
    console.error('setup profile fetch error:', profileError)
    return NextResponse.json({ message: 'Unable to load profile.' }, { status: 500 })
  }

  if (membershipError) {
    console.error('setup profile membership fetch error:', membershipError)
    return NextResponse.json({ message: 'Unable to load account membership.' }, { status: 500 })
  }

  let profile = profileRow

  if (!profile) {
    const metadataFullName = resolveMetadataString(user.user_metadata, 'full_name')
    const metadataCompany = resolveMetadataString(user.user_metadata, 'company')
    const inferredRole = resolveMetadataRole(user.user_metadata)

    const insertPayload: Database['public']['Tables']['profiles']['Insert'] = {
      id: user.id,
      full_name: metadataFullName,
      email: user.email ?? null,
      company: metadataCompany,
      role: inferredRole,
      updated_at: new Date().toISOString()
    }

    const { data, error } = await typedSupabase
      .from('profiles')
      .upsert(insertPayload, { onConflict: 'id' })
      .select('id, full_name, email, company, role')
      .single<Pick<ProfileRow, 'id' | 'full_name' | 'email' | 'company' | 'role'>>()

    if (error || !data) {
      console.error('setup profile create error:', error)
      return NextResponse.json({ message: 'Unable to prepare profile.' }, { status: 500 })
    }

    profile = data
  }

  const account = membershipRow?.accounts ?? null

  return NextResponse.json<SetupProfileResponse>({
    profile: {
      id: profile.id,
      full_name: profile.full_name,
      email: profile.email,
      company: profile.company,
      role: profile.role
    },
    account
  })
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

  let payload: z.infer<typeof updateSetupSchema>

  try {
    payload = updateSetupSchema.parse(await request.json())
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: error.issues[0]?.message ?? 'Invalid details provided.' }, { status: 400 })
    }

    console.error('setup profile update parse error:', error)
    return NextResponse.json({ message: 'Invalid details provided.' }, { status: 400 })
  }

  const trimmedName = payload.fullName.trim()
  const trimmedEmail = payload.email ? payload.email.trim() : null
  const trimmedCompany = payload.companyName ? payload.companyName.trim() : null

  const typedSupabase = supabase as unknown as SupabaseClient<Database>

  const { data: existingProfile, error: existingProfileError } = await typedSupabase
    .from('profiles')
    .select('id, role')
    .eq('id', user.id)
    .maybeSingle<Pick<ProfileRow, 'id' | 'role'>>()

  if (existingProfileError) {
    console.error('setup profile existing fetch error:', existingProfileError)
    return NextResponse.json({ message: 'Unable to load profile.' }, { status: 500 })
  }

  const profilePayload: Database['public']['Tables']['profiles']['Insert'] = {
    id: user.id,
    full_name: trimmedName,
    email: trimmedEmail ?? user.email ?? null,
    company: trimmedCompany,
    role: existingProfile?.role ?? 'owner',
    updated_at: new Date().toISOString()
  }

  const { error: upsertError } = await typedSupabase
    .from('profiles')
    .upsert(profilePayload, { onConflict: 'id' })

  if (upsertError) {
    console.error('setup profile upsert error:', upsertError)
    return NextResponse.json({ message: 'Unable to save profile.' }, { status: 500 })
  }

  const { data: membership, error: membershipError } = await typedSupabase
    .from('account_members')
    .select('account_id, role')
    .eq('profile_id', user.id)
    .maybeSingle<Pick<AccountMemberRow, 'account_id' | 'role'>>()

  if (membershipError) {
    console.error('setup profile membership fetch error:', membershipError)
    return NextResponse.json({ message: 'Unable to load account membership.' }, { status: 500 })
  }

  let accountId = membership?.account_id ?? null
  let didCreateAccount = false

  if (accountId) {
    if (trimmedCompany) {
      const { error: updateAccountError } = await typedSupabase
        .from('accounts')
        .update({ name: trimmedCompany })
        .eq('id', accountId)

      if (updateAccountError) {
        console.error('setup profile account update error:', updateAccountError)
        return NextResponse.json({ message: 'Unable to update account.' }, { status: 500 })
      }
    }
  } else {
    if (!trimmedCompany) {
      return NextResponse.json({ message: 'Company name is required to create your workspace.' }, { status: 400 })
    }

    const { data: createdAccountRow, error: createAccountError } = await typedSupabase
      .from('accounts')
      .insert({ name: trimmedCompany })
      .select('id')
      .single<AccountRow>()

    if (createAccountError || !createdAccountRow) {
      console.error('setup profile account create error:', createAccountError)
      return NextResponse.json({ message: 'Unable to create account.' }, { status: 500 })
    }

    accountId = createdAccountRow.id
    didCreateAccount = true

    const { error: memberInsertError } = await typedSupabase.from('account_members').insert({
      account_id: accountId,
      profile_id: user.id,
      role: 'owner'
    })

    if (memberInsertError) {
      console.error('setup profile account membership insert error:', memberInsertError)
      return NextResponse.json({ message: 'Unable to link account membership.' }, { status: 500 })
    }
  }

  return NextResponse.json({
    success: true,
    accountId,
    createdAccount: didCreateAccount,
    role: membership?.role ?? existingProfile?.role ?? 'owner'
  })
}
