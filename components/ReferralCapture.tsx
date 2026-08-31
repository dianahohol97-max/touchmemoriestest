'use client';

import { useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';

const REF_KEY = 'tm_ref_code';
// Codes we've already attempted to link as a customer referral, so we don't
// re-POST on every mount. Kept SEPARATE from REF_KEY on purpose (see below).
const TRIED_KEY = 'tm_ref_captured';

/**
 * Outcomes after which re-POSTing the same code can never change anything, so
 * the code is safe to mark "tried". Everything else — `no_customer` (the
 * customers row is created by a DB trigger and can lag a fresh signup by a
 * moment), `no_code`, a network error — is TRANSIENT and must stay unmarked so
 * the next auth event or page load retries it.
 */
const FINAL_REASONS = new Set(['already_referred', 'already_exists', 'self', 'unknown_code', 'no_code']);

/**
 * Guard value used when there is no stored code but we still want ONE attempt,
 * so the server can look for a code in the user's auth metadata (the friend
 * confirmed their email on a device that never saw the invite link). Landing
 * on a real ?ref= later clears the guard, so this never suppresses a genuine
 * code that arrives afterwards.
 */
const METADATA_ONLY = '@metadata';

/**
 * Referral capture bootstrap (mounted globally).
 *
 *  1. On any page load, if the URL has ?ref=CODE, store it in localStorage
 *     (so it survives the registration flow / OAuth redirects).
 *  2. Whenever a session exists — on mount AND on every auth state change —
 *     call /api/referral/capture to link a customer referral.
 *
 * WHY IT LISTENS TO AUTH EVENTS. It used to run its check exactly once, on
 * mount. The root layout mounts once per FULL page load and survives every
 * client-side navigation, so on the natural journey — land on /?ref=CODE (no
 * session yet, bail) → Register → /login → /account — the effect never ran
 * again and the referral was simply never created. Google signup lost it the
 * same way: OAuth returns to /uk/register?code=…, this component and
 * OAuthCallbackHandler mount together, getUser() resolves BEFORE the code is
 * exchanged for a session, and the following router.replace('/uk/account') is
 * a client-side navigation with no remount. onAuthStateChange fires on
 * SIGNED_IN in every one of those paths, which is what actually makes the
 * link happen at the right moment.
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
        const read = (key: string) => { try { return localStorage.getItem(key); } catch { return null; } };
        const write = (key: string, value: string) => { try { localStorage.setItem(key, value); } catch { /* ignore */ } };

        // Stash any ?ref= arriving on this page load.
        try {
            const params = new URLSearchParams(window.location.search);
            const ref = params.get('ref');
            // Allow Cyrillic: partner codes are generated from agency names.
            if (ref && /^[A-Za-z0-9А-ЯІЇЄҐа-яіїєґ]{4,16}$/.test(ref)) {
                const code = ref.toUpperCase();
                const previous = read(REF_KEY);
                write(REF_KEY, code);
                // A DIFFERENT code than the one we last tried deserves a fresh
                // attempt, otherwise a stale TRIED_KEY would suppress it.
                if (previous !== code) { try { localStorage.removeItem(TRIED_KEY); } catch { /* ignore */ } }
            }
        } catch { /* ignore */ }

        const supabase = createClient();
        if (!supabase) return;

        let cancelled = false;
        let inFlight = false;
        const timers: ReturnType<typeof setTimeout>[] = [];

        // `retriesLeft` covers the fresh-signup race: SIGNED_IN fires the
        // instant the session exists, which can be a beat before the DB
        // trigger has written the customers row the capture route needs.
        const attempt = async (retriesLeft = 2) => {
            if (cancelled || inFlight) return;

            const stored = read(REF_KEY);
            const guardValue = stored || METADATA_ONLY;
            if (read(TRIED_KEY) === guardValue) return;

            // Claim the slot BEFORE the first await. The mount call and the
            // INITIAL_SESSION event fire within a tick of each other, so a flag
            // set after the session lookup would let both through and POST
            // twice.
            inFlight = true;
            // Set when a retry is queued: `inFlight` then stays held until the
            // timer fires, so a concurrent auth event can't start a second run.
            let retryQueued = false;
            try {
                // getSession() reads the locally stored session — no network
                // round-trip on the many page loads where nobody is logged in.
                // It is only a gate: /api/referral/capture re-verifies the
                // caller server-side through requireAuth.
                const { data: sessionData } = await supabase.auth.getSession();
                if (cancelled || !sessionData?.session) return;

                const res = await fetch('/api/referral/capture', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(stored ? { code: stored } : {}),
                });
                const json = await res.json().catch(() => null);
                if (cancelled) return;

                if (json?.ok === true || FINAL_REASONS.has(json?.reason)) {
                    // Settled for good — don't POST this code again, but leave
                    // REF_KEY in place for the checkout auto-apply.
                    write(TRIED_KEY, guardValue);
                } else if (retriesLeft > 0) {
                    retryQueued = true;
                    timers.push(setTimeout(() => { inFlight = false; attempt(retriesLeft - 1); }, 2500));
                }
            } catch {
                // Network hiccup — stay unmarked so a later event retries.
            } finally {
                if (!retryQueued) inFlight = false;
            }
        };

        attempt();

        const { data: sub } = supabase.auth.onAuthStateChange((event) => {
            // SIGNED_IN covers password login, email-confirmation callback and
            // the OAuth code exchange; INITIAL_SESSION covers a page load that
            // restores an existing session after this effect already ran.
            if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION' || event === 'USER_UPDATED') {
                attempt();
            }
        });

        return () => {
            cancelled = true;
            timers.forEach(clearTimeout);
            sub?.subscription?.unsubscribe();
        };
    }, []);

    return null;
}
