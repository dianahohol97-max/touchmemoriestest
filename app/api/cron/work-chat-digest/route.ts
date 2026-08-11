import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { sendWorkChatAlert } from '@/lib/chatbot/telegram-business';
import { buildStatus } from '@/lib/chatbot/work-commands';
import { isTestOrder } from '@/lib/automation/test-orders';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Morning work-chat digest — the same summary /status prints on demand,
 * pushed to the team every morning (06:00 UTC = 09:00 Kyiv in summer), plus
 * a "deadlines in the next two days" section so the day starts with the
 * work that must not slip. Deliberately quiet design: if no alert chat is
 * configured (no Business connection, no /alerts_here yet), the run reports
 * that instead of failing.
 *
 * Auth: Vercel Cron sends `Authorization: Bearer $CRON_SECRET` automatically.
 * `?preview=1` returns the payload without sending.
 */

const HOUR_MS = 60 * 60 * 1000;
const MAX_LISTED = 10;
const ACTIVE_STATUSES = ['new', 'confirmed'];

function unauthorized(req: Request) {
    const auth = req.headers.get('authorization');
    return !process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`;
}

function fmtDate(iso: string | null): string {
    if (!iso) return '—';
    const d = new Date(iso);
    if (!Number.isFinite(d.getTime())) return '—';
    return d.toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit', timeZone: 'Europe/Kyiv' });
}

export async function GET(req: Request) {
    if (unauthorized(req)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const preview = new URL(req.url).searchParams.get('preview') === '1';

    const supabase = getAdminClient();
    const now = Date.now();

    const lines: string[] = ['☀️ Ранкове зведення', ''];
    lines.push(await buildStatus());

    // Deadlines inside the next two days: still on time, but only just — the
    // list the team should clear first today.
    const { data: upcoming } = await supabase
        .from('orders')
        .select('id, order_number, customer_name, deadline, order_status')
        .gte('deadline', new Date(now).toISOString())
        .lt('deadline', new Date(now + 2 * 24 * HOUR_MS).toISOString())
        .in('order_status', ACTIVE_STATUSES)
        .order('deadline', { ascending: true })
        .limit(50);

    const soon = (upcoming || []).filter(o => !isTestOrder(o as any));
    if (soon.length) {
        lines.push('', `🔥 Дедлайн у найближчі 2 дні (${soon.length}):`);
        for (const o of soon.slice(0, MAX_LISTED)) {
            lines.push(`• ${o.order_number} — ${o.customer_name || 'без імені'}, дедлайн ${fmtDate(o.deadline)}`);
        }
        if (soon.length > MAX_LISTED) lines.push(`…і ще ${soon.length - MAX_LISTED} замовлень у цьому вікні.`);
    }

    const text = lines.join('\n');

    if (preview) {
        return NextResponse.json({ ok: true, upcoming: soon.length, text });
    }

    const sent = await sendWorkChatAlert(text);
    return NextResponse.json({ ok: sent.success, upcoming: soon.length, sent: sent.success, error: sent.error });
}
