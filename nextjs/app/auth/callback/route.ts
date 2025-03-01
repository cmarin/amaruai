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
      console.log("User authenticated, checking active status:", session.user.id)
      
      try {
        // Check if this is a new user by looking for their entry in the users table
        const { data: existingUser, error: userCheckError } = await supabase
          .from('users')
          .select('id, active')
          .eq('id', session.user.id)
          .single()
        
        console.log("Existing user check:", existingUser, userCheckError)
        
        if (userCheckError || !existingUser) {
          // If user doesn't exist in the users table, add them with active=false
          console.log("Creating new user with active=false:", session.user.id)
          const { error: insertError } = await supabase
            .from('users')
            .insert([{ 
              id: session.user.id, 
              email: session.user.email,
              active: false 
            }])
          
          if (insertError) {
            console.error('Error setting user as inactive:', insertError)
          }
          
          // New user with active=false - redirect to inactive page
          return NextResponse.redirect(`${requestUrl.origin}/inactive`)
        } 
        
        // We have an existing user - check if they're active
        if (existingUser.active === false) {
          console.log("User exists but is inactive, redirecting to inactive page:", session.user.id)
          return NextResponse.redirect(`${requestUrl.origin}/inactive`)
        }
        
        // Active user - redirect to the return URL or default to /chat
        console.log("User is active, redirecting to:", returnTo)
        return NextResponse.redirect(`${requestUrl.origin}${returnTo}`)
      } catch (err) {
        console.error("Error in auth callback:", err)
        // If there's an error, direct to login
        return NextResponse.redirect(`${requestUrl.origin}/auth/login`)
      }
    }
  }

  // If there's an error or no code, redirect to login
  return NextResponse.redirect(`${requestUrl.origin}/auth/login`)
}