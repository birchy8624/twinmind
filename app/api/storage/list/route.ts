import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'

import type { Database } from '@/types/supabase'

import type { StorageListRequest } from '@/lib/api/types'

export async function POST(request: Request) {
  const { bucket, path = '', options = {} } = (await request.json()) as StorageListRequest

  const cookieStore = cookies()
  const supabase = createRouteHandlerClient<Database>({ cookies: cookieStore })

  const result = await supabase.storage.from(bucket).list(path, options)

  const status = result.error ? 400 : 200

  return NextResponse.json(result, { status })
}
