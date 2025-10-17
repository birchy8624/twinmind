'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { normalizeUrl } from '@/utils/url'

const UpdateClientDetailsSchema = z.object({
  clientId: z.string().uuid(),
  name: z.string().trim().min(2),
  company: z.string().optional(),
  phone: z.string().optional(),
  timezone: z.string().trim().min(1),
  website: z.string().optional(),
  email: z.string().trim().email()
})

type ActionResult = { ok: true } | { ok: false; message: string }

export async function updateClientDetails(input: unknown): Promise<ActionResult> {
  const parsed = UpdateClientDetailsSchema.safeParse(input)

  if (!parsed.success) {
    return { ok: false, message: 'Invalid input.' }
  }

  const { clientId, name, company, phone, timezone, website, email } = parsed.data

  const admin = supabaseAdmin()

  const normalizedWebsite = normalizeUrl(website) ?? null
  const trimmedCompany = company?.trim() ?? ''
  const trimmedPhone = phone?.trim() ?? ''
  const trimmedTimezone = timezone.trim()
  const trimmedName = name.trim()
  const trimmedEmail = email.trim()

  const { error } = await admin
    .from('clients')
    .update({
      name: trimmedName,
      company: trimmedCompany || null,
      phone: trimmedPhone || null,
      timezone: trimmedTimezone,
      website: normalizedWebsite,
      email: trimmedEmail,
      updated_at: new Date().toISOString()
    })
    .eq('id', clientId)

  if (error) {
    console.error('Update client details error:', error)
    return { ok: false, message: error.message ?? 'Unable to update client.' }
  }

  revalidatePath(`/app/clients/${clientId}`, 'page')

  return { ok: true }
}
