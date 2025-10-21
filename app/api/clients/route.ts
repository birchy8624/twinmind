import { NextResponse } from 'next/server'

import type { Database } from '@/types/supabase'

import { getAccessContext, HttpError } from '../_lib/access'

const CLIENTS = 'clients' as const

export const runtime = 'nodejs'

type ClientRow = Database['public']['Tables']['clients']['Row']

type ClientSelection = Pick<
  ClientRow,
  'id' | 'name' | 'website' | 'account_status' | 'created_at' | 'notes' | 'updated_at' | 'account_id'
>

export async function GET() {
  try {
    const { supabase, role, clientMemberships } = await getAccessContext({
      allowEmptyClientMemberships: true,
    })

    if (role === 'client' && clientMemberships.length === 0) {
      return NextResponse.json({ clients: [] })
    }

    let query = supabase
      .from(CLIENTS)
      .select('id, name, website, account_status, created_at, notes, updated_at, account_id')
      .order('created_at', { ascending: false })

    if (role === 'client') {
      query = query.in('id', clientMemberships)
    }

    const { data, error } = await query.returns<ClientSelection[] | null>()

    if (error) {
      console.error('clients list query error:', error)
      return NextResponse.json({ message: 'Unable to load clients.' }, { status: 500 })
    }

    const clientRows = Array.isArray(data) ? (data as ClientSelection[]) : []

    const clients = clientRows.map((client) => ({
      ...client,
      website: client.website ?? null,
      account_status: client.account_status ?? null,
      created_at: client.created_at ?? null,
      notes: client.notes ?? null,
      updated_at: client.updated_at ?? null,
      account_id: client.account_id ?? null,
    }))

    return NextResponse.json({ clients })
  } catch (error) {
    if (error instanceof HttpError) {
      return NextResponse.json({ message: error.message }, { status: error.status })
    }

    console.error('clients list unexpected error:', error)
    return NextResponse.json({ message: 'Unable to load clients.' }, { status: 500 })
  }
}
