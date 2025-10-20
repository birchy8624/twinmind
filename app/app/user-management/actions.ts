'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { isAccountRoleAtLeast } from '@/lib/active-account'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { createServerSupabase } from '@/lib/supabase/server'
import type { Database } from '@/types/supabase'

type ProfilesTable = Database['public']['Tables']['profiles']

type ActionResult = {
  ok: boolean
  message?: string
}

const createUserSchema = z.object({
  accountId: z.string().uuid(),
  email: z.string().email(),
  fullName: z
    .string()
    .trim()
    .min(1, 'Full name is required')
    .max(120, 'Full name is too long')
    .optional()
    .transform((value) => (value && value.trim().length > 0 ? value.trim() : undefined)),
  sendInvite: z.boolean().default(true)
})

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.NEXT_PUBLIC_VERCEL_URL ? `https://${process.env.NEXT_PUBLIC_VERCEL_URL}` : 'http://localhost:3000')

const setupAccountRedirect = (() => {
  try {
    return new URL('/app/setup-account', siteUrl).toString()
  } catch (error) {
    console.error('Failed to construct setup account redirect URL', error)
    return null
  }
})()

export async function createWorkspaceUser(input: unknown): Promise<ActionResult> {
  const parsed = createUserSchema.safeParse(input)

  if (!parsed.success) {
    return { ok: false, message: 'Invalid user details provided.' }
  }

  const { accountId, email, fullName, sendInvite } = parsed.data

  const supabase = createServerSupabase()
  const {
    data: { user: currentUser },
    error: currentUserError
  } = await supabase.auth.getUser()

  if (currentUserError || !currentUser) {
    return { ok: false, message: 'Not authenticated.' }
  }

  const { data: actorMembership, error: membershipError } = await supabase
    .from('account_members')
    .select('role')
    .eq('account_id', accountId)
    .eq('profile_id', currentUser.id)
    .maybeSingle()

  if (membershipError) {
    console.error('createWorkspaceUser membership error:', membershipError)
    return { ok: false, message: 'Unable to verify workspace permissions.' }
  }

  if (!isAccountRoleAtLeast(actorMembership?.role, 'owner')) {
    return { ok: false, message: 'Only workspace owners can add members.' }
  }

  const assignedProfileRole: ProfilesTable['Row']['role'] = 'member'

  const admin = supabaseAdmin()

  try {
    let createdUserId: string | null = null

    if (sendInvite) {
      const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
        data: {
          full_name: fullName,
          role: assignedProfileRole
        },
        ...(setupAccountRedirect ? { redirectTo: setupAccountRedirect } : {})
      })

      if (error) {
        throw error
      }

      if (!data?.user) {
        throw new Error('Supabase did not return a created user.')
      }

      createdUserId = data.user.id
    } else {
      const { data, error } = await admin.auth.admin.createUser({
        email,
        email_confirm: false,
        user_metadata: {
          full_name: fullName,
          role: assignedProfileRole
        }
      })

      if (error) {
        throw error
      }

      if (!data?.user) {
        throw new Error('Supabase did not return a created user.')
      }

      createdUserId = data.user.id
    }

    if (!createdUserId) {
      throw new Error('Missing created user identifier.')
    }

    if (typeof createdUserId !== 'string' || createdUserId.length === 0) {
      throw new Error('Missing created user identifier.')
    }

    const profileId = createdUserId!

    const { data: existingMembership, error: existingMembershipError } = await admin
      .from('account_members')
      .select('id')
      .eq('account_id', accountId)
      .eq('profile_id', profileId)
      .maybeSingle()

    if (existingMembershipError) {
      throw existingMembershipError
    }

    if (existingMembership) {
      return { ok: false, message: 'User is already a member of this workspace.' }
    }

    const { error: profileError } = await admin.from('profiles').upsert<ProfilesTable['Insert']>(
      {
        id: profileId,
        role: assignedProfileRole,
        full_name: fullName ?? null,
        email,
        updated_at: new Date().toISOString()
      },
      { onConflict: 'id' }
    )

    if (profileError) {
      throw profileError
    }

    const { error: membershipInsertError } = await admin.from('account_members').insert({
      account_id: accountId,
      profile_id: profileId,
      role: assignedProfileRole
    })

    if (membershipInsertError) {
      throw membershipInsertError
    }

    revalidatePath('/app/user-management')

    return { ok: true }
  } catch (error) {
    console.error('createWorkspaceUser error:', error)

    if (error instanceof Error && 'message' in error) {
      return { ok: false, message: error.message }
    }

    return { ok: false, message: 'Unable to create user. Try again later.' }
  }
}

