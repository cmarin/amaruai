// app/auth/callback/route.ts
import { createClient } from '../../utils/supabase/server'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const returnTo = requestUrl.searchParams.get('returnTo') || '/chat'
  
  if (code) {
    const cookieStore = cookies()
    const supabase = createClient()
    
    // Exchange the code for a session
    const { data: { session }, error } = await supabase.auth.exchangeCodeForSession(code)
    
    if (!error && session) {
      // Successful login - redirect to the return URL or default to /chat
      return NextResponse.redirect(`${requestUrl.origin}${returnTo}`)
    }
  }

  // If there's an error or no code, redirect to login
  return NextResponse.redirect(`${requestUrl.origin}/auth/login`)
}