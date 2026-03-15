import { type NextRequest, NextResponse } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

export async function proxy(req: NextRequest) {
  // Do not intercept auth callback - let it handle its own redirect
  if (req.nextUrl.pathname.startsWith('/auth/callback')) {
    return NextResponse.next()
  }

  const response = await updateSession(req)

  const refCode = req.nextUrl.searchParams.get('ref')
  if (refCode) {
    response.cookies.set('tm_ref', refCode, { maxAge: 60 * 60 * 24 * 30 })
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|api).*)',
  ],
}
