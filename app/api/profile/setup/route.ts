import { NextResponse } from 'next/server'

import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'

import type { Database } from '@/types/supabase'
import { createServerSupabase } from '@/lib/supabase/server'

export const runtime = 'nodejs'

const PROFILES = 'profiles' as const
const ACCOUNT_MEMBERS = 'account_members' as const
const ACCOUNTS = 'accounts' as const

const MAX_FULL_NAME_LENGTH = 120
const MAX_COMPANY_LENGTH = 160

const EMAIL_VALIDATOR = z.string().email().max(255)

const updateSchema = z.object({
  fullName: z.string(),
  email: z.string().nullish(),
  companyName: z.string().nullish(),
})

type RoleEnum = Database['public']['Enums']['role_enum']

type ProfileRow = Pick<
  Database['public']['Tables']['profiles']['Row'],
  'id' | 'full_name' | 'email' | 'company' | 'role'
>

type AccountRow = Pick<Database['public']['Tables']['accounts']['Row'], 'id' | 'name'>

type AccountMembershipRow = {
  account_id: string
  role: Database['public']['Tables']['account_members']['Row']['role']
  accounts: AccountRow | null
}

type SetupProfileResponse = {
  profile: Pick<ProfileRow, 'id' | 'full_name' | 'email' | 'company'>
  account: AccountRow | null
}

const resolveMetadataName = (metadata: Record<string, unknown> | undefined): string => {
  if (!metadata) {
    return ''
  }

  const values: string[] = []

  const addValue = (value: unknown) => {
    if (typeof value === 'string') {
      const trimmed = value.trim()
      if (trimmed.length > 0) {
        values.push(trimmed)
      }
    }
  }

  addValue(metadata['full_name'])
  addValue(metadata['name'])

  const first = typeof metadata['first_name'] === 'string' ? metadata['first_name'].trim() : ''
  const last = typeof metadata['last_name'] === 'string' ? metadata['last_name'].trim() : ''

  if (first && last) {
    values.push(`${first} ${last}`.trim())
  } else {
    addValue(metadata['first_name'])
    addValue(metadata['last_name'])
  }

  return values[0] ?? ''
}

const resolveMetadataCompany = (metadata: Record<string, unknown> | undefined): string => {
  if (!metadata) {
    return ''
  }

  const value = metadata['company']
  return typeof value === 'string' ? value.trim() : ''
}

const resolveMetadataRole = (metadata: Record<string, unknown> | undefined): RoleEnum => {
  if (!metadata) {
    return 'owner'
  }

  const rawRole = metadata['role']

  if (typeof rawRole === 'string' && rawRole.trim().toLowerCase() === 'client') {
    return 'client'
  }

  return 'owner'
}

