import { NextResponse } from 'next/server';
import { render } from '@react-email/components';
import WelcomeSeriesEmail from '@/emails/WelcomeSeriesEmail';
import { getAdminClient } from '@/lib/supabase/admin';
import { sendBrevoEmail, getBrevoApiKey } from '@/lib/email/brevo';
import { getAutomationConfig } from '@/lib/email/automation-config';
import { logOutgoingEmail, readSendOutcome, sendOutcomeFromError, htmlToTextSnapshot } from '@/lib/email/log-outgoing';

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
            const cfg = await getAutomationConfig(step.type);
            if (cfg && !cfg.enabled) {
                result[step.type] = { sent: 0, errors: 0, candidates: 0 };
                continue;
            }
            const subject = cfg?.subject || step.subject;
            const promoCode = cfg?.promo_code || 'WELCOME7';
            const bodyOverride = cfg?.body || undefined;
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
                // Журнал вихідних пишеться на кожну спробу, і на успішну, і на
                // провалену: інакше «не дійшло» і «не відправляли» виглядають
                // однаково. Складання листа стоїть усередині того самого try —
                // збій шаблону теж означає «лист не пішов», і одна людина не
                // має права зупинити всю чергу (Діана, 16.09.2026).
                let outcome;
                let html = '';
                try {
                    html = await render(
                        WelcomeSeriesEmail({ firstName, variant: step.variant, promoCode, discount: '-7%', appUrl, body: bodyOverride })
                    );
                    const res = await sendBrevoEmail({
                        to: c.email,
                        toName: c.name || c.email,
                        subject,
                        html,
                        kind: 'marketing',
                        unsubscribe: { email: c.email },
                    });
                    outcome = readSendOutcome(res);
                } catch (e: any) {
                    console.error(`[welcome-series] ${step.type} failed for`, c.email, e?.message || e);
                    outcome = sendOutcomeFromError(e);
                }

                await logOutgoingEmail({
                    orderId: null,
                    to: c.email,
                    template: step.type,
                    subject,
                    body: html ? htmlToTextSnapshot(html) : `Лист не склався: шаблон ${step.type} не відрендерився.`,
                    outcome,
                });

                if (outcome.sent) {
                    // Захист від повторів, а не журнал доставки: ставиться лише
                    // після успіху, інакше відмова Brevo назавжди закрила б
                    // людині цей крок серії.
                    await supabase.from('email_automation_log').insert({ email: c.email, automation_type: step.type });
                    sent++;
                } else {
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
