import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/guards';

/**
 * One-shot webhook (re)registration for the public Telegram bot.
 *
 * Why this exists: Telegram only delivers the update types listed in
 * allowed_updates at setWebhook time. The original registration asked for
 * plain messages, so `business_connection` / `business_message` updates
 * (Telegram Business — Diana's personal client dialogs) would silently never
 * arrive. POST here after deploy re-registers the webhook with the full list.
 *
 * GET returns getWebhookInfo so the current registration can be inspected.
 * Both are admin-only.
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

export async function GET() {
    const guard = await requireAdmin();
    if (!guard.ok) return guard.response;

    const token = process.env.TELEGRAM_PUBLIC_BOT_TOKEN;
    if (!token) return NextResponse.json({ error: 'TELEGRAM_PUBLIC_BOT_TOKEN not configured' }, { status: 500 });

    const res = await fetch(`${TELEGRAM_API_URL}${token}/getWebhookInfo`);
    const info = await res.json();
    return NextResponse.json(info);
}

export async function POST() {
    const guard = await requireAdmin();
    if (!guard.ok) return guard.response;

    const token = process.env.TELEGRAM_PUBLIC_BOT_TOKEN;
    if (!token) return NextResponse.json({ error: 'TELEGRAM_PUBLIC_BOT_TOKEN not configured' }, { status: 500 });

    const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
    const res = await fetch(`${TELEGRAM_API_URL}${token}/setWebhook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            url: `${SITE_URL}/api/chatbot/telegram`,
            allowed_updates: ALLOWED_UPDATES,
            ...(secret ? { secret_token: secret } : {}),
        }),
    });
    const result = await res.json();

    const infoRes = await fetch(`${TELEGRAM_API_URL}${token}/getWebhookInfo`);
    const info = await infoRes.json();

    return NextResponse.json({ setWebhook: result, webhookInfo: info });
}
