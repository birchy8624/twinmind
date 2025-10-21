import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'

import type { Database } from '@/types/supabase'

export async function POST(request: Request) {
  const formData = await request.formData()

  const bucket = formData.get('bucket') as string | null
  const path = formData.get('path') as string | null
  const file = formData.get('file') as File | null
  const metadataRaw = formData.get('metadata') as string | null

  if (!bucket || !path || !file) {
    return NextResponse.json(
      { error: { message: 'Missing storage parameters' } },
      { status: 400 },
    )
  }

  let options: { upsert?: boolean } = {}

  if (metadataRaw) {
    try {
      options = JSON.parse(metadataRaw) as { upsert?: boolean }
    } catch {
      options = {}
    }
  }

  const cookieStore = cookies()
  const supabase = createRouteHandlerClient<Database>({ cookies: cookieStore })

  const result = await supabase.storage.from(bucket).upload(path, file, options)

  const status = result.error ? 400 : 200

  return NextResponse.json(result, { status })
}
