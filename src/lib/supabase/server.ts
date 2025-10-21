import { cookies } from 'next/headers'
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import type { SupabaseClient } from '@supabase/supabase-js'

import type { Database } from '@/types/supabase'

export function createServerSupabase(): SupabaseClient<Database> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://placeholder.supabase.co'
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? 'placeholder-key'

  return createServerComponentClient<Database>(
    { cookies },
    {
      supabaseUrl,
      supabaseKey
    }
  ) as unknown as SupabaseClient<Database>
}
