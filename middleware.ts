import { type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

export async function middleware(req: NextRequest) {
    // 1. Update Supabase Session
    const response = await updateSession(req);

    // 2. Capture Referral Code (Preserved Logic)
    const refCode = req.nextUrl.searchParams.get('ref');
    if (refCode) {
        response.cookies.set('tm_ref', refCode, { maxAge: 60 * 60 * 24 * 30 }); // 30 days
    }

    return response;
}

export const config = {
    matcher: ['/((?!api|_next/static|_next/image|favicon.ico|sounds).*)'],
};