export async function GET() {
  const supabase = createServerSupabase()

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return NextResponse.json({ message: 'Not authenticated.' }, { status: 401 })
  }

  const typedSupabase = supabase as unknown as SupabaseClient<Database>

  const [
    { data: profileData, error: profileError },
    { data: membershipData, error: membershipError },
  ] = await Promise.all([
    typedSupabase
      .from(PROFILES)
      .select('id, full_name, email, company, role')
      .eq('id', user.id)
      .maybeSingle<ProfileRow>(),
    typedSupabase
      .from(ACCOUNT_MEMBERS)
      .select('account_id, role, accounts ( id, name )')
      .eq('profile_id', user.id)
      .maybeSingle<AccountMembershipRow>(),
  ])

  if (profileError) {
    console.error('setup profile fetch error:', profileError)
    return NextResponse.json({ message: 'Unable to load profile.' }, { status: 500 })
  }

  if (membershipError) {
    console.error('setup profile membership fetch error:', membershipError)
    return NextResponse.json({ message: 'Unable to load account membership.' }, { status: 500 })
  }

  let profile = profileData

  if (!profile) {
    const metadataName = resolveMetadataName(user.user_metadata)
    const metadataCompany = resolveMetadataCompany(user.user_metadata)
    const inferredRole = resolveMetadataRole(user.user_metadata)

    const insertPayload: Database['public']['Tables']['profiles']['Insert'] = {
      id: user.id,
      full_name: metadataName.length > 0 ? metadataName : null,
      email: user.email ?? null,
      company: metadataCompany.length > 0 ? metadataCompany : null,
      role: inferredRole,
      updated_at: new Date().toISOString(),
    }

    const { data: createdProfile, error: createProfileError } = await typedSupabase
      .from(PROFILES)
      .upsert(insertPayload, { onConflict: 'id' })
      .select('id, full_name, email, company, role')
      .single<ProfileRow>()

    if (createProfileError || !createdProfile) {
      console.error('setup profile create error:', createProfileError)
      return NextResponse.json({ message: 'Unable to prepare profile.' }, { status: 500 })
    }

    profile = createdProfile
  }

  let account: AccountRow | null = membershipData?.accounts ?? null

  if (!account && membershipData?.account_id) {
    const { data: fallbackAccount, error: fallbackError } = await typedSupabase
      .from(ACCOUNTS)
      .select('id, name')
      .eq('id', membershipData.account_id)
      .maybeSingle<AccountRow>()

    if (fallbackError) {
      console.error('setup profile fallback account fetch error:', fallbackError)
    } else if (fallbackAccount) {
      account = fallbackAccount
    }
  }

  const responseBody: SetupProfileResponse = {
    profile: {
      id: profile.id,
      full_name: profile.full_name,
      email: profile.email,
      company: profile.company,
    },
    account,
  }

  return NextResponse.json(responseBody)
}

