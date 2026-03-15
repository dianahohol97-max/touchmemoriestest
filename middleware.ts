import { type NextRequest, NextResponse } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

export async function middleware(req: NextRequest) {
    // Do not intercept auth callback — let it handle the OAuth redirect itself
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
        /*
         * Match all request paths except:
         * - _next/static (static files)
         * - _next/image (image optimization)
         * - favicon.ico
         * - api routes (handled separately)
         */
        '/((?!_next/static|_next/image|favicon.ico|api).*)',
    ],
}
