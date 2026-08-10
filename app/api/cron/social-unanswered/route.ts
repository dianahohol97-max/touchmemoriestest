import { NextResponse } from 'next/server';
import { getWatchdogChatId, sendViaPublicBot } from '@/lib/chatbot/telegram-business';
import { computeUnansweredDialogs, waitingLabel } from '@/lib/chatbot/unanswered';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * "Нічого не пропустити" — the client-message watchdog.
 *
 * Sweeps every social conversation (Telegram Business dialogs, the public
 * Telegram bot, Instagram via ManyChat — they all land in
 * social_conversations/social_messages) and alerts in Telegram when a dialog's
 * last message is an unanswered customer message older than the threshold, or
 * when a conversation sits in `needs_human` (the AI escalated it and nobody
 * picked it up). The actual computation is shared with the /unanswered team
 * command — see lib/chatbot/unanswered.ts.
 *
 * Destination: the chat claimed via /alerts_here, else Diana's private chat
 * with the bot. Like ops-digest, this is live-state, not events: an ignored
 * dialog reappears in every run until someone actually answers, so a missed
 * alert costs nothing. `?preview=1` returns the payload without sending.
 *
 * Auth: Vercel Cron sends `Authorization: Bearer $CRON_SECRET` automatically.
 */

const MAX_LISTED = 10;

function unauthorized(req: Request) {
    const auth = req.headers.get('authorization');
    return !process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`;
}

export async function GET(req: Request) {
    if (unauthorized(req)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const preview = new URL(req.url).searchParams.get('preview') === '1';

    let report;
    try {
        report = await computeUnansweredDialogs();
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
    const { unanswered, needsHuman, thresholdHours } = report;

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

    const alertChatId = await getWatchdogChatId();
    if (!alertChatId) {
        // No destination configured yet (Business not connected, no /alerts_here) —
        // report instead of failing so the cron log explains itself.
        return NextResponse.json({ ok: true, unanswered: unanswered.length, needsHuman: needsHuman.length, sent: false, reason: 'no alert chat configured' });
    }

    const sent = await sendViaPublicBot({ chat_id: alertChatId, text });
    return NextResponse.json({ ok: sent.success, unanswered: unanswered.length, needsHuman: needsHuman.length, sent: sent.success, error: sent.error });
}
