// app/auth/callback/route.ts
import { createClient } from '../../utils/supabase/server'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const returnTo = requestUrl.searchParams.get('returnTo') || '/chat'
  
  if (!code) {
    console.error('No code provided in auth callback')
    return NextResponse.redirect(`${requestUrl.origin}/auth/login?error=no_code`)
  }
  
  try {
    const cookieStore = cookies()
    const supabase = createClient()
    
    // Exchange the code for a session
    const { data: { session }, error } = await supabase.auth.exchangeCodeForSession(code)
    
    if (error) {
      console.error('Error exchanging code for session:', error)
      return NextResponse.redirect(`${requestUrl.origin}/auth/login?error=auth_error`)
    }
    
    if (!session) {
      console.error('No session returned after code exchange')
      return NextResponse.redirect(`${requestUrl.origin}/auth/login?error=no_session`)
    }
    
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
        
        // Add a delay before redirecting to allow session to be fully established
        await new Promise(resolve => setTimeout(resolve, 500))
        
        // New user with active=false - redirect to inactive page
        return NextResponse.redirect(`${requestUrl.origin}/inactive`)
      } 
      
      // We have an existing user - check if they're active
      if (existingUser.active === false) {
        console.log("User exists but is inactive, redirecting to inactive page:", session.user.id)
        
        // Add a delay before redirecting to allow session to be fully established
        await new Promise(resolve => setTimeout(resolve, 500))
        
        return NextResponse.redirect(`${requestUrl.origin}/inactive`)
      }
      
      // Active user - add a delay to ensure session is established
      console.log("User is active, redirecting to:", returnTo)
      await new Promise(resolve => setTimeout(resolve, 500))
      
      return NextResponse.redirect(`${requestUrl.origin}${returnTo}`)
    } catch (err) {
      console.error("Error in auth callback:", err)
      // If there's an error, direct to login
      return NextResponse.redirect(`${requestUrl.origin}/auth/login?error=unexpected`)
    }
  } catch (error) {
    console.error('Fatal error in auth callback:', error)
    return NextResponse.redirect(`${requestUrl.origin}/auth/login?error=fatal`)
  }
}