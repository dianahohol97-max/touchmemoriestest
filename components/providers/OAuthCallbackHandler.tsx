'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';

/**
 * OAuthCallbackHandler — catches ?code= on any page and exchanges it for a session.
 * This handles the case where Google OAuth redirects to / instead of /auth/callback.
 */
export function OAuthCallbackHandler() {
    const router = useRouter();
    const searchParams = useSearchParams();

    useEffect(() => {
        const code = searchParams.get('code');
        if (!code) return;

        const supabase = createBrowserClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        );

        supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
            if (error) {
                console.error('OAuth code exchange error:', error.message);
            } else {
                // Remove ?code= from URL and redirect to /account
                router.replace('/account');
            }
        });
    }, [searchParams, router]);

    return null;
}
