import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

// Routes that require authentication.
// Matches /{locale}/constructor/* and /{locale}/editor/*
const PROTECTED_SEGMENTS = ['/constructor/', '/editor/'];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Check if this is a protected route.
  const needsAuth = PROTECTED_SEGMENTS.some(seg => pathname.includes(seg));
  if (!needsAuth) {
    return NextResponse.next({ request });
  }

  // Build a Supabase client that reads cookies from the request.
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
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    // Not logged in → redirect to login, passing current URL as ?next= so the
    // user lands back here after signing in.
    const loginUrl = request.nextUrl.clone();
    // Detect locale from the path (e.g. /uk/constructor/... → /uk/login)
    const localeMatch = pathname.match(/^\/([a-z]{2})\//);
    const locale = localeMatch ? localeMatch[1] : 'uk';
    loginUrl.pathname = `/${locale}/login`;
    loginUrl.searchParams.set('next', pathname + (request.nextUrl.search || ''));
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

export const config = {
  matcher: [
    // Match all constructor and editor routes across all locales
    '/(uk|en|ro|pl|de)/constructor/:path*',
    '/(uk|en|ro|pl|de)/editor/:path*',
  ],
};
