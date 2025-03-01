import { createClient } from '@/app/utils/supabase/server'
import { redirect } from 'next/navigation'
import { SupabaseProvider } from '@/app/contexts/SupabaseContext'

export default async function ChatLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = createClient()
  
  // Get user session server-side
  const { data: { session } } = await supabase.auth.getSession()
  
  // If user is not logged in, redirect to login
  if (!session?.user) {
    redirect('/auth/login')
  }
  
  // Check if user is active by querying the users table
  const { data: dbUser, error } = await supabase
    .from('users')
    .select('active')
    .eq('id', session.user.id)
    .single()
    
  // If user has active=false, redirect to inactive page
  if (dbUser?.active === false) {
    console.log('User is inactive, redirecting to /inactive')
    redirect('/inactive')
  }
  
  if (error) {
    console.error('Error checking user active status:', error)
  }
  
  return (
    <SupabaseProvider>
      {children}
    </SupabaseProvider>
  )
} 