export async function PATCH(request: Request) {
  const supabase = createServerSupabase()

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return NextResponse.json({ message: 'Not authenticated.' }, { status: 401 })
  }

  let parsedPayload: z.infer<typeof updateSchema>

  try {
    parsedPayload = updateSchema.parse(await request.json())
  } catch (error) {
    console.error('setup profile update parse error:', error)
    return NextResponse.json({ message: 'Invalid request body.' }, { status: 400 })
  }

  const trimmedName = parsedPayload.fullName.trim()
  const trimmedEmail = typeof parsedPayload.email === 'string' ? parsedPayload.email.trim() : null
  const trimmedCompany = typeof parsedPayload.companyName === 'string' ? parsedPayload.companyName.trim() : null

  if (!trimmedName) {
    return NextResponse.json({ message: 'Full name is required.' }, { status: 400 })
  }

  if (trimmedName.length > MAX_FULL_NAME_LENGTH) {
    return NextResponse.json({ message: 'Full name is too long.' }, { status: 400 })
  }

  if (trimmedEmail) {
    const emailValidation = EMAIL_VALIDATOR.safeParse(trimmedEmail)

    if (!emailValidation.success) {
      return NextResponse.json({ message: 'Please provide a valid email address.' }, { status: 400 })
    }
  }

  if (trimmedCompany && trimmedCompany.length > MAX_COMPANY_LENGTH) {
    return NextResponse.json({ message: 'Company name is too long.' }, { status: 400 })
  }

  const typedSupabase = supabase as unknown as SupabaseClient<Database>

  const [
    { data: profileRow, error: profileError },
    { data: membershipRow, error: membershipError },
  ] = await Promise.all([
    typedSupabase
      .from(PROFILES)
      .select('id, role')
      .eq('id', user.id)
      .maybeSingle<Pick<ProfileRow, 'id' | 'role'>>(),
    typedSupabase
      .from(ACCOUNT_MEMBERS)
      .select('account_id, accounts ( id, name )')
      .eq('profile_id', user.id)
      .maybeSingle<AccountMembershipRow>(),
  ])

  if (profileError) {
    console.error('setup profile update fetch error:', profileError)
    return NextResponse.json({ message: 'Unable to load profile.' }, { status: 500 })
  }

  if (membershipError) {
    console.error('setup profile update membership error:', membershipError)
    return NextResponse.json({ message: 'Unable to load account membership.' }, { status: 500 })
  }

  let account = membershipRow?.accounts ?? null
  let accountId = account?.id ?? membershipRow?.account_id ?? null

  if (accountId && !account) {
    const { data: fallbackAccount, error: fallbackError } = await typedSupabase
      .from(ACCOUNTS)
      .select('id, name')
      .eq('id', accountId)
      .maybeSingle<AccountRow>()

    if (fallbackError) {
      console.error('setup profile update fallback account error:', fallbackError)
      accountId = null
    } else if (fallbackAccount) {
      account = fallbackAccount
      accountId = fallbackAccount.id
    } else {
      accountId = null
    }
  }

  const profileUpdateValues: Database['public']['Tables']['profiles']['Update'] = {
    full_name: trimmedName,
    email: trimmedEmail ?? user.email ?? null,
    company: trimmedCompany ?? account?.name ?? null,
    updated_at: new Date().toISOString(),
  }

  if (profileRow) {
    const { error: updateProfileError } = await typedSupabase
      .from(PROFILES)
      .update(profileUpdateValues)
      .eq('id', user.id)

    if (updateProfileError) {
      console.error('setup profile update error:', updateProfileError)
      return NextResponse.json({ message: 'Unable to update profile.' }, { status: 500 })
    }
  } else {
    const insertPayload: Database['public']['Tables']['profiles']['Insert'] = {
      id: user.id,
      full_name: profileUpdateValues.full_name ?? null,
      email: profileUpdateValues.email ?? null,
      company: profileUpdateValues.company ?? null,
      role: 'owner',
      updated_at: profileUpdateValues.updated_at ?? new Date().toISOString(),
    }

    const { error: insertProfileError } = await typedSupabase.from(PROFILES).insert(insertPayload)

    if (insertProfileError) {
      console.error('setup profile insert error:', insertProfileError)
      return NextResponse.json({ message: 'Unable to update profile.' }, { status: 500 })
    }
  }

  if (accountId) {
    if (trimmedCompany) {
      const { error: updateAccountError } = await typedSupabase
        .from(ACCOUNTS)
        .update({ name: trimmedCompany })
        .eq('id', accountId)

      if (updateAccountError) {
        console.error('setup profile account update error:', updateAccountError)
        return NextResponse.json({ message: 'Unable to update account.' }, { status: 500 })
      }
    }
  } else {
    if (!trimmedCompany) {
      return NextResponse.json({ message: 'Company name is required.' }, { status: 400 })
    }

    const { data: createdAccount, error: createAccountError } = await typedSupabase
      .from(ACCOUNTS)
      .insert({ name: trimmedCompany })
      .select('id, name')
      .single<AccountRow>()

    if (createAccountError || !createdAccount) {
      console.error('setup profile account create error:', createAccountError)
      return NextResponse.json({ message: 'Unable to create account.' }, { status: 500 })
    }

    accountId = createdAccount.id

    if (membershipRow?.account_id) {
      const { error: updateMembershipError } = await typedSupabase
        .from(ACCOUNT_MEMBERS)
        .update({ account_id: accountId, role: membershipRow.role ?? 'owner' })
        .eq('profile_id', user.id)

      if (updateMembershipError) {
        console.error('setup profile account membership update error:', updateMembershipError)
        return NextResponse.json({ message: 'Unable to link account membership.' }, { status: 500 })
      }
    } else {
      const { error: memberInsertError } = await typedSupabase.from(ACCOUNT_MEMBERS).insert({
        account_id: accountId,
        profile_id: user.id,
        role: 'owner',
      })

      if (memberInsertError) {
        console.error('setup profile account membership insert error:', memberInsertError)
        return NextResponse.json({ message: 'Unable to link account membership.' }, { status: 500 })
      }
    }
  }

  return NextResponse.json({ success: true })
}
