import { NextRequest, NextResponse } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

const LOCALES = ['uk', 'en', 'ro', 'pl', 'de'];
const DEFAULT_LOCALE = 'uk';

const SKIP_PREFIXES = [
    '/admin', '/api', '/_next', '/favicon',
    '/robots', '/sitemap', '/public',
    '/auth', // supabase auth callback
];

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

export async function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;

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
