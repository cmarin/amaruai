import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Add routes that require authentication
const protectedPaths = ['/chat', '/knowledge-bases', '/settings']

// Add routes that should be excluded from middleware processing
const excludedPaths = [
  '/api',
  '/auth',
  '/_next/static',
  '/_next/image',
  '/favicon.ico',
  '/public'
]

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with excluded paths
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}

export async function middleware(req: NextRequest) {
  try {
    const pathname = req.nextUrl.pathname
    
    // Skip middleware for excluded paths
    if (excludedPaths.some(path => pathname.startsWith(path))) {
      return NextResponse.next()
    }

    // Create a response object that we can modify
    const res = NextResponse.next()
    
    // Create the Supabase client
    const supabase = createMiddlewareClient({ req, res })
    
    // Refresh session if expired - required for Server Components
    const {
      data: { session },
    } = await supabase.auth.getSession()

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
