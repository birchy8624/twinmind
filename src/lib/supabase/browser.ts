import { createClient, type SupabaseClient } from '@supabase/supabase-js'

import type { Database } from '@/types/supabase'

let browserClient: SupabaseClient<Database> | null = null
let hasAuthListener = false

export function createBrowserClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://placeholder.supabase.co'
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? 'placeholder-key'

  if (typeof window === 'undefined') {
    return createClient<Database>(supabaseUrl, supabaseAnonKey)
  }

  if (!browserClient) {
    browserClient = createClient<Database>(supabaseUrl, supabaseAnonKey)
  }

  if (!hasAuthListener && browserClient) {
    const client = browserClient

    client.auth.onAuthStateChange((event, session) => {
      if (event === 'INITIAL_SESSION') {
        return
      }

      if (event === 'SIGNED_OUT') {
        void fetch('/api/auth/callback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          keepalive: true,
          body: JSON.stringify({ event })
        })
        return
      }

      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        void fetch('/api/auth/callback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          keepalive: true,
          body: JSON.stringify({ event, session })
        })
      }
    })

    hasAuthListener = true
  }

  return browserClient
}
