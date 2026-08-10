import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { getAlertChatId, sendViaPublicBot } from '@/lib/chatbot/telegram-business';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * "Нічого не пропустити" — the client-message watchdog.
 *
 * Sweeps every social conversation (Telegram Business dialogs, the public
 * Telegram bot, Instagram via ManyChat — they all land in
 * social_conversations/social_messages) and alerts Diana in Telegram when:
 *
 *   1. the LAST message in a dialog is from the customer and has been waiting
 *      longer than the threshold (settings `social_unanswered_hours`, default 3), or
 *   2. a conversation sits in `needs_human` — the AI escalated it and nobody
 *      has picked it up yet.
 *
 * Like ops-digest, this is computed from live state, not events: an ignored
 * dialog reappears in every run until someone actually answers, so a missed
 * alert costs nothing. `?preview=1` returns the payload without sending.
 *
 * Auth: Vercel Cron sends `Authorization: Bearer $CRON_SECRET` automatically.
 */

const LOOKBACK_DAYS = 14;
const MAX_LISTED = 10;
const HOUR_MS = 60 * 60 * 1000;

function unauthorized(req: Request) {
    const auth = req.headers.get('authorization');
    return !process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`;
}

function waitingLabel(hours: number): string {
    if (hours < 24) return `${Math.round(hours)} год`;
    const days = Math.floor(hours / 24);
    return `${days} дн ${Math.round(hours - days * 24)} год`;
}

function platformLabel(platform: string): string {
    if (platform === 'telegram') return 'Telegram';
    if (platform === 'instagram') return 'Instagram';
    return platform;
}

export async function GET(req: Request) {
    if (unauthorized(req)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const preview = new URL(req.url).searchParams.get('preview') === '1';

    const supabase = getAdminClient();
    const now = Date.now();
    const lookbackIso = new Date(now - LOOKBACK_DAYS * 24 * HOUR_MS).toISOString();

    const { data: thresholdSetting } = await supabase
        .from('settings').select('value').eq('key', 'social_unanswered_hours').maybeSingle();
    const rawThreshold = parseFloat(String(thresholdSetting?.value ?? ''));
    const thresholdHours = Number.isFinite(rawThreshold) && rawThreshold > 0 ? rawThreshold : 3;

    const { data: conversations, error: convErr } = await supabase
        .from('social_conversations')
        .select('id, platform, external_username, status, last_message_at')
        .gte('last_message_at', lookbackIso);
    if (convErr) {
        return NextResponse.json({ error: convErr.message }, { status: 500 });
    }
    if (!conversations?.length) {
        return NextResponse.json({ ok: true, unanswered: 0, needsHuman: 0 });
    }

    // Latest message per conversation decides "answered or not". One query,
    // newest first; the first row seen per conversation wins.
    const convIds = conversations.map(c => c.id);
    const { data: messages, error: msgErr } = await supabase
        .from('social_messages')
        .select('conversation_id, sender, original_text, sent_at')
        .in('conversation_id', convIds)
        .gte('sent_at', lookbackIso)
        .order('sent_at', { ascending: false });
    if (msgErr) {
        return NextResponse.json({ error: msgErr.message }, { status: 500 });
    }

    const latestByConv = new Map<string, { sender: string; original_text: string | null; sent_at: string }>();
    for (const m of messages || []) {
        if (!latestByConv.has(m.conversation_id)) latestByConv.set(m.conversation_id, m);
    }

    type Item = { name: string; platform: string; hours: number; text: string };
    const unanswered: Item[] = [];
    const needsHuman: Item[] = [];

    for (const conv of conversations) {
        const last = latestByConv.get(conv.id);
        if (!last) continue;
        const hours = (now - new Date(last.sent_at).getTime()) / HOUR_MS;
        const item: Item = {
            name: conv.external_username || 'Без імені',
            platform: platformLabel(conv.platform),
            hours,
            text: (last.original_text || '').slice(0, 120),
        };
        if (conv.status === 'needs_human') {
            needsHuman.push(item);
        } else if (last.sender === 'customer' && hours >= thresholdHours) {
            unanswered.push(item);
        }
    }

    unanswered.sort((a, b) => b.hours - a.hours);
    needsHuman.sort((a, b) => b.hours - a.hours);

    if (!unanswered.length && !needsHuman.length) {
        return NextResponse.json({ ok: true, unanswered: 0, needsHuman: 0, sent: false });
    }

    const lines: string[] = ['🔔 Перевірка переписок з клієнтами'];
    if (needsHuman.length) {
        lines.push('', `❗ Чекають на людину (${needsHuman.length}):`);
        for (const i of needsHuman.slice(0, MAX_LISTED)) {
            lines.push(`• ${i.name} (${i.platform}), ${waitingLabel(i.hours)}: «${i.text}»`);
        }
        if (needsHuman.length > MAX_LISTED) lines.push(`…і ще ${needsHuman.length - MAX_LISTED} діалогів у цьому списку.`);
    }
    if (unanswered.length) {
        lines.push('', `⏳ Без відповіді довше ${thresholdHours} год (${unanswered.length}):`);
        for (const i of unanswered.slice(0, MAX_LISTED)) {
            lines.push(`• ${i.name} (${i.platform}), чекає ${waitingLabel(i.hours)}: «${i.text}»`);
        }
        if (unanswered.length > MAX_LISTED) lines.push(`…і ще ${unanswered.length - MAX_LISTED} діалогів без відповіді.`);
    }
    lines.push('', 'Повний список: https://touchmemories1.vercel.app/admin/social-inbox');
    const text = lines.join('\n');

    if (preview) {
        return NextResponse.json({ ok: true, unanswered: unanswered.length, needsHuman: needsHuman.length, text });
    }

    const alertChatId = await getAlertChatId();
    if (!alertChatId) {
        // No destination configured yet (Business not connected, no override) —
        // report instead of failing so the cron log explains itself.
        return NextResponse.json({ ok: true, unanswered: unanswered.length, needsHuman: needsHuman.length, sent: false, reason: 'no alert chat configured' });
    }

    const sent = await sendViaPublicBot({ chat_id: alertChatId, text });
    return NextResponse.json({ ok: sent.success, unanswered: unanswered.length, needsHuman: needsHuman.length, sent: sent.success, error: sent.error });
}
