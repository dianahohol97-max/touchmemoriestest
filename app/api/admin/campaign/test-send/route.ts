import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/auth/guards';
import { consumeRunToken } from '@/lib/automation/run-token';
import { sendBrevoEmail } from '@/lib/email/brevo';
import { buildLaunchEmail, launchEmailSubject } from '@/lib/email/campaign-launch';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

/**
 * GET /api/admin/campaign/test-send — one copy of the launch letter, to Diana.
 *
 * She asked to see the real thing before the campaign starts («відправ мені
 * одного листа, я хочу глянути як він буде виглядати»), and a screenshot of the
 * HTML is not the same test: what matters is how Gmail renders it on a phone,
 * whether the button survives, and whether the fine print stays readable.
 *
 * Deliberately the SAME builder the campaign will use, so approving this letter
 * approves what customers receive. The only difference is the recipient.
 *
 * `?to=` overrides the address, `?code=` the promo code, `?name=` the greeting.
 * Admin session required — this spends the daily marketing quota.
 */

const DEFAULT_TO = 'gogolka16@gmail.com';

export async function GET(req: NextRequest) {
    // Either an admin session OR a one-time token. The session path failed in
    // practice: Diana opened the link and nothing arrived, because the admin
    // cookie lives on the domain she is logged into and an API URL pasted into
    // a fresh tab carries no session — the route refused before sending, which
    // is invisible from the outside. The token needs no login and dies on first
    // use (Diana, 2026-08-19: «я не отримала листа»).
    const viaToken = await consumeRunToken(req, 'campaign_test_send_token');
    if (!viaToken) {
        const guard = await requireAdmin();
        if (!guard.ok) return guard.response;
    }

    const url = new URL(req.url);
    const to = (url.searchParams.get('to') || DEFAULT_TO).trim();
    const name = url.searchParams.get('name');

    // Default to whichever campaign code is live right now, so the test letter
    // carries a code that actually works when she taps it.
    let code = (url.searchParams.get('code') || '').trim().toUpperCase();
    if (!code) {
        const { data: live } = await getAdminClient()
            .from('promo_codes')
            .select('code')
            .like('code', 'SITE%')
            .eq('is_active', true)
            .gt('valid_until', new Date().toISOString())
            .order('valid_from', { ascending: false })
            .limit(1)
            .maybeSingle();
        code = live?.code || 'SITE1908';
    }

    const html = buildLaunchEmail({ name, code });

    try {
        await sendBrevoEmail({
            to,
            subject: launchEmailSubject(),
            html,
            kind: 'marketing',
            // The real campaign passes each recipient's own token; a test send
            // still carries the footer so she sees exactly what customers see.
            unsubscribe: { email: to },
        });
    } catch (e: any) {
        return NextResponse.json({ ok: false, error: e?.message || 'send failed' }, { status: 500 });
    }

    return NextResponse.json({ ok: true, to, code, subject: launchEmailSubject() });
}
