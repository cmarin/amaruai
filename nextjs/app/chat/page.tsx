import { createClient } from '@/app/utils/supabase/server'
import { redirect } from 'next/navigation'

// This is a server component that will check user status before rendering the chat page
export async function UserStatusChecker() {
  const supabase = createClient()
  
  // Get user session server-side
  const { data: { session }, error: sessionError } = await supabase.auth.getSession()
  
  if (sessionError) {
    console.error('Error checking session:', sessionError)
    redirect('/auth/login')
  }
  
  // If no session, redirect to login
  if (!session?.user) {
    redirect('/auth/login')
  }
  
  // Force a check of the active status directly
  const { data: dbUser, error: dbError } = await supabase
    .from('users')
    .select('active')
    .eq('id', session.user.id)
    .single()
  
  if (dbError) {
    console.error('Error checking user status:', dbError)
  }
  
  // If user is inactive, redirect to inactive page
  if (dbUser?.active === false) {
    console.log(`User ${session.user.id} is inactive, redirecting to /inactive`)
    redirect('/inactive')
  }
  
  return null
}

export default async function ChatPage() {
  // Check user status before rendering anything
  await UserStatusChecker()
  
  // Your existing chat page content goes here...
  return (
    <div>
      <h1>Chat Page</h1>
      {/* Rest of your chat interface */}
    </div>
  )
} 