import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'

import type { Database } from '@/types/supabase'

import type { StorageSignedUrlRequest } from '@/lib/api/types'

export async function POST(request: Request) {
  const { bucket, path, expiresIn } = (await request.json()) as StorageSignedUrlRequest

  const cookieStore = cookies()
  const supabase = createRouteHandlerClient<Database>({ cookies: cookieStore })

  const result = await supabase.storage.from(bucket).createSignedUrl(path, expiresIn)

  const status = result.error ? 400 : 200

  return NextResponse.json(result, { status })
}
