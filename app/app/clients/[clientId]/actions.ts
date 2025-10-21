'use server'

import { z } from 'zod'

import { apiFetch } from '@/lib/api/fetch'

const deleteClientSchema = z.object({
  clientId: z.string().min(1, 'Client identifier is required')
})

type ActionResult = {
  ok: boolean
  message?: string
}

export async function deleteClient(input: unknown): Promise<ActionResult> {
  const parsed = deleteClientSchema.safeParse(input)

  if (!parsed.success) {
    return { ok: false, message: 'Invalid client details provided.' }
  }

  const { clientId } = parsed.data

  try {
    const response = await apiFetch(`/api/clients/${clientId}`, {
      method: 'DELETE'
    })

    if (!response.ok) {
      let message = 'Unable to delete this client.'

      try {
        const body = (await response.json()) as { message?: string }
        if (body.message) {
          message = body.message
        }
      } catch (error) {
        console.error('deleteClient parse error:', error)
      }

      return { ok: false, message }
    }

    return { ok: true }
  } catch (error) {
    console.error('deleteClient request error:', error)
    return { ok: false, message: 'Unable to delete this client.' }
  }
}
