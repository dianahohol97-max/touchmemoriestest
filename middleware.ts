import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

// Server-side gate for the admin panel. Page-level protection used to be
// client-only (a redirect after hydration), so anonymous visitors could load
// the admin UI shell — no data leaked (RLS + requireStaff on APIs held), but
// the shell shouldn't render at all. Matcher is scoped STRICTLY to /admin so
// the public site, locale redirects and editor are untouched.
export async function middleware(req: NextRequest) {
    const { pathname } = req.nextUrl;

    // Login and no-access pages must stay reachable.
    if (pathname === '/admin/login' || pathname === '/admin/no-access') {
        return NextResponse.next();
    }

    const res = NextResponse.next();
    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() { return req.cookies.getAll(); },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value, options }) =>
                        res.cookies.set(name, value, options));
                },
            },
        },
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        const login = req.nextUrl.clone();
        login.pathname = '/admin/login';
        login.search = '';
        return NextResponse.redirect(login);
    }
    // Fine-grained role/permission checks stay where they are today:
    // usePermissions in the layout + requireStaff on every admin API.
    return res;
}

export const config = {
    matcher: ['/admin/:path*'],
};
