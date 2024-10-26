import { createClient as supabaseCreateClient } from '@supabase/supabase-js'
import type { SupabaseClient } from '@supabase/supabase-js'

export const createClient = (): SupabaseClient => {
  return supabaseCreateClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
