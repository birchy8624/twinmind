import { NextResponse } from 'next/server'

import type { Database } from '@/types/supabase'

import { getAccessContext, HttpError } from '../../_lib/access'

const CLIENTS = 'clients' as const

export const runtime = 'nodejs'

type ClientOption = Pick<Database['public']['Tables']['clients']['Row'], 'id' | 'name'>

type ClientOptionsResponse = { clients: ClientOption[] }

export async function GET() {
  try {
    const { supabase, role, clientMemberships } = await getAccessContext({
      allowEmptyClientMemberships: true,
    })

    if (role === 'client' && clientMemberships.length === 0) {
      return NextResponse.json<ClientOptionsResponse>({ clients: [] })
    }

    let query = supabase.from(CLIENTS).select('id, name').order('name', { ascending: true })

    if (role === 'client') {
      query = query.in('id', clientMemberships)
    }

    const { data, error } = await query.returns<ClientOption[] | null>()

    if (error) {
      console.error('clients options query error:', error)
      return NextResponse.json({ message: 'Unable to load clients.' }, { status: 500 })
    }

    const clients = Array.isArray(data)
      ? (data as ClientOption[]).filter(
          (client): client is ClientOption => typeof client?.id === 'string' && typeof client?.name === 'string',
        )
      : []

    return NextResponse.json<ClientOptionsResponse>({ clients })
  } catch (error) {
    if (error instanceof HttpError) {
      return NextResponse.json({ message: error.message }, { status: error.status })
    }

    console.error('clients options unexpected error:', error)
    return NextResponse.json({ message: 'Unable to load clients.' }, { status: 500 })
  }
}
