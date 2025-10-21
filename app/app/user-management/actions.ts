'use server'

import { z } from 'zod'

import { apiFetch } from '@/lib/api/fetch'

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

export async function createWorkspaceUser(input: unknown): Promise<ActionResult> {
  const parsed = createUserSchema.safeParse(input)

  if (!parsed.success) {
    return { ok: false, message: 'Invalid user details provided.' }
  }

  try {
    const response = await apiFetch('/api/user-management/users', {
      method: 'POST',
      body: JSON.stringify(parsed.data)
    })

    if (!response.ok) {
      let message = 'Unable to create user. Try again later.'

      try {
        const body = (await response.json()) as { message?: string }
        if (body.message) {
          message = body.message
        }
      } catch (error) {
        console.error('createWorkspaceUser parse error:', error)
      }

      return { ok: false, message }
    }

    return { ok: true }
  } catch (error) {
    console.error('createWorkspaceUser request error:', error)
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

  try {
    const response = await apiFetch(`/api/user-management/users/${parsed.data.profileId}`, {
      method: 'PATCH',
      body: JSON.stringify({ role: parsed.data.role })
    })

    if (!response.ok) {
      let message = 'Unable to update workspace role.'

      try {
        const body = (await response.json()) as { message?: string }
        if (body.message) {
          message = body.message
        }
      } catch (error) {
        console.error('updateWorkspaceUserRole parse error:', error)
      }

      return { ok: false, message }
    }

    return { ok: true }
  } catch (error) {
    console.error('updateWorkspaceUserRole request error:', error)
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

  try {
    const response = await apiFetch('/api/user-management/password-reset', {
      method: 'POST',
      body: JSON.stringify({ email: parsed.data.email })
    })

    if (!response.ok) {
      let message = 'Unable to send password reset email.'

      try {
        const body = (await response.json()) as { message?: string }
        if (body.message) {
          message = body.message
        }
      } catch (error) {
        console.error('sendWorkspacePasswordReset parse error:', error)
      }

      return { ok: false, message }
    }

    return { ok: true }
  } catch (error) {
    console.error('sendWorkspacePasswordReset request error:', error)
    return { ok: false, message: 'Unable to send password reset email.' }
  }
}
