import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'
import { NextResponse, type NextRequest } from 'next/server'

import type { Database } from '@/types/supabase'

const DASHBOARD_PATH = '/app/dashboard'
const SIGN_IN_PATH = '/sign_in'
const PROTECTED_PREFIX = '/app'
const ACCOUNT_SETUP_PATH = '/app/setup-account'

export async function middleware(request: NextRequest) {
  const response = NextResponse.next()
  const supabase = createMiddlewareClient<Database>({ req: request, res: response })
  const {
    data: { session }
  } = await supabase.auth.getSession()

  const { pathname } = request.nextUrl
  const isProtectedRoute = pathname.startsWith(PROTECTED_PREFIX)
  const isAuthRoute = pathname.startsWith(SIGN_IN_PATH)
  const isAccountSetupRoute = pathname.startsWith(ACCOUNT_SETUP_PATH)

  const resolveRole = async () => {
    const metadataRole = (() => {
      const candidate = session?.user?.user_metadata?.role
      if (typeof candidate === 'string') {
        const normalized = candidate.trim().toLowerCase()
        if (normalized === 'owner' || normalized === 'client') {
          return normalized as Database['public']['Enums']['role_enum']
        }
      }
      return null
    })()

    if (metadataRole) {
      return metadataRole
    }

    if (!session?.user?.id) {
      return null
    }

    const { data: profileRow, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', session.user.id)
      .maybeSingle()

    if (profileError) {
      console.error('Failed to load profile role in middleware', profileError)
      return null
    }

    type ProfileRow = Database['public']['Tables']['profiles']['Row']

    const typedProfile = (profileRow ?? null) as Pick<ProfileRow, 'role'> | null

    return typedProfile?.role ?? null
  }

  const role = session ? await resolveRole() : null

  if (!session && isProtectedRoute && !isAccountSetupRoute) {
    const redirectUrl = request.nextUrl.clone()
    redirectUrl.pathname = SIGN_IN_PATH
    redirectUrl.search = ''
    return NextResponse.redirect(redirectUrl)
  }

  if (session && isAuthRoute) {
    const redirectUrl = request.nextUrl.clone()
    redirectUrl.pathname = role === 'client' ? '/app/projects' : DASHBOARD_PATH
    redirectUrl.search = ''
    return NextResponse.redirect(redirectUrl)
  }

  if (session && isProtectedRoute && role === 'client') {
    const isProjectsHome = pathname === '/app/projects'
    const isProjectDetail = /^\/app\/projects\/[\w-]+$/.test(pathname)
    const isSettingsPath = pathname.startsWith('/app/settings')
    const isAllowed = isProjectsHome || isProjectDetail || isSettingsPath

    if (!isAllowed) {
      const redirectUrl = request.nextUrl.clone()
      redirectUrl.pathname = '/app/projects'
      redirectUrl.search = ''
      return NextResponse.redirect(redirectUrl)
    }
  }

  return response
}

export const config = {
  matcher: ['/app/:path*', '/sign_in']
}
