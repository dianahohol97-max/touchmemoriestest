import { NextResponse } from 'next/server';
import { sendWorkChatAlert } from '@/lib/chatbot/telegram-business';
import { computeUnansweredDialogs } from '@/lib/chatbot/unanswered';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Evening sign-off (19:00 UTC = 22:00 Kyiv in summer) — part of the bot's
 * personality Diana asked for: polite, warm, wishes the team sweet dreams.
 * One short message: either "day is clean" or "N dialogs still waiting,
 * look at them first thing tomorrow", always ending with солодких снів.
 *
 * Auth: Vercel Cron sends `Authorization: Bearer $CRON_SECRET` automatically.
 * `?preview=1` returns the payload without sending.
 */

function unauthorized(req: Request) {
    const auth = req.headers.get('authorization');
    return !process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`;
}

export async function GET(req: Request) {
    if (unauthorized(req)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const preview = new URL(req.url).searchParams.get('preview') === '1';

    let waiting = 0;
    try {
        const report = await computeUnansweredDialogs();
        waiting = report.unanswered.length + report.needsHuman.length;
    } catch (e) {
        console.error('evening wrap unanswered error:', e);
    }

    const text = waiting
        ? `🌙 Завершуємо день. На відповідь ще чекають ${waiting} діалогів — зазирніть до них зранку першим ділом.\n\nДякую за сьогодні, команда! Відпочивайте і солодких снів ✨`
        : '🌙 День закрито: всі клієнти отримали відповіді, все під контролем.\n\nДякую за сьогодні, команда! Солодких снів ✨';

    if (preview) {
        return NextResponse.json({ ok: true, waiting, text });
    }

    const sent = await sendWorkChatAlert(text);
    return NextResponse.json({ ok: sent.success, waiting, sent: sent.success, error: sent.error });
}
