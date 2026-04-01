import { NextRequest, NextResponse } from 'next/server';

const LOCALES = ['uk', 'en', 'ro', 'pl', 'de'];
const DEFAULT_LOCALE = 'uk';

// Pages that should NOT be redirected (admin, api, static)
const SKIP_PREFIXES = ['/admin', '/api', '/_next', '/favicon', '/robots', '/sitemap', '/public'];

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

export function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;

    // Skip non-page routes
    if (SKIP_PREFIXES.some(prefix => pathname.startsWith(prefix))) {
        return NextResponse.next();
    }

    // Check if path already has a locale
    const hasLocale = LOCALES.some(
        locale => pathname === `/${locale}` || pathname.startsWith(`/${locale}/`)
    );

    if (hasLocale) {
        // Set locale cookie for server components
        const locale = pathname.split('/')[1];
        const response = NextResponse.next();
        response.cookies.set('tm_locale', locale, { maxAge: 60 * 60 * 24 * 365 });
        return response;
    }

    // No locale in path — detect and redirect
    // 1. Check cookie first
    const cookieLocale = request.cookies.get('tm_locale')?.value;
    if (cookieLocale && LOCALES.includes(cookieLocale)) {
        return NextResponse.redirect(new URL(`/${cookieLocale}${pathname}`, request.url));
    }

    // 2. Check Accept-Language header
    const acceptLang = request.headers.get('accept-language');
    const detectedLocale = getLocaleFromAcceptLanguage(acceptLang);

    return NextResponse.redirect(
        new URL(`/${detectedLocale}${pathname === '/' ? '' : pathname}`, request.url)
    );
}

export const config = {
    matcher: [
        // Match all paths except static files and API
        '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|woff|woff2)).*)',
    ],
};
