'use client';

import { useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';

const REF_KEY = 'tm_ref_code';

/**
 * Referral capture bootstrap (mounted globally).
 *
 *  1. On any page load, if the URL has ?ref=CODE, store it in localStorage
 *     (so it survives the registration flow / OAuth redirects).
 *  2. If a user session exists and a stored ref code is present, call
 *     /api/referral/capture once to link the referral, then clear the code.
 */
export default function ReferralCapture() {
    useEffect(() => {
        try {
            const params = new URLSearchParams(window.location.search);
            const ref = params.get('ref');
            if (ref && /^[A-Za-z0-9]{4,16}$/.test(ref)) {
                localStorage.setItem(REF_KEY, ref.toUpperCase());
            }
        } catch { /* ignore */ }

        const stored = (() => { try { return localStorage.getItem(REF_KEY); } catch { return null; } })();
        if (!stored) return;

        const supabase = createClient();
        if (!supabase) return;

        let cancelled = false;
        supabase.auth.getUser().then(({ data }) => {
            if (cancelled || !data?.user) return;
            fetch('/api/referral/capture', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code: stored }),
            })
                .then(r => r.json())
                .then(res => {
                    // Clear on any definitive outcome so we don't retry forever.
                    if (res && (res.ok || ['already_referred', 'already_exists', 'self', 'unknown_code'].includes(res.reason))) {
                        try { localStorage.removeItem(REF_KEY); } catch { /* ignore */ }
                    }
                })
                .catch(() => {});
        });

        return () => { cancelled = true; };
    }, []);

    return null;
}
