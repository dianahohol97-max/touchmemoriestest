import { NextResponse } from 'next/server';
import { render } from '@react-email/components';
import WelcomeSeriesEmail from '@/emails/WelcomeSeriesEmail';
import { getAdminClient } from '@/lib/supabase/admin';
import { sendBrevoEmail, getBrevoApiKey } from '@/lib/email/brevo';

export const dynamic = 'force-dynamic';

// Welcome drip that follows the immediate welcome email (sent on subscribe).
// Step 2 (~day 2): ideas / what we make. Step 3 (~day 4): reminder the
// WELCOME7 code is still active. Each step is sent once per subscriber
// (tracked in email_automation_log) and only to people who subscribed within
// the last MAX_AGE_DAYS, so enabling this never spams long-time subscribers.
const MAX_AGE_DAYS = 30;
const BATCH_LIMIT = 100;

const STEPS: Array<{
    type: string; dayOffset: number; variant: 'ideas' | 'reminder'; subject: string;
}> = [
    { type: 'welcome_step2', dayOffset: 2, variant: 'ideas', subject: 'Ось що можна створити з ваших фото 💙' },
    { type: 'welcome_step3', dayOffset: 4, variant: 'reminder', subject: 'Ваш промокод WELCOME7 ще активний' },
];

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

    const result: Record<string, { sent: number; errors: number; candidates: number }> = {};

    try {
        for (const step of STEPS) {
            const { data: candidates, error } = await supabase.rpc('get_welcome_series_candidates', {
                p_automation_type: step.type,
                p_day_offset: step.dayOffset,
                p_max_age_days: MAX_AGE_DAYS,
                p_limit: BATCH_LIMIT,
            });
            if (error) throw error;

            let sent = 0, errors = 0;
            for (const c of (candidates || []) as Array<{ email: string; name: string | null }>) {
                const parts = (c.name || '').trim().split(/\s+/).filter(Boolean);
                const firstName = parts.length ? parts[parts.length - 1] : '';
                try {
                    const html = await render(
                        WelcomeSeriesEmail({ firstName, variant: step.variant, promoCode: 'WELCOME7', discount: '-7%', appUrl })
                    );
                    await sendBrevoEmail({
                        to: c.email,
                        toName: c.name || c.email,
                        subject: step.subject,
                        html,
                        fromEmail: 'touch.memories3@gmail.com',
                    });
                    await supabase.from('email_automation_log').insert({ email: c.email, automation_type: step.type });
                    sent++;
                } catch (e: any) {
                    console.error(`[welcome-series] ${step.type} failed for`, c.email, e?.message || e);
                    errors++;
                }
            }
            result[step.type] = { sent, errors, candidates: (candidates || []).length };
        }

        return NextResponse.json({ message: 'Welcome-series cron executed', result });
    } catch (err: any) {
        console.error('[welcome-series] cron error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
