import { createClient } from '@/app/utils/supabase/server'
import { redirect } from 'next/navigation'

export default async function ChatLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = createClient()
  
  // Get user session server-side
  const { data: { session }, error: sessionError } = await supabase.auth.getSession()
  
  if (sessionError) {
    console.error('Error checking session in chat layout:', sessionError)
    redirect('/auth/login')
  }
  
  // If no session, redirect to login
  if (!session?.user) {
    console.log('No session in chat layout, redirecting to login')
    redirect('/auth/login')
  }
  
  // Force a check of the active status directly
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
    redirect('/inactive')
  }
  
  return <>{children}</>
} 