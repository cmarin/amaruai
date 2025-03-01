import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(req: NextRequest) {
  // Debugging - log the current path
  console.log(`Middleware running for path: ${req.nextUrl.pathname}`)
  
  const res = NextResponse.next()
  const supabase = createMiddlewareClient({ req, res })
  
  // Get the user's session
  const { data: { session }, error: sessionError } = await supabase.auth.getSession()
  
  // Skip the check for public routes and the inactive page itself
  const isPublicRoute = req.nextUrl.pathname.startsWith('/auth') || 
                        req.nextUrl.pathname === '/inactive' ||
                        req.nextUrl.pathname === '/'
  
  if (sessionError) {
    console.error('Error getting session in middleware:', sessionError)
    return res
  }
  
  // Only run the active check for protected routes and for authenticated users
  if (session?.user?.id && !isPublicRoute) {
    try {
      console.log(`Checking active status for user: ${session.user.id}`)
      
      // Query the users table to check the active status
      const { data: dbUser, error: dbError } = await supabase
        .from('users')
        .select('active')
        .eq('id', session.user.id)
        .single()
      
      if (dbError) {
        console.error('Error checking user active status:', dbError)
        return res
      }
      
      console.log(`User active status: ${dbUser?.active}`)
      
      // Specifically check if active is false (not undefined or null)
      if (dbUser && dbUser.active === false) {
        console.log(`Redirecting inactive user to /inactive`)
        return NextResponse.redirect(new URL('/inactive', req.url))
      }
    } catch (error) {
      console.error('Unexpected error in middleware:', error)
    }
  }
  
  return res
}

// Ensure the matcher includes all routes we want to protect
export const config = {
  matcher: [
    // Match all paths except next static files, images, and other public assets
    '/((?!_next/static|_next/image|favicon.ico|images|api/webhooks).*)',
  ],
}
