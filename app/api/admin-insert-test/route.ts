import { NextResponse } from 'next/server'

import { supabaseAdmin } from '@/lib/supabaseAdmin'
import type { Database } from '@/types/supabase'

export async function GET() {
  const sb = supabaseAdmin()
  const payload: Database['public']['Tables']['clients']['Insert'] = {
    name: 'PingTest',
    website: null
  }

  const { data, error } = await sb
    .from('clients')
    .insert(payload)
    .select('id')
    .single()

  return NextResponse.json({
    ok: !error,
    error: error?.message ?? null,
    data
  })
}
