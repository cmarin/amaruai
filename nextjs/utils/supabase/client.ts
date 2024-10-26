import { createClient as supabaseCreateClient } from '@supabase/supabase-js'
import type { SupabaseClient } from '@supabase/supabase-js'

let supabase: SupabaseClient | null = null

export const createClient = (): SupabaseClient => {
  if (supabase) return supabase

  supabase = supabaseCreateClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  return supabase
}
