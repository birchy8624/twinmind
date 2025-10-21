import { createClient, type SupabaseClient } from '@supabase/supabase-js'

import type { Database } from '@/types/supabase'

let authClient: SupabaseClient<Database> | null = null

export function getBrowserAuthClient() {
  if (authClient) {
    return authClient
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://placeholder.supabase.co'
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? 'placeholder-key'

  authClient = createClient<Database>(supabaseUrl, supabaseAnonKey)

  return authClient
}
