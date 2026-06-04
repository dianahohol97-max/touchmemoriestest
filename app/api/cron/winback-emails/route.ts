import { NextResponse } from 'next/server';
import { render } from '@react-email/components';
import WinBackEmail from '@/emails/WinBackEmail';
import { getAdminClient } from '@/lib/supabase/admin';
import { sendBrevoEmail, getBrevoApiKey } from '@/lib/email/brevo';

export const dynamic = 'force-dynamic';

// Win-back automation. Targets customers whose latest PAID order is between
// DAYS_MIN and DAYS_MAX days ago, who haven't ordered since, aren't
// unsubscribed, and haven't been win-backed within COOLDOWN_DAYS. Sends a
// -10% WINBACK10 nudge via Brevo and records the send in email_automation_log.
//
// Dormant until the site accumulates real paid orders — get_winback_candidates
// returns 0 today, so this is a no-op that activates automatically as data arrives.
const DAYS_MIN = 60;       // not too soon after the last purchase
const DAYS_MAX = 540;      // ~18 months — older than that, treat as cold
const COOLDOWN_DAYS = 120; // don't win-back the same person more than ~3x/year
const BATCH_LIMIT = 100;   // stay well under Brevo's daily send cap

export async function GET(request: Request) {
    const authHeader = request.headers.get('authorization');
    if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!getBrevoApiKey()) {
        return NextResponse.json({ message: 'BREVO_API_KEY not configured — skipped', sent: 0 });
    }

    const supabase = getAdminClient();
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://touchmemories.com.ua';

    try {
        const { data: candidates, error } = await supabase.rpc('get_winback_candidates', {
            p_days_min: DAYS_MIN,
            p_days_max: DAYS_MAX,
            p_cooldown_days: COOLDOWN_DAYS,
            p_limit: BATCH_LIMIT,
        });
        if (error) throw error;

        if (!candidates || candidates.length === 0) {
            return NextResponse.json({ message: 'No win-back candidates', sent: 0 });
        }

        let sent = 0;
        let errors = 0;

        for (const c of candidates as Array<{ email: string; customer_name: string | null }>) {
            const nameParts = (c.customer_name || '').trim().split(/\s+/).filter(Boolean);
            // Legacy CRM stores "Прізвище Імʼя", so the given name is the last token
            // (matches the |last convention used in the KeyCRM templates).
            const firstName = nameParts.length ? nameParts[nameParts.length - 1] : '';
            try {
                const html = await render(
                    WinBackEmail({ firstName, promoCode: 'WINBACK10', discount: '-10%', appUrl })
                );
                await sendBrevoEmail({
                    to: c.email,
                    toName: c.customer_name || c.email,
                    subject: 'Ми скучили — ваша знижка -10% на наступну фотокнигу',
                    html,
                    fromEmail: 'touch.memories3@gmail.com',
                });
                await supabase.from('email_automation_log').insert({
                    email: c.email,
                    automation_type: 'winback',
                    meta: { promo_code: 'WINBACK10' },
                });
                sent++;
            } catch (e: any) {
                console.error('[winback] send failed for', c.email, e?.message || e);
                errors++;
            }
        }

        return NextResponse.json({ message: 'Win-back cron executed', candidates: candidates.length, sent, errors });
    } catch (err: any) {
        console.error('[winback] cron error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
