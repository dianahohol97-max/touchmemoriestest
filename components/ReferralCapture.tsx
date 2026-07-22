'use client';

import { useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';

const REF_KEY = 'tm_ref_code';
// Codes we've already attempted to link as a customer referral, so we don't
// re-POST on every mount. Kept SEPARATE from REF_KEY on purpose (see below).
const TRIED_KEY = 'tm_ref_captured';

/**
 * Referral capture bootstrap (mounted globally).
 *
 *  1. On any page load, if the URL has ?ref=CODE, store it in localStorage
 *     (so it survives the registration flow / OAuth redirects).
 *  2. If a user session exists and a stored ref code is present, call
 *     /api/referral/capture ONCE to link a customer referral.
 *
 * It deliberately does NOT delete REF_KEY afterwards: the same ?ref= value may
 * be an AGENCY / BLOG promo code that the checkout page still needs to
 * auto-apply the discount. Previously this component cleared the code on
 * `unknown_code` (exactly the agency-code case), so for a logged-in visitor who
 * arrived via an agency link the discount silently vanished before checkout.
 * Checkout now owns the end of the code's lifecycle (clears it once an order is
 * placed); here we only mark it "tried" to avoid re-POSTing.
 */
export default function ReferralCapture() {
    useEffect(() => {
        try {
            const params = new URLSearchParams(window.location.search);
            const ref = params.get('ref');
            // Allow Cyrillic: partner codes are generated from agency names.
            if (ref && /^[A-Za-z0-9А-ЯІЇЄҐа-яіїєґ]{4,16}$/.test(ref)) {
                localStorage.setItem(REF_KEY, ref.toUpperCase());
            }
        } catch { /* ignore */ }

        const stored = (() => { try { return localStorage.getItem(REF_KEY); } catch { return null; } })();
        if (!stored) return;
        // Already attempted the customer-referral link for this exact code.
        const tried = (() => { try { return localStorage.getItem(TRIED_KEY); } catch { return null; } })();
        if (tried === stored) return;

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
                .then(() => {
                    // Mark this code as tried (any outcome) so we don't re-POST,
                    // but leave REF_KEY in place for the checkout auto-apply.
                    try { localStorage.setItem(TRIED_KEY, stored); } catch { /* ignore */ }
                })
                .catch(() => {});
        });

        return () => { cancelled = true; };
    }, []);

    return null;
}
