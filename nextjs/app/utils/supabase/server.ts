// utils/supabase/server.ts
import { createClient as supabaseCreateClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

export const createClient = () => {
  return supabaseCreateClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storage: {
          getItem: (key: string) => {
            const value = cookies().get(key)?.value
            return Promise.resolve(value ?? null)
          },
          setItem: (key: string, value: string) => {
            cookies().set(key, value)
            return Promise.resolve()
          },
          removeItem: (key: string) => {
            cookies().set(key, '')
            return Promise.resolve()
          },
        },
      },
    }
  )
}
