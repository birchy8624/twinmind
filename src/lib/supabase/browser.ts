import type { SupabaseClient } from '@supabase/supabase-js'

import type { Database } from '@/types/supabase'

import { createDatabaseProxy } from '../api/databaseClient'
import { createStorageProxy } from '../api/storageClient'
import { getBrowserAuthClient } from './auth-client'

type BrowserDatabaseClient = ReturnType<typeof createDatabaseProxy>
type BrowserStorageClient = ReturnType<typeof createStorageProxy>

type BrowserClient = {
  auth: SupabaseClient<Database>['auth']
  from: BrowserDatabaseClient['from']
  storage: BrowserStorageClient
}

let cachedClient: BrowserClient | null = null
let hasAuthListener = false

export function createBrowserClient(): BrowserClient {
  const authClient = getBrowserAuthClient()

  if (!cachedClient) {
    const database = createDatabaseProxy()
    const storage = createStorageProxy()

    cachedClient = {
      auth: authClient.auth,
      from: database.from.bind(database),
      storage,
    }
  }

  if (typeof window !== 'undefined' && !hasAuthListener) {
    authClient.auth.onAuthStateChange((event, session) => {
      if (event === 'INITIAL_SESSION') {
        return
      }

      if (event === 'SIGNED_OUT') {
        void fetch('/api/auth/callback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          keepalive: true,
          body: JSON.stringify({ event }),
        })
        return
      }

      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        void fetch('/api/auth/callback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          keepalive: true,
          body: JSON.stringify({ event, session }),
        })
      }
    })

    hasAuthListener = true
  }

  return cachedClient
}
