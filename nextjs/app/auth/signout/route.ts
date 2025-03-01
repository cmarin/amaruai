import { createClient } from '../../utils/supabase/server'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export async function POST(request: Request) {
  const cookieStore = cookies()
  const supabase = createClient()
  
  // Sign out on the server side
  await supabase.auth.signOut()
  
  // Return success response
  return NextResponse.json({ success: true })
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const cookieStore = cookies()
  const supabase = createClient()
  
  // Sign out on the server side
  await supabase.auth.signOut()
  
  // Redirect to login
  return NextResponse.redirect(`${requestUrl.origin}/auth/login`)
} 