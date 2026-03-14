import { type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

export async function middleware(req: NextRequest) {
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
