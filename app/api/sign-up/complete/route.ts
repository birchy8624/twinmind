import { NextResponse } from 'next/server'

import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'

import type { Database } from '@/types/supabase'
import { createServerSupabase } from '@/lib/supabase/server'

export const runtime = 'nodejs'

type ProfileRow = Pick<Database['public']['Tables']['profiles']['Row'], 'id' | 'full_name' | 'email' | 'company' | 'role'>
type AccountRow = Pick<Database['public']['Tables']['accounts']['Row'], 'id' | 'name'>
type AccountMemberRow = Database['public']['Tables']['account_members']['Row']

type ProfileResponse = {
  profile: Pick<ProfileRow, 'id' | 'full_name' | 'email' | 'company'>
  account: AccountRow | null
}

const completionSchema = z.object({
  fullName: z.string().trim().min(1, 'Full name is required').max(120, 'Full name is too long'),
  companyName: z.string().trim().min(1, 'Company name is required').max(160, 'Company name is too long')
})

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

  const [{ data: profile, error: profileError }, { data: accountMembership, error: membershipError }] = await Promise.all([
    typedSupabase
      .from('profiles')
      .select('id, full_name, email, company, role')
      .eq('id', user.id)
      .maybeSingle<ProfileRow>(),
    typedSupabase
      .from('account_members')
      .select('account_id, accounts ( id, name )')
      .eq('profile_id', user.id)
      .maybeSingle<{ account_id: AccountMemberRow['account_id']; accounts: AccountRow | null }>()
  ])

  if (profileError) {
    console.error('sign-up completion profile fetch error:', profileError)
    return NextResponse.json({ message: 'Unable to load profile.' }, { status: 500 })
  }

  if (membershipError) {
    console.error('sign-up completion membership fetch error:', membershipError)
    return NextResponse.json({ message: 'Unable to load account membership.' }, { status: 500 })
  }

  if (!profile) {
    return NextResponse.json({ message: 'Profile not found.' }, { status: 404 })
  }

  const account = accountMembership?.accounts ?? null

  return NextResponse.json<ProfileResponse>({
    profile: {
      id: profile.id,
      full_name: profile.full_name,
      email: profile.email,
      company: profile.company
    },
    account
  })
}

export async function POST(request: Request) {
  const supabase = createServerSupabase()
  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return NextResponse.json({ message: 'Not authenticated.' }, { status: 401 })
  }

  let payload: z.infer<typeof completionSchema>

  try {
    payload = completionSchema.parse(await request.json())
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: error.issues[0]?.message ?? 'Invalid details provided.' }, { status: 400 })
    }

    console.error('sign-up completion parse error:', error)
    return NextResponse.json({ message: 'Invalid details provided.' }, { status: 400 })
  }

  const trimmedFullName = payload.fullName.trim()
  const trimmedCompany = payload.companyName.trim()

  const typedSupabase = supabase as unknown as SupabaseClient<Database>

  const { data: existingProfile, error: profileFetchError } = await typedSupabase
    .from('profiles')
    .select('id, role')
    .eq('id', user.id)
    .maybeSingle<Pick<ProfileRow, 'id' | 'role'>>()

  if (profileFetchError) {
    console.error('sign-up completion existing profile error:', profileFetchError)
    return NextResponse.json({ message: 'Unable to load profile.' }, { status: 500 })
  }

  const profilePayload: Database['public']['Tables']['profiles']['Insert'] = {
    id: user.id,
    full_name: trimmedFullName,
    company: trimmedCompany,
    email: user.email ?? null,
    role: existingProfile?.role ?? 'owner',
    updated_at: new Date().toISOString()
  }

  const { error: upsertProfileError } = await typedSupabase
    .from('profiles')
    .upsert(profilePayload, { onConflict: 'id' })

  if (upsertProfileError) {
    console.error('sign-up completion profile upsert error:', upsertProfileError)
    return NextResponse.json({ message: 'Unable to save profile.' }, { status: 500 })
  }

  const { data: membership, error: membershipError } = await typedSupabase
    .from('account_members')
    .select('account_id')
    .eq('profile_id', user.id)
    .maybeSingle<Pick<AccountMemberRow, 'account_id'>>()

  if (membershipError) {
    console.error('sign-up completion membership fetch error:', membershipError)
    return NextResponse.json({ message: 'Unable to load account membership.' }, { status: 500 })
  }

  let accountId = membership?.account_id ?? null

  if (accountId) {
    const { error: updateAccountError } = await typedSupabase
      .from('accounts')
      .update({ name: trimmedCompany })
      .eq('id', accountId)

    if (updateAccountError) {
      console.error('sign-up completion account update error:', updateAccountError)
      return NextResponse.json({ message: 'Unable to update account.' }, { status: 500 })
    }
  } else {
    const { data: createdAccount, error: createAccountError } = await typedSupabase
      .from('accounts')
      .insert({ name: trimmedCompany })
      .select('id')
      .single<AccountRow>()

    if (createAccountError) {
      console.error('sign-up completion account create error:', createAccountError)
      return NextResponse.json({ message: 'Unable to create account.' }, { status: 500 })
    }

    accountId = createdAccount.id

    const { error: memberInsertError } = await typedSupabase.from('account_members').insert({
      account_id: accountId,
      profile_id: user.id,
      role: 'owner'
    })

    if (memberInsertError) {
      console.error('sign-up completion account member insert error:', memberInsertError)
      return NextResponse.json({ message: 'Unable to link account membership.' }, { status: 500 })
    }
  }

  return NextResponse.json({ success: true })
}
