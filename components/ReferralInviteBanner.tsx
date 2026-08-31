'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Gift, X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useConsent } from '@/lib/consent/ConsentProvider';
import { readPendingReferralCode } from '@/lib/referral/pending-code';

const DISMISSED_KEY = 'tm_ref_banner_dismissed';

/**
 * Invite banner shown to a visitor who arrived on a friend's referral link and
 * is not signed in yet.
 *
 * WHY IT EXISTS. The referral program only ever pays out when the friend has a
 * registered account before they order — that is a deliberate anti-abuse rule
 * (see app/api/referral/capture/route.ts), but until now it was written down in
 * exactly one place: the REFERRER's own cabinet. The friend, the one person who
 * has to act on it, never saw it anywhere. A friend who followed the link and
 * checked out as a guest lost both bonuses permanently and had no way to know
 * why. This banner is the one place that rule is stated to the person it binds.
 *
 * It stays hidden unless the stored ?ref= really is a customer referral code:
 * the same parameter also carries agency and blog promo codes, which are a
 * discount, not an invite.
 */
export default function ReferralInviteBanner() {
    const { bannerVisible: cookieBannerVisible } = useConsent();
    const [terms, setTerms] = useState<{ friendReward: number; minOrder: number } | null>(null);
    const [dismissed, setDismissed] = useState(false);

    useEffect(() => {
        const code = readPendingReferralCode();
        if (!code) return;

        try {
            if (localStorage.getItem(DISMISSED_KEY) === code) { setDismissed(true); return; }
        } catch { /* ignore */ }

        let cancelled = false;

        (async () => {
            // Signed-in visitors are past the point this banner is about —
            // ReferralCapture has already linked (or will link) them.
            const supabase = createClient();
            if (supabase) {
                const { data } = await supabase.auth.getSession();
                if (cancelled || data?.session) return;
            }

            const res = await fetch(`/api/referral/check?code=${encodeURIComponent(code)}`).catch(() => null);
            const json = await res?.json().catch(() => null);
            if (cancelled || !json) return;
            if (!json.referral) {
                // An agency / blog promo code, not an invite. Remember that so
                // we don't re-ask the server on every single page load for the
                // whole time the visitor carries this code around.
                try { localStorage.setItem(DISMISSED_KEY, code); } catch { /* ignore */ }
                return;
            }

            setTerms({
                friendReward: Number(json.friendReward) || 50,
                minOrder: Number(json.minOrder) || 1000,
            });
        })();

        return () => { cancelled = true; };
    }, []);

    if (!terms || dismissed || cookieBannerVisible) return null;

    const dismiss = () => {
        setDismissed(true);
        const code = readPendingReferralCode();
        if (code) { try { localStorage.setItem(DISMISSED_KEY, code); } catch { /* ignore */ } }
    };

    return (
        <div style={{
            position: 'fixed', left: 16, bottom: 16, zIndex: 900,
            width: 'calc(100% - 32px)', maxWidth: 380,
            background: 'linear-gradient(135deg,#263A99,#1a2a73)', color: 'white',
            borderRadius: 14, padding: '18px 20px',
            boxShadow: '0 12px 32px rgba(38,58,153,0.32)',
        }}>
            <button
                onClick={dismiss}
                aria-label="Закрити"
                style={{
                    position: 'absolute', top: 10, right: 10, background: 'transparent',
                    border: 'none', color: 'rgba(255,255,255,0.65)', cursor: 'pointer',
                    padding: 4, lineHeight: 0,
                }}
            >
                <X size={16} />
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, paddingRight: 20 }}>
                <Gift size={18} />
                <span style={{ fontSize: 15, fontWeight: 800 }}>Вас запросив друг</span>
            </div>

            <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.6, opacity: 0.92 }}>
                Зареєструйте акаунт до того, як оформите замовлення, і після покупки від {terms.minOrder} ₴ ми нарахуємо вам {terms.friendReward} ₴ бонусів. Покупка без реєстрації до програми не зараховується, і додати її заднім числом ми не зможемо.
            </p>

            <Link
                href="/register"
                style={{
                    display: 'inline-block', marginTop: 14, padding: '9px 18px',
                    background: 'white', color: '#263a99', borderRadius: 999,
                    fontSize: 13.5, fontWeight: 800, textDecoration: 'none',
                }}
            >
                Створити акаунт
            </Link>
        </div>
    );
}
