import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { updateSession } from '@/lib/supabase/middleware';

const LOCALES = ['uk', 'en', 'ro', 'pl', 'de'];
const DEFAULT_LOCALE = 'uk';

const SKIP_PREFIXES = [
    '/admin', '/api', '/_next', '/favicon',
    '/robots', '/sitemap', '/public',
    '/auth', // supabase auth callback
];

const PUBLIC_ADMIN_PATHS = new Set(['/admin/login', '/admin/no-access']);

function getLocaleFromAcceptLanguage(acceptLang: string | null): string {
    if (!acceptLang) return DEFAULT_LOCALE;
    const langs = acceptLang.split(',').map(l => {
        const [lang, q = '1'] = l.trim().split(';q=');
        return { lang: lang.split('-')[0].toLowerCase(), q: parseFloat(q) };
    }).sort((a, b) => b.q - a.q);
    for (const { lang } of langs) {
        if (lang === 'uk' || lang === 'ru') return 'uk';
        if (LOCALES.includes(lang)) return lang;
    }
    return DEFAULT_LOCALE;
}

/**
 * Look up whether the currently-authenticated session belongs to an admin or
 * owner staff member. Uses the service-role admin client because regular RLS
 * would prevent the staff lookup before the admin can be recognised.
 *
 * Returns true if user is admin/owner, false otherwise (including no session).
 */
async function isAdminSession(request: NextRequest): Promise<boolean> {
    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() { return request.cookies.getAll(); },
                setAll() { /* no-op: middleware guard does not set cookies */ },
            },
        }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    // Service role client for the admin/staff lookup (bypasses RLS).
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !serviceKey) return false;

    // admin_users.id is its own UUID and is NOT the same as auth.users.id —
    // match by email, the same way the is_admin() DB function and the
    // requireAdmin guard do. Matching by user.id silently fails for every
    // real admin and would lock Diana out of the admin panel.
    if (!user.email) return false;
    const adminCheckUrl = `${url}/rest/v1/admin_users?select=id&email=eq.${encodeURIComponent(user.email)}`;
    try {
        const res = await fetch(adminCheckUrl, {
            headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
            cache: 'no-store',
        });
        if (res.ok) {
            const rows = await res.json();
            if (Array.isArray(rows) && rows.length > 0) return true;
        }
    } catch { /* fall through to staff check */ }

    const staffCheckUrl = `${url}/rest/v1/staff?select=role&email=eq.${encodeURIComponent(user.email)}`;
    try {
        const res = await fetch(staffCheckUrl, {
            headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
            cache: 'no-store',
        });
        if (res.ok) {
            const rows = await res.json();
            if (Array.isArray(rows) && rows.length > 0) {
                const role = rows[0]?.role;
                return role === 'admin' || role === 'owner';
            }
        }
    } catch { /* deny on error */ }

    return false;
}

export async function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;

    // ─── /admin/* gating ────────────────────────────────────────────────
    // Before this guard, anyone could load /admin URLs and see the admin UI
    // shell. Data was protected by RLS + API guards, but the UI was open.
    if (pathname.startsWith('/admin') && !PUBLIC_ADMIN_PATHS.has(pathname)) {
        const ok = await isAdminSession(request);
        if (!ok) {
            const loginUrl = new URL('/admin/login', request.url);
            loginUrl.searchParams.set('error', 'unauthorized');
            return NextResponse.redirect(loginUrl);
        }
        // Admin path with valid session — fall through to session refresh.
    }

    // Skip non-page routes
    if (SKIP_PREFIXES.some(prefix => pathname.startsWith(prefix))) {
        // Still update Supabase session for auth routes
        return await updateSession(request);
    }

    // Handle ref code (affiliate/referral tracking)
    const refCode = request.nextUrl.searchParams.get('ref');

    // Check if path already has a locale
    const hasLocale = LOCALES.some(
        locale => pathname === `/${locale}` || pathname.startsWith(`/${locale}/`)
    );

    if (hasLocale) {
        const locale = pathname.split('/')[1];
        const response = await updateSession(request);
        response.cookies.set('tm_locale', locale, { maxAge: 60 * 60 * 24 * 365 });
        if (refCode) response.cookies.set('tm_ref', refCode, { maxAge: 60 * 60 * 24 * 30 });
        return response;
    }

    // No locale in path — detect and redirect
    const cookieLocale = request.cookies.get('tm_locale')?.value;
    const targetLocale = (cookieLocale && LOCALES.includes(cookieLocale))
        ? cookieLocale
        : getLocaleFromAcceptLanguage(request.headers.get('accept-language'));

    const redirectUrl = new URL(
        `/${targetLocale}${pathname === '/' ? '' : pathname}`,
        request.url
    );
    // Preserve search params
    request.nextUrl.searchParams.forEach((v, k) => {
        if (k !== 'ref') redirectUrl.searchParams.set(k, v);
    });

    const response = NextResponse.redirect(redirectUrl);
    if (refCode) response.cookies.set('tm_ref', refCode, { maxAge: 60 * 60 * 24 * 30 });
    return response;
}

export const config = {
    matcher: [
        '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|woff|woff2)).*)',
    ],
};
