import { createClient as _createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'

export const createBrowserClient = () =>
  _createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
