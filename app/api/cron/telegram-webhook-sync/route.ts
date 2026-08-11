import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * Self-healing Telegram webhook registration.
 *
 * Why this exists: the bot's webhook must be registered with Telegram once
 * per configuration (URL + allowed_updates + secret), and the manual path —
 * an admin POSTing /api/chatbot/telegram/setup from a logged-in browser
 * console — proved to be the step that never happens (Diana works from her
 * phone). This cron checks getWebhookInfo every run and re-registers only
 * when the stored config differs from the desired one, so:
 *
 *   - a fresh TELEGRAM_PUBLIC_BOT_TOKEN starts working within one cron tick,
 *     no console involved;
 *   - business_* update types can never silently fall out of allowed_updates
 *     (without them Telegram Business monitoring goes dark);
 *   - anyone re-pointing the webhook elsewhere gets corrected automatically.
 *
 * setWebhook is idempotent, and the sync only calls it on drift, so the
 * frequent schedule costs one getWebhookInfo per run.
 *
 * Auth: Vercel Cron sends `Authorization: Bearer $CRON_SECRET` automatically.
 */

const TELEGRAM_API_URL = 'https://api.telegram.org/bot';
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://touchmemories1.vercel.app';

const ALLOWED_UPDATES = [
    'message',
    'business_connection',
    'business_message',
    'edited_business_message',
    'deleted_business_messages',
];

function unauthorized(req: Request) {
    const auth = req.headers.get('authorization');
    return !process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`;
}

export async function GET(req: Request) {
    if (unauthorized(req)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = process.env.TELEGRAM_PUBLIC_BOT_TOKEN;
    if (!token) {
        return NextResponse.json({ ok: false, reason: 'TELEGRAM_PUBLIC_BOT_TOKEN not configured' });
    }

    const desiredUrl = `${SITE_URL}/api/chatbot/telegram`;

    const infoRes = await fetch(`${TELEGRAM_API_URL}${token}/getWebhookInfo`);
    const info = await infoRes.json();
    if (!info.ok) {
        console.error('[telegram-webhook-sync] getWebhookInfo failed:', info.description);
        return NextResponse.json({ ok: false, reason: info.description });
    }

    const current = info.result || {};
    const currentAllowed: string[] = current.allowed_updates || [];
    const missingUpdates = ALLOWED_UPDATES.filter(u => !currentAllowed.includes(u));
    const needsUpdate = current.url !== desiredUrl || missingUpdates.length > 0;

    if (!needsUpdate) {
        return NextResponse.json({
            ok: true,
            changed: false,
            url: current.url,
            pending_update_count: current.pending_update_count ?? 0,
            last_error_message: current.last_error_message || null,
        });
    }

    const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
    const setRes = await fetch(`${TELEGRAM_API_URL}${token}/setWebhook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            url: desiredUrl,
            allowed_updates: ALLOWED_UPDATES,
            ...(secret ? { secret_token: secret } : {}),
        }),
    });
    const set = await setRes.json();
    console.log('[telegram-webhook-sync] re-registered webhook:', JSON.stringify({
        ok: set.ok,
        description: set.description,
        previous_url: current.url || '(none)',
        missing_updates: missingUpdates,
    }));

    return NextResponse.json({ ok: !!set.ok, changed: true, result: set });
}
