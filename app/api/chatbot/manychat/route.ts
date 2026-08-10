import { NextResponse } from 'next/server';
import { processReceivedMessage } from '@/lib/chatbot/core';

/**
 * ManyChat → AI agent bridge for Instagram Direct.
 *
 * ManyChat's External Request step POSTs {user_id, first_name, message} here on
 * every incoming DM and maps the JSON response back to custom fields:
 *   $.reply   → ai_reply   (text the flow sends to the customer)
 *   $.handoff → ai_handoff ("true" when a human must take over — the flow then
 *               notifies admins and tags the conversation)
 *
 * Conversation memory, order lookup, and escalation live in
 * lib/chatbot/core.ts — the same engine the Meta and Telegram webhooks use, so
 * a dialog started via ManyChat keeps its history if we later switch to the
 * direct Meta integration (both write to social_conversations keyed by the
 * Instagram user id).
 *
 * Auth: ManyChat cannot sign requests, so we use a shared token passed either
 * as ?token= or an x-webhook-token header, compared against
 * MANYCHAT_WEBHOOK_TOKEN. Like the Meta route, production refuses to run
 * unauthenticated rather than failing open.
 */
export async function POST(req: Request) {
    const expected = process.env.MANYCHAT_WEBHOOK_TOKEN;
    if (!expected) {
        if (process.env.NODE_ENV === 'production') {
            console.error('MANYCHAT_WEBHOOK_TOKEN not configured — refusing webhook');
            return NextResponse.json({ error: 'Webhook token not configured' }, { status: 503 });
        }
    } else {
        const { searchParams } = new URL(req.url);
        const provided = searchParams.get('token') || req.headers.get('x-webhook-token');
        if (provided !== expected) {
            return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
        }
    }

    let body: any;
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const userId = typeof body?.user_id === 'string' ? body.user_id.trim() : '';
    const message = typeof body?.message === 'string' ? body.message.trim() : '';
    const firstName = typeof body?.first_name === 'string' && body.first_name.trim()
        ? body.first_name.trim()
        : 'Клієнт';

    if (!userId || !message) {
        return NextResponse.json({ error: 'user_id and message are required' }, { status: 400 });
    }

    const result = await processReceivedMessage(
        'instagram',
        userId,
        firstName,
        message,
        `manychat_${userId}_${Date.now()}`
    );

    // action 'none' means a human already owns this conversation — return an
    // empty reply; the ManyChat flow must check "ai_reply has any value" before
    // its Send Message step so the customer gets silence, not an empty bubble.
    if (result.action === 'reply' || result.action === 'error') {
        return NextResponse.json({ reply: result.text ?? '', handoff: result.needsHuman ? 'true' : 'false' });
    }
    return NextResponse.json({ reply: '', handoff: 'false' });
}
