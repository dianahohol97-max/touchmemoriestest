import { NextResponse } from 'next/server';
import { render } from '@react-email/components';
import AbandonedCartEmail from '@/emails/AbandonedCartEmail';
import { getAdminClient } from '@/lib/supabase/admin';
import { sendBrevoEmail, getBrevoApiKey } from '@/lib/email/brevo';

export const dynamic = 'force-dynamic';

// Abandoned-cart reminder. Targets carts captured at checkout that have sat
// idle between HOURS_MIN and HOURS_MAX, where no order was placed since, the
// customer isn't unsubscribed, and no reminder was sent within COOLDOWN.
// Dormant until the site has real checkout traffic.
const HOURS_MIN = 4;
const HOURS_MAX = 72;
const COOLDOWN_HOURS = 168; // ~7 days
const BATCH_LIMIT = 100;

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
        const { data: candidates, error } = await supabase.rpc('get_abandoned_cart_candidates', {
            p_hours_min: HOURS_MIN,
            p_hours_max: HOURS_MAX,
            p_cooldown_hours: COOLDOWN_HOURS,
            p_limit: BATCH_LIMIT,
        });
        if (error) throw error;

        if (!candidates || candidates.length === 0) {
            return NextResponse.json({ message: 'No abandoned carts', sent: 0 });
        }

        let sent = 0;
        let errors = 0;

        for (const c of candidates as Array<{ email: string; items: any[]; total: number; currency: string }>) {
            try {
                const html = await render(
                    AbandonedCartEmail({
                        items: Array.isArray(c.items) ? c.items : [],
                        total: Number(c.total) || 0,
                        currency: c.currency || 'UAH',
                        appUrl,
                    })
                );
                await sendBrevoEmail({
                    to: c.email,
                    toName: c.email,
                    subject: 'Ваш кошик чекає на вас 💙',
                    html,
                    fromEmail: 'touch.memories3@gmail.com',
                });
                await supabase.from('email_automation_log').insert({
                    email: c.email,
                    automation_type: 'abandoned_cart',
                    meta: { total: c.total },
                });
                sent++;
            } catch (e: any) {
                console.error('[abandoned-cart] send failed for', c.email, e?.message || e);
                errors++;
            }
        }

        return NextResponse.json({ message: 'Abandoned-cart cron executed', candidates: candidates.length, sent, errors });
    } catch (err: any) {
        console.error('[abandoned-cart] cron error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
