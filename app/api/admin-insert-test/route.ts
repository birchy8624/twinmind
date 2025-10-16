import { NextResponse } from 'next/server'

import { supabaseAdmin } from '@/lib/supabaseAdmin'

export async function GET() {
  const sb = supabaseAdmin()
  const { data, error } = await sb
    .from('clients')
    .insert({ name: 'PingTest', website: null })
    .select('id')
    .single()

  return NextResponse.json({
    ok: !error,
    error: error?.message ?? null,
    data
  })
}
