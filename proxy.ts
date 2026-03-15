import { NextResponse, type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

export async function proxy(req: NextRequest) {
  const pathname = req.nextUrl.pathname

  if (
    pathname.startsWith('/auth') ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/_next') ||
    pathname.includes('favicon')
  ) {
    return NextResponse.next()
  }

  const response = await updateSession(req)

  const refCode = req.nextUrl.searchParams.get('ref')
  if (refCode) {
    response.cookies.set('tm_ref', refCode, { 
      maxAge: 60 * 60 * 24 * 30 
    })
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}
