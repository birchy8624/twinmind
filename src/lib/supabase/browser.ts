import { createClientComponentClient, type SupabaseClient } from '@supabase/auth-helpers-nextjs'

import type { Database } from '@/types/supabase'

let browserClient: SupabaseClient<Database> | null = null
let hasAuthListener = false

export function createBrowserClient() {
  if (!browserClient) {
    browserClient = createClientComponentClient<Database>()
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
