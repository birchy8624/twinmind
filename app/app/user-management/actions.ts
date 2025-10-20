'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { supabaseAdmin } from '@/lib/supabaseAdmin'
import type { Database } from '@/types/supabase'

type ProfilesTable = Database['public']['Tables']['profiles']

type ActionResult = {
  ok: boolean
  message?: string
}

const createUserSchema = z.object({
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

  const { email, fullName, sendInvite } = parsed.data

  const assignedRole: ProfilesTable['Row']['role'] = 'owner'

  const admin = supabaseAdmin()

  try {
    let createdUserId: string | null = null

    if (sendInvite) {
      const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
        data: {
          full_name: fullName,
          role: assignedRole
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
          role: assignedRole
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

    const { error: profileError } = await admin.from('profiles').upsert<ProfilesTable['Insert']>(
      {
        id: profileId,
        role: assignedRole,
        full_name: fullName ?? null,
        email,
        updated_at: new Date().toISOString()
      },
      { onConflict: 'id' }
    )

    if (profileError) {
      throw profileError
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
  profileId: z.string().min(1),
  role: z.literal('owner')
})

export async function updateWorkspaceUserRole(input: unknown): Promise<ActionResult> {
  const parsed = updateRoleSchema.safeParse(input)

  if (!parsed.success) {
    return { ok: false, message: 'Invalid role update request.' }
  }

  const { profileId, role } = parsed.data

  const admin = supabaseAdmin()

  try {
    const { error } = await admin
      .from('profiles')
      .update<ProfilesTable['Update']>({
        role,
        updated_at: new Date().toISOString()
      })
      .eq('id', profileId)

    if (error) {
      throw error
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
