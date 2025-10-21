import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { createServerSupabase } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import type { Database } from '@/types/supabase'

const contactSchema = z.object({
  firstName: z.string().trim().min(2),
  lastName: z.string().trim().min(2),
  email: z.string().trim().email(),
  phone: z.string().trim().optional().or(z.literal('')),
  title: z.string().trim().optional().or(z.literal('')),
  isPrimary: z.boolean().default(false)
})

export async function POST(
  request: Request,
  context: { params: { clientId: string } }
) {
  let payload: unknown

  try {
    payload = await request.json()
  } catch (error) {
    console.error('Failed to parse create contact payload:', error)
    return NextResponse.json({ message: 'Invalid input.' }, { status: 400 })
  }

  const parsed = contactSchema.safeParse(payload)

  if (!parsed.success) {
    return NextResponse.json({ message: 'Invalid input.' }, { status: 400 })
  }

  const { clientId } = context.params
  const { firstName, lastName, email, phone, title, isPrimary } = parsed.data

  const supabase = createServerSupabase()
  const {
    data: { user }
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json(
      { message: 'You must be signed in to add contacts.' },
      { status: 401 }
    )
  }

  const { data: clientRow, error: clientError } = await supabase
    .from('clients')
    .select('id')
    .eq('id', clientId)
    .single<{ id: string }>()

  if (clientError || !clientRow) {
    return NextResponse.json(
      { message: 'Client not found or inaccessible.' },
      { status: 404 }
    )
  }

  const admin = supabaseAdmin()

  if (isPrimary) {
    const { error: unsetPrimaryError } = await admin
      .from('contacts')
      .update({ is_primary: false })
      .eq('client_id', clientId)

    if (unsetPrimaryError) {
      console.error('Unset primary contact error:', unsetPrimaryError)
      return NextResponse.json(
        { message: 'Unable to update existing contacts.' },
        { status: 500 }
      )
    }
  }

  const contactInsert: Database['public']['Tables']['contacts']['Insert'] = {
    client_id: clientId,
    first_name: firstName,
    last_name: lastName,
    email,
    phone: phone ? phone : null,
    title: title ? title : null,
    is_primary: isPrimary
  }

  const { data: contactRow, error: contactError } = await admin
    .from('contacts')
    .insert(contactInsert)
    .select('id')
    .single()

  if (contactError || !contactRow) {
    console.error('Create contact error:', contactError)
    return NextResponse.json(
      { message: 'Unable to create contact.' },
      { status: 500 }
    )
  }

  revalidatePath(`/app/clients/${clientId}`)

  return NextResponse.json({ ok: true, contactId: contactRow.id })
}