const updateRoleSchema = z.object({
  accountId: z.string().uuid(),
  profileId: z.string().min(1),
  role: z.enum(['owner', 'member'])
})

export async function updateWorkspaceUserRole(input: unknown): Promise<ActionResult> {
  const parsed = updateRoleSchema.safeParse(input)

  if (!parsed.success) {
    return { ok: false, message: 'Invalid role update request.' }
  }

  const { accountId, profileId, role } = parsed.data

  const supabase = createServerSupabase()
  const {
    data: { user: currentUser },
    error: currentUserError
  } = await supabase.auth.getUser()

  if (currentUserError || !currentUser) {
    return { ok: false, message: 'Not authenticated.' }
  }

  const { data: actorMembership, error: membershipError } = await supabase
    .from('account_members')
    .select('role')
    .eq('account_id', accountId)
    .eq('profile_id', currentUser.id)
    .maybeSingle()

  if (membershipError) {
    console.error('updateWorkspaceUserRole membership error:', membershipError)
    return { ok: false, message: 'Unable to verify workspace permissions.' }
  }

  if (!isAccountRoleAtLeast(actorMembership?.role, 'owner')) {
    return { ok: false, message: 'Only workspace owners can manage roles.' }
  }

  const admin = supabaseAdmin()

  try {
    const { error: membershipUpdateError } = await admin
      .from('account_members')
      .update({ role })
      .eq('account_id', accountId)
      .eq('profile_id', profileId)

    if (membershipUpdateError) {
      throw membershipUpdateError
    }

    let resolvedProfileRole: ProfilesTable['Row']['role'] | null = null

    if (role === 'owner') {
      resolvedProfileRole = 'owner'
    } else {
      const { data: ownerMemberships, error: ownerMembershipError } = await admin
        .from('account_members')
        .select('role')
        .eq('profile_id', profileId)
        .eq('role', 'owner')
        .limit(1)

      if (ownerMembershipError) {
        throw ownerMembershipError
      }

      resolvedProfileRole = ownerMemberships && ownerMemberships.length > 0 ? 'owner' : 'member'
    }

    if (resolvedProfileRole) {
      const { error: profileUpdateError } = await admin
        .from('profiles')
        .update<ProfilesTable['Update']>({
          role: resolvedProfileRole,
          updated_at: new Date().toISOString()
        })
        .eq('id', profileId)

      if (profileUpdateError) {
        throw profileUpdateError
      }
    }

    revalidatePath('/app/user-management')

    return { ok: true }
  } catch (error) {
    console.error('updateWorkspaceUserRole error:', error)

    if (error instanceof Error && 'message' in error) {
      return { ok: false, message: error.message }
    }

    return { ok: false, message: 'Unable to update workspace role.' }
  }
}

const passwordResetSchema = z.object({
  email: z.string().email()
})

export async function sendWorkspacePasswordReset(input: unknown): Promise<ActionResult> {
  const parsed = passwordResetSchema.safeParse(input)

  if (!parsed.success) {
    return { ok: false, message: 'Invalid email address provided.' }
  }

  const { email } = parsed.data

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE

  if (!supabaseUrl || !serviceRoleKey) {
    return { ok: false, message: 'Supabase credentials are not configured.' }
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

    return { ok: true }
  } catch (error) {
    console.error('sendWorkspacePasswordReset error:', error)

    if (error instanceof Error && 'message' in error) {
      return { ok: false, message: error.message }
    }

    return { ok: false, message: 'Unable to send password reset email.' }
  }
}
