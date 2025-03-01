import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(req: NextRequest) {
  // Debugging - log the current path
  console.log(`Middleware running for path: ${req.nextUrl.pathname}`)
  
  // Skip check for public routes and static assets
  const isPublicRoute = 
    req.nextUrl.pathname.startsWith('/auth') || 
    req.nextUrl.pathname === '/inactive' ||
    req.nextUrl.pathname === '/' ||
    req.nextUrl.pathname === '/unauthorized' ||
    req.nextUrl.pathname.startsWith('/_next') ||
    req.nextUrl.pathname.startsWith('/images') ||
    req.nextUrl.pathname === '/favicon.ico' ||
    req.nextUrl.pathname.startsWith('/api/webhooks')
  
  if (isPublicRoute) {
    console.log(`Skipping middleware check for public route: ${req.nextUrl.pathname}`)
    return NextResponse.next()
  }
  
  // This is a protected route - check authentication and active status
  console.log(`Protected route check: ${req.nextUrl.pathname}`)
  
  const res = NextResponse.next()
  const supabase = createMiddlewareClient({ req, res })
  
  // Get user session server-side
  const { data: { session }, error: sessionError } = await supabase.auth.getSession()
  
  if (sessionError) {
    console.error('Error getting session in middleware:', sessionError)
    return NextResponse.redirect(new URL('/auth/login', req.url))
  }
  
  // If no user session for a protected route, redirect to login
  if (!session?.user) {
    console.log(`No session, redirecting to login from: ${req.nextUrl.pathname}`)
    return NextResponse.redirect(new URL('/auth/login', req.url))
  }
  
  // User is logged in, now check if they're active
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
      // On error, still allow access but log the error
      return res
    }
    
    console.log(`User active status: ${JSON.stringify(dbUser)}`)
    
    // Explicitly check if active is false
    if (dbUser && dbUser.active === false) {
      console.log(`Redirecting inactive user to /inactive from: ${req.nextUrl.pathname}`)
      return NextResponse.redirect(new URL('/inactive', req.url))
    }
  } catch (error) {
    console.error('Unexpected error in middleware:', error)
  }
  
  return res
}

// Explicitly list protected routes that need authentication checks
export const config = {
  matcher: [
    '/chat/:path*',
    '/account/:path*',
    '/settings/:path*',
    '/admin/:path*',
    '/dashboard/:path*',
    '/batch-flow/:path*', 
    '/knowledge-bases/:path*',
    '/prompt-templates/:path*',
    '/personas/:path*',
    '/workflows/:path*',
    '/fusion/:path*',
    '/content-remix/:path*',
    '/scratch-pad/:path*'
  ],
}
