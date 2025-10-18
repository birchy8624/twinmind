import { createBrowserClient } from './supabase/browser'

export async function fetchWithAuth(input: string, init: RequestInit = {}) {
  const supabase = createBrowserClient()
  const { data } = await supabase.auth.getSession()
  const jwt = data.session?.access_token

  return fetch(input, {
    ...init,
    headers: {
      ...(init.headers || {}),
      apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      ...(jwt ? { Authorization: `Bearer ${jwt}` } : {})
    }
  })
}
