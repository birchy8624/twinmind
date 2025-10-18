'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { createServerSupabase } from '@/lib/supabase/server'
import type { Database } from '@/types/supabase'

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

  const { clientId, firstName, lastName, email, phone, title, isPrimary } = parsed.data

  const supabase = createServerSupabase()
  const {
    data: { user }
  } = await supabase.auth.getUser()

  if (!user) {
    return { ok: false, message: 'You must be signed in to add contacts.' }
  }

  const { data: clientRow, error: clientError } = await supabase
    .from('clients')
    .select('id,gdpr_consent')
    .eq('id', clientId)
    .single()

  if (clientError || !clientRow) {
    return { ok: false, message: 'Client not found or inaccessible.' }
  }

  const admin = supabaseAdmin()

  if (isPrimary) {
    const { error: unsetPrimaryError } = await admin
      .from('contacts')
      .update({ is_primary: false })
      .eq('client_id', clientId)

    if (unsetPrimaryError) {
      console.error('Unset primary contact error:', unsetPrimaryError)
      return { ok: false, message: 'Unable to update existing contacts.' }
    }
  }

  const contactInsert: Database['public']['Tables']['contacts']['Insert'] = {
    client_id: clientId,
    first_name: firstName,
    last_name: lastName,
    email,
    phone: phone ? phone : null,
    title: title ? title : null,
    is_primary: isPrimary,
    gdpr_consent: clientRow.gdpr_consent ?? null
  }

  const { data: contactRow, error: contactError } = await admin
    .from('contacts')
    .insert(contactInsert)
    .select('id')
    .single()

  if (contactError || !contactRow) {
    console.error('Create contact error:', contactError)
    return { ok: false, message: 'Unable to create contact.' }
  }

  revalidatePath(`/app/clients/${clientId}`)

  return { ok: true, contactId: contactRow.id }
}
