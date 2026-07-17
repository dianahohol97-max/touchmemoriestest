'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';

const LOCALES = ['uk', 'en', 'ro', 'pl', 'de'];

/**
 * OAuthCallbackHandler — catches ?code= on any page and exchanges it for a session.
 * This handles the case where Google OAuth redirects to / instead of /auth/callback.
 */
export function OAuthCallbackHandler() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const pathname = usePathname();

    useEffect(() => {
        const code = searchParams.get('code');
        if (!code) return;

        // The admin login page handles its own OAuth code exchange and routes
        // into /admin (gated by proxy.ts). Don't hijack it to /account.
        if (pathname?.startsWith('/admin')) return;

        const supabase = createBrowserClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        );

        supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
            if (error) {
                console.error('OAuth code exchange error:', error.message);
            } else if (pathname?.includes('/reset-password')) {
                // Password-recovery link: the emailed URL lands on
                // /reset-password with a ?code=. Exchange it (done above) but
                // STAY on the page so the user can set a new password —
                // bouncing them to /account here made the reset form
                // unreachable. Strip the used code from the URL.
                router.replace(pathname);
            } else {
                // Redirect to the localized account page. A bare "/account"
                // 404s because the route only exists under [locale].
                const seg = pathname?.split('/')[1] ?? '';
                const locale = LOCALES.includes(seg) ? seg : 'uk';
                router.replace(`/${locale}/account`);
            }
        });
    }, [searchParams, router, pathname]);

    return null;
}
