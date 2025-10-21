import { NextResponse } from 'next/server'

import type { Database } from '@/types/supabase'

import { getAccessContext, HttpError } from '../_lib/access'

const COMMENTS = 'comments' as const

export const runtime = 'nodejs'

type NotificationRow = Database['public']['Tables']['comments']['Row'] & {
  project: Pick<Database['public']['Tables']['projects']['Row'], 'id' | 'name' | 'client_id'> | null
  author_profile: Pick<Database['public']['Tables']['profiles']['Row'], 'id' | 'full_name' | 'role'> | null
}

type NotificationsResponse = { notifications: NotificationRow[] }

export async function GET() {
  try {
    const { supabase, role, clientMemberships, userId } = await getAccessContext({
      allowEmptyClientMemberships: true,
    })

    if (role === 'client' && clientMemberships.length === 0) {
      return NextResponse.json<NotificationsResponse>({ notifications: [] })
    }

    const { data, error } = await supabase
      .from(COMMENTS)
      .select(
        `
          id,
          body,
          created_at,
          visibility,
          project:project_id ( id, name, client_id ),
          author_profile:author_profile_id ( id, full_name, role )
        `,
      )
      .neq('author_profile_id', userId)
      .order('created_at', { ascending: false })
      .limit(50)

    if (error) {
      console.error('notifications query error:', error)
      return NextResponse.json({ message: 'Unable to load notifications.' }, { status: 500 })
    }

    const records = Array.isArray(data) ? (data as NotificationRow[]) : []

    const filtered =
      role === 'client'
        ? records.filter((record) => {
            if (record.visibility === 'owner') {
              return false
            }

            const clientId = record.project?.client_id
            if (!clientId) {
              return false
            }

            return clientMemberships.includes(clientId)
          })
        : records

    return NextResponse.json<NotificationsResponse>({ notifications: filtered })
  } catch (error) {
    if (error instanceof HttpError) {
      return NextResponse.json({ message: error.message }, { status: error.status })
    }

    console.error('notifications unexpected error:', error)
    return NextResponse.json({ message: 'Unable to load notifications.' }, { status: 500 })
  }
}
