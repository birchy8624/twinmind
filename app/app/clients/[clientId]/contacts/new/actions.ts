'use server'

import { z } from 'zod'

import { apiFetch } from '@/lib/api/fetch'

const contactSchema = z.object({
  clientId: z.string().min(1),
  firstName: z.string().trim().min(2),
  lastName: z.string().trim().min(2),
  email: z.string().trim().email(),
  phone: z.string().trim().optional().or(z.literal('')),
  title: z.string().trim().optional().or(z.literal('')),
  isPrimary: z.boolean().default(false)
})

export type CreateContactInput = z.infer<typeof contactSchema>

export type CreateContactResult =
  | { ok: true; contactId: string }
  | { ok: false; message: string }

export async function createContact(input: unknown): Promise<CreateContactResult> {
  const parsed = contactSchema.safeParse(input)

  if (!parsed.success) {
    return { ok: false, message: 'Invalid input.' }
  }

  const payload = parsed.data

  try {
    const response = await apiFetch(`/api/clients/${payload.clientId}/contacts`, {
      method: 'POST',
      body: JSON.stringify({
        firstName: payload.firstName,
        lastName: payload.lastName,
        email: payload.email,
        phone: payload.phone,
        title: payload.title,
        isPrimary: payload.isPrimary
      })
    })

    if (!response.ok) {
      let message = 'Unable to create contact.'

      try {
        const body = (await response.json()) as { message?: string }
        if (body.message) {
          message = body.message
        }
      } catch (error) {
        console.error('createContact parse error:', error)
      }

      return { ok: false, message }
    }

    const body = (await response.json()) as { contactId?: string }

    if (!body.contactId) {
      return { ok: false, message: 'Unable to create contact.' }
    }

    return { ok: true, contactId: body.contactId }
  } catch (error) {
    console.error('createContact request error:', error)
    return { ok: false, message: 'Unable to create contact.' }
  }
}
