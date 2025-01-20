// middleware.ts (root directory)
import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Add routes that require authentication
const protectedRoutes = ['/chat', '/knowledge-bases', '/settings']

export async function middleware(req: NextRequest) {
  const res = NextResponse.next()
  const supabase = createMiddlewareClient({ req, res })
  
  // Check auth state
  const { data: { session } } = await supabase.auth.getSession()

  // Check if the current path requires authentication
  const isProtectedRoute = protectedRoutes.some(route => req.nextUrl.pathname.startsWith(route))

  if (isProtectedRoute && !session) {
    // Redirect unauthenticated users to the login page
    const redirectUrl = new URL('/auth/login', req.url)
    // Add the original URL as a query parameter to redirect back after login
    redirectUrl.searchParams.set('redirectTo', req.nextUrl.pathname)
    return NextResponse.redirect(redirectUrl)
  }

  return res
}