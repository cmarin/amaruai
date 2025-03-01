import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(req: NextRequest) {
  const res = NextResponse.next()
  const supabase = createMiddlewareClient({ req, res })
  
  // Get the user's session
  const { data: { session } } = await supabase.auth.getSession()
  
  // Skip the check for public routes and the inactive page itself
  const isPublicRoute = req.nextUrl.pathname.startsWith('/auth') || 
                        req.nextUrl.pathname === '/inactive' ||
                        req.nextUrl.pathname === '/'
                        
  if (session && !isPublicRoute) {
    // If user is logged in and accessing a protected route, check if they're active
    const { data: dbUser } = await supabase
      .from('users')
      .select('active')
      .eq('id', session.user.id)
      .single()
    
    // If user is not active, redirect to inactive page
    if (dbUser && dbUser.active === false) {
      return NextResponse.redirect(new URL('/inactive', req.url))
    }
  }
  
  return res
}

// Add paths that should be checked by the middleware
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|images|api/webhooks).*)'],
}
