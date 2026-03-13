import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(req: NextRequest) {
    const response = NextResponse.next();

    // Capture Referral Code
    const refCode = req.nextUrl.searchParams.get('ref');
    if (refCode) {
        response.cookies.set('tm_ref', refCode, { maxAge: 60 * 60 * 24 * 30 }); // 30 days
    }

    // Simple path-based protection (auth checks happen at page level)
    // Note: Full auth validation happens in the actual page components
    // This middleware just handles basic routing

    return response;
}

export const config = {
    matcher: ['/((?!api|_next/static|_next/image|favicon.ico|sounds).*)'],
};
