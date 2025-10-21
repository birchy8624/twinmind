import { getBrowserAuthClient } from './supabase/auth-client'

export async function fetchWithAuth(input: string, init: RequestInit = {}) {
  const supabase = getBrowserAuthClient()
  const { data } = await supabase.auth.getSession()
  const jwt = data.session?.access_token
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? 'placeholder-key'

  return fetch(input, {
    ...init,
    headers: {
      ...(init.headers || {}),
      apikey: anonKey,
      ...(jwt ? { Authorization: `Bearer ${jwt}` } : {})
    }
  })
}
