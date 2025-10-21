import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { createServerSupabase } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import type { Database } from '@/types/supabase'

const updateRoleSchema = z.object({
  role: z.literal('owner')
})

type ProfilesTable = Database['public']['Tables']['profiles']

export async function PATCH(
  request: Request,
  context: { params: { profileId: string } }
) {
  let payload: unknown

  try {
    payload = await request.json()
  } catch (error) {
    console.error('Failed to parse update workspace user payload:', error)
    return NextResponse.json({ message: 'Invalid role update request.' }, { status: 400 })
  }

  const parsed = updateRoleSchema.safeParse(payload)

  if (!parsed.success) {
    return NextResponse.json({ message: 'Invalid role update request.' }, { status: 400 })
  }

  const { profileId } = context.params

  const supabase = createServerSupabase()
  const {
    data: { user: currentUser }
  } = await supabase.auth.getUser()

  if (!currentUser) {
    return NextResponse.json({ message: 'Not authenticated.' }, { status: 401 })
  }

  const admin = supabaseAdmin()

  try {
    const { error } = await admin
      .from('profiles')
      .update<ProfilesTable['Update']>({
        role: parsed.data.role,
        updated_at: new Date().toISOString()
      })
      .eq('id', profileId)

    if (error) {
      throw error
    }

    revalidatePath('/app/user-management')

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('updateWorkspaceUserRole error:', error)

    if (error instanceof Error && 'message' in error) {
      return NextResponse.json({ message: error.message }, { status: 500 })
    }

    return NextResponse.json(
      { message: 'Unable to update workspace role.' },
      { status: 500 }
    )
  }
}
