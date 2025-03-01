import { createClient } from '@/app/utils/supabase/server'
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'

export default async function ChatLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = createClient()
  
  try {
    // Get user session server-side
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    
    if (sessionError) {
      console.error('Error checking session in chat layout:', sessionError)
      // Don't redirect immediately - check if there's an auth cookie first
      const authCookie = cookies().get('sb-auth-token')
      if (!authCookie) {
        return redirect('/auth/login')
      }
    }
    
    // If no session, check for auth-related cookies before redirecting
    if (!session?.user) {
      console.log('No session in chat layout, checking for auth cookies')
      const authCookie = cookies().get('sb-auth-token')
      const refreshCookie = cookies().get('sb-refresh-token')
      
      // If no auth cookies are present, redirect to login
      if (!authCookie && !refreshCookie) {
        return redirect('/auth/login')
      }
    } else {
      // We have a session, now check if user is active
      const { data: dbUser, error: dbError } = await supabase
        .from('users')
        .select('active')
        .eq('id', session.user.id)
        .single()
      
      if (dbError) {
        console.error('Error checking user status in chat layout:', dbError)
      }
      
      // If user is inactive, redirect to inactive page
      if (dbUser?.active === false) {
        console.log(`User ${session.user.id} is inactive, redirecting to /inactive from chat layout`)
        return redirect('/inactive')
      }
    }
  } catch (error) {
    console.error('Unexpected error in chat layout:', error)
    // Don't redirect here, let the client-side auth guard handle it
  }
  
  return <>{children}</>
} 