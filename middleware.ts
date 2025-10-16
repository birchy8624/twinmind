import { NextResponse, type NextRequest } from 'next/server'
import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'

const DASHBOARD_PATH = '/app/dashboard'
const SIGN_IN_PATH = '/sign_in'
const PROTECTED_PREFIX = '/app'

export async function middleware(request: NextRequest) {
  const response = NextResponse.next()
  const supabase = createMiddlewareClient({ req: request, res: response })
  const {
    data: { session }
  } = await supabase.auth.getSession()

  const { pathname } = request.nextUrl
  const isProtectedRoute = pathname.startsWith(PROTECTED_PREFIX)
  const isAuthRoute = pathname.startsWith(SIGN_IN_PATH)

  if (!session && isProtectedRoute) {
    const redirectUrl = request.nextUrl.clone()
    redirectUrl.pathname = SIGN_IN_PATH
    redirectUrl.search = ''
    return NextResponse.redirect(redirectUrl)
  }

  if (session && isAuthRoute) {
    const redirectUrl = request.nextUrl.clone()
    redirectUrl.pathname = DASHBOARD_PATH
    redirectUrl.search = ''
    return NextResponse.redirect(redirectUrl)
  }

  return response
}

export const config = {
  matcher: ['/app/:path*', '/sign_in']
}
