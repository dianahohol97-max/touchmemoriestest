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
 *
 * NOTE: this does NOT call auth.getUser() itself — it expects the calling
 * middleware to have already refreshed the session via updateSession() and
 * pass the resolved user. This avoids two problems:
 *   1. Calling getUser() before updateSession() means an expired access_token
 *      (with a valid refresh_token) returns null — admins would be redirected
 *      to /admin/login on every token-expiry boundary even though they're
 *      logged in.
 *   2. updateSession() returns a new NextResponse with rotated cookies. If we
 *      built our own response from scratch (the redirect path), those cookies
 *      were silently dropped.
 */
async function isUserAdmin(userEmail: string | null | undefined): Promise<boolean> {
    if (!userEmail) return false;

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !serviceKey) return false;

    // admin_users.id is its own UUID and is NOT the same as auth.users.id —
    // match by email, the same way the is_admin() DB function and the
    // requireAdmin guard do. Matching by user.id silently fails for every
    // real admin and would lock Diana out of the admin panel.
    const adminCheckUrl = `${url}/rest/v1/admin_users?select=id&email=ilike.${encodeURIComponent(userEmail)}`;
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

    // Any ACTIVE staff member may enter /admin. What they actually see inside
    // is decided by the permission system (PermissionsContext + per-section
    // route protection); admin-only API routes stay guarded by requireAdmin.
    // Clients (no staff row) are not allowed — they get bounced to /admin/login.
    const staffCheckUrl = `${url}/rest/v1/staff?select=role,is_active&email=ilike.${encodeURIComponent(userEmail)}`;
    try {
        const res = await fetch(staffCheckUrl, {
            headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
            cache: 'no-store',
        });
        if (res.ok) {
            const rows = await res.json();
            if (Array.isArray(rows) && rows.length > 0) {
                return rows[0]?.is_active !== false;
            }
        }
    } catch { /* deny on error */ }

    return false;
}

/**
 * Refresh the Supabase session and return both the resolved user (if any) and
 * the response to use (which may have rotated auth cookies set on it). The
 * caller can then either return the response as-is, or use it as a basis for
 * further header/cookie manipulation.
 */
async function refreshSessionAndGetUser(request: NextRequest): Promise<{
    user: { id: string; email?: string } | null;
    response: NextResponse;
}> {
    let response = NextResponse.next({ request });

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() { return request.cookies.getAll(); },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
                    response = NextResponse.next({ request });
                    cookiesToSet.forEach(({ name, value, options }) =>
                        response.cookies.set(name, value, options)
                    );
                },
            },
        }
    );

    const { data: { user } } = await supabase.auth.getUser();
    return { user: user ? { id: user.id, email: user.email ?? undefined } : null, response };
}

export async function proxy(request: NextRequest) {
    const { pathname } = request.nextUrl;

    // ─── /admin/* gating ────────────────────────────────────────────────
    // Before this guard, anyone could load /admin URLs and see the admin UI
    // shell. Data was protected by RLS + API guards, but the UI was open.
    //
    // Order matters: refresh the session first (which may rotate the auth
    // cookie if the access_token has expired but the refresh_token is still
    // valid), THEN check admin status. Doing the check first would cause
    // spurious logouts on every token-expiry boundary.
    if (pathname.startsWith('/admin') && !PUBLIC_ADMIN_PATHS.has(pathname)) {
        const { user } = await refreshSessionAndGetUser(request);
        const ok = await isUserAdmin(user?.email);
        if (!ok) {
            const loginUrl = new URL('/admin/login', request.url);
            loginUrl.searchParams.set('error', 'unauthorized');
            return NextResponse.redirect(loginUrl);
        }
        // Admin path with valid session — fall through to session refresh.
    }

    // ─── /{locale}/constructor/* and /{locale}/editor/* gating ──────────
    // Opening the book/poster constructor or editor requires a logged-in
    // account so the design auto-saves to the user's projects and can be
    // reopened later / on another device. Without this, a guest could reach
    // the editor via a direct URL, blog link or cart deep-link, design a
    // whole book, and lose it all on refresh (nothing persisted server-side).
    {
        const localeMatch = pathname.match(/^\/(uk|en|ro|pl|de)(\/.*)?$/);
        const subPath = localeMatch?.[2] || '';
        if (subPath.startsWith('/constructor/') || subPath.startsWith('/editor/')) {
            const { user, response } = await refreshSessionAndGetUser(request);
            if (!user) {
                const locale = localeMatch?.[1] || DEFAULT_LOCALE;
                const loginUrl = new URL(`/${locale}/login`, request.url);
                loginUrl.searchParams.set('next', pathname + (request.nextUrl.search || ''));
                return NextResponse.redirect(loginUrl);
            }
            // Logged in — return the session-refreshed response so rotated
            // auth cookies are preserved.
            return response;
        }
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
        const pathWithoutLocale = pathname.slice(locale.length + 1) || '/';

        // Public pages (catalog, category, blog, home) don't need session refresh.
        // Calling updateSession on these sets Supabase cookies → Vercel adds
        // Cache-Control: private, no-store → Google cannot index the page.
        const isPublicPage =
            pathWithoutLocale === '/' ||
            pathWithoutLocale.startsWith('/catalog') ||
            pathWithoutLocale.startsWith('/category') ||
            pathWithoutLocale.startsWith('/blog') ||
            pathWithoutLocale.startsWith('/kontakty') ||
            pathWithoutLocale.startsWith('/about') ||
            pathWithoutLocale.startsWith('/faq') ||
            pathWithoutLocale.startsWith('/privacy') ||
            pathWithoutLocale.startsWith('/terms') ||
            pathWithoutLocale.startsWith('/cookies') ||
            pathWithoutLocale.startsWith('/refund');

        const existingLocale = request.cookies.get('tm_locale')?.value;
        const localeChanged = existingLocale !== locale;

        if (isPublicPage && !refCode) {
            // Public pages never need a session or locale cookie —
            // locale is persisted via localStorage on the client.
            // Returning without Set-Cookie keeps Cache-Control: public
            // so Vercel CDN and Google can cache these pages.
            return NextResponse.next({ request });
        }

        // Non-public pages (account, checkout, order, etc.) — refresh session
        const response = await updateSession(request);
        if (localeChanged) {
            response.cookies.set('tm_locale', locale, { maxAge: 60 * 60 * 24 * 365 });
        }
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
