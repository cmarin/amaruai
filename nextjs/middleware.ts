import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Add routes that require authentication
const protectedPaths = ['/chat', '/knowledge-bases', '/settings']

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - auth/* (auth routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public/* (public files)
     */
    '/((?!auth|_next/static|_next/image|favicon.ico|public).*)',
  ],
}

export async function middleware(req: NextRequest) {
  try {
    // Create a response object that we can modify
    const res = NextResponse.next()
    
    // Create the Supabase client
    const supabase = createMiddlewareClient({ req, res })
    
    // Refresh session if expired - required for Server Components
    const { data: { session } } = await supabase.auth.getSession()
    
    const pathname = req.nextUrl.pathname

    // Check if the current path requires authentication
    const isProtectedRoute = protectedPaths.some(path => pathname.startsWith(path))

    if (isProtectedRoute && !session) {
      // Create the URL for the login page with the return URL
      const redirectUrl = new URL('/auth/login', req.url)
      redirectUrl.searchParams.set('returnTo', pathname)
      
      // Return redirect Response
      return NextResponse.redirect(redirectUrl)
    }

    return res
  } catch (e) {
    // Log any errors
    console.error('Middleware error:', e)
    return NextResponse.next()
  }
}
