import { createClient } from '@supabase/supabase-js'

import type { Database } from '@/types/supabase'

export function createBrowserClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://placeholder.supabase.co'
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? 'placeholder-key'

  return createClient<Database>(
    supabaseUrl,
    supabaseAnonKey
  )
}
