import { createClient } from '@/app/utils/supabase/server'
import { redirect } from 'next/navigation'
import { SupabaseProvider } from '@/app/contexts/SupabaseContext'

// List of admin user IDs that are allowed to access the admin section
// This should be moved to a database table in a production environment
const ADMIN_USER_IDS: string[] = [
  // Add your user ID here
]

export default async function AdminLayout({
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
  
  // Check if user is an admin
  const isAdmin = ADMIN_USER_IDS.includes(session.user.id)
  
  // If not admin, redirect to unauthorized page
  if (!isAdmin) {
    redirect('/unauthorized')
  }
  
  return (
    <SupabaseProvider>
      {children}
    </SupabaseProvider>
  )
} 