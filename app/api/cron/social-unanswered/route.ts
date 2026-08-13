import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { getWatchdogChatId, sendViaPublicBot } from '@/lib/chatbot/telegram-business';
import { computeUnansweredDialogs, waitingLabel, type WaitingDialog } from '@/lib/chatbot/unanswered';

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
    const { thresholdHours } = report;

    // Re-alert throttle: the cron runs every 30 minutes so NEW problems
    // surface fast, but a dialog already alerted repeats only every
    // `social_watchdog_realert_hours` (default 3) — a half-hourly copy of the
    // same list is how alerts get muted by humans.
    const supabase = getAdminClient();
    const { data: realertSetting } = await supabase
        .from('settings').select('value').eq('key', 'social_watchdog_realert_hours').maybeSingle();
    const rawRealert = parseFloat(String(realertSetting?.value ?? ''));
    const realertHours = Number.isFinite(rawRealert) && rawRealert > 0 ? rawRealert : 3;

    const { data: alertedRow } = await supabase
        .from('settings').select('value').eq('key', 'social_watchdog_alerted').maybeSingle();
    const alerted: Record<string, string> = (alertedRow?.value && typeof alertedRow.value === 'object') ? alertedRow.value : {};
    const nowMs = Date.now();
    const isDue = (d: WaitingDialog) => {
        const prev = alerted[d.id] ? new Date(alerted[d.id]).getTime() : 0;
        return nowMs - prev >= realertHours * 60 * 60 * 1000;
    };

    const unanswered = report.unanswered.filter(isDue);
    const needsHuman = report.needsHuman.filter(isDue);

    if (!unanswered.length && !needsHuman.length) {
        return NextResponse.json({
            ok: true,
            unanswered: 0,
            needsHuman: 0,
            sent: false,
            throttled: report.unanswered.length + report.needsHuman.length,
        });
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

    if (sent.success) {
        // Remember what we alerted about (and prune entries older than 7 days
        // so the map cannot grow forever).
        const nowIso = new Date(nowMs).toISOString();
        const weekAgo = nowMs - 7 * 24 * 60 * 60 * 1000;
        const next: Record<string, string> = {};
        for (const [id, ts] of Object.entries(alerted)) {
            if (new Date(ts).getTime() > weekAgo) next[id] = ts;
        }
        for (const d of [...unanswered, ...needsHuman]) next[d.id] = nowIso;
        await supabase.from('settings').upsert({ key: 'social_watchdog_alerted', value: next, updated_at: nowIso });
    }

    return NextResponse.json({ ok: sent.success, unanswered: unanswered.length, needsHuman: needsHuman.length, sent: sent.success, error: sent.error });
}
