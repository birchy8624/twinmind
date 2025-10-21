import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'

import type { Database } from '@/types/supabase'

import type { StorageRemoveRequest } from '@/lib/api/types'

export async function POST(request: Request) {
  const { bucket, paths } = (await request.json()) as StorageRemoveRequest

  const cookieStore = cookies()
  const supabase = createRouteHandlerClient<Database>({ cookies: cookieStore })

  const result = await supabase.storage.from(bucket).remove(paths)

  const status = result.error ? 400 : 200

  return NextResponse.json(result, { status })
}
