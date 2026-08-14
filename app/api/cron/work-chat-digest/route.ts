import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { sendWorkChatAlert } from '@/lib/chatbot/telegram-business';
import { morningGreeting } from '@/lib/chatbot/work-commands';
import { computeUnansweredDialogs } from '@/lib/chatbot/unanswered';
import { fetchProductionFilter } from '@/lib/automation/production-visibility';
import { buildResponsibleLookup } from '@/lib/chatbot/responsible';
import { isTestOrder } from '@/lib/automation/test-orders';
import { computeLowStock, computeDeadlineRisks, computeWaitingForClient } from '@/lib/automation/risk-radar';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Morning work-chat digest (06:00 UTC = 09:00 Kyiv in summer).
 *
 * Diana's format (2026-08-11): deadlines only, warm tone. No order/payment
 * counters — the digest is the "what must not slip today" note, not a
 * finance report:
 *
 *   — time-of-day greeting (early birds / sleepyheads rule),
 *   — ⏰ overdue deadlines,
 *   — 🔥 deadlines within the next N days (settings `digest_upcoming_days`,
 *     default 3),
 *   — one line on client dialogs still waiting,
 *   — a warm sign-off.
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

    const { data: daysSetting } = await supabase
        .from('settings').select('value').eq('key', 'digest_upcoming_days').maybeSingle();
    const rawDays = parseFloat(String(daysSetting?.value ?? ''));
    const upcomingDays = Number.isFinite(rawDays) && rawDays > 0 ? rawDays : 3;

    const nowIso = new Date(now).toISOString();
    const [{ data: overdueRows }, { data: upcomingRows }] = await Promise.all([
        supabase
            .from('orders')
            .select('id, order_number, customer_name, deadline, order_status, source, created_at, custom_attributes, designer_id')
            .lt('deadline', nowIso)
            .in('order_status', ACTIVE_STATUSES)
            .order('deadline', { ascending: true })
            .limit(50),
        supabase
            .from('orders')
            .select('id, order_number, customer_name, deadline, order_status, source, created_at, custom_attributes, designer_id')
            .gte('deadline', nowIso)
            .lt('deadline', new Date(now + upcomingDays * 24 * HOUR_MS).toISOString())
            .in('order_status', ACTIVE_STATUSES)
            .order('deadline', { ascending: true })
            .limit(50),
    ]);

    // Site orders from before the sync existed were carried into KeyCRM by
    // hand and are run there — listing them as overdue doubles every one of
    // them (Diana, 2026-08-13).
    const visible = await fetchProductionFilter();
    const overdue = (overdueRows || []).filter(o => !isTestOrder(o as any) && visible(o));
    const upcoming = (upcomingRows || []).filter(o => !isTestOrder(o as any) && visible(o));

    // Every line names who is on it (Diana, 2026-08-14): a late order without
    // a name says something slipped but not whom to ask.
    const responsible = await buildResponsibleLookup([...overdue, ...upcoming]);

    const lines: string[] = [morningGreeting(), ''];

    if (overdue.length) {
        lines.push(`⏰ Прострочені дедлайни (${overdue.length}):`);
        for (const o of overdue.slice(0, MAX_LISTED)) {
            const daysOver = Math.max(1, Math.floor((now - new Date(o.deadline).getTime()) / (24 * HOUR_MS)));
            const who = responsible(o);
            lines.push(`• ${o.order_number} — ${o.customer_name || 'без імені'}, мав бути ${fmtDate(o.deadline)} (уже ${daysOver} дн)${who ? ` — ${who}` : ''}`);
        }
        if (overdue.length > MAX_LISTED) lines.push(`…і ще ${overdue.length - MAX_LISTED} у списку.`);
        lines.push('');
    } else {
        lines.push('Прострочених дедлайнів немає — так тримати! 💛', '');
    }

    if (upcoming.length) {
        lines.push(`🔥 Дедлайн у найближчі ${upcomingDays} дні (${upcoming.length}):`);
        for (const o of upcoming.slice(0, MAX_LISTED)) {
            const who = responsible(o);
            lines.push(`• ${o.order_number} — ${o.customer_name || 'без імені'}, до ${fmtDate(o.deadline)}${who ? ` — ${who}` : ''}`);
        }
        if (upcoming.length > MAX_LISTED) lines.push(`…і ще ${upcoming.length - MAX_LISTED} у цьому вікні.`);
        lines.push('');
    }

    // Risks — the things that are not broken yet (Diana's picks, 2026-08-11).
    // Each block is independent and swallowed on failure: a digest that dies
    // on one query is worse than a digest missing one section.
    try {
        const risks = await computeDeadlineRisks();
        if (risks.length) {
            lines.push(`⚠️ Під загрозою зриву (${risks.length}):`);
            for (const r of risks.slice(0, MAX_LISTED)) {
                lines.push(`• ${r.orderNumber} — ${r.customer}, ${r.reason} (стадія: ${r.stage})${r.responsible ? ` — ${r.responsible}` : ''}`);
            }
            lines.push('');
        }
    } catch (e) { console.error('digest deadline risks failed:', e); }

    try {
        const waiting = await computeWaitingForClient();
        if (waiting.length) {
            lines.push(`📥 Чекаємо матеріали від клієнта (${waiting.length}):`);
            for (const w of waiting.slice(0, MAX_LISTED)) {
                lines.push(`• ${w.orderNumber} — ${w.customer}, оплачено ${w.paidDaysAgo} дн тому, фото ще немає`);
            }
            lines.push('');
        }
    } catch (e) { console.error('digest waiting-for-client failed:', e); }

    try {
        const { items, threshold } = await computeLowStock();
        if (items.length) {
            lines.push(`📦 Закінчуються матеріали (менше ${threshold} шт):`);
            for (const i of items.slice(0, MAX_LISTED)) {
                const work = i.inWork ? `, у роботі ${i.inWork} замовл.` : '';
                lines.push(`• ${i.name}${i.variant ? ` ${i.variant}` : ''} — ${i.stock} шт${work}`);
            }
            // A negative quantity is a bookkeeping error, not a shortage: the
            // CRM sold more than it ever received (Diana, 2026-08-13: «якщо
            // десь стоїть мінус, треба пінгувати Аліну, щоб вона подивилась»).
            if (items.some(i => i.stock < 0)) {
                lines.push('@Alina_Avlastsova — там мінусові залишки, глянь, будь ласка, чи все правильно оприбутковано.');
            }
            lines.push('');
        }
    } catch (e) { console.error('digest low stock failed:', e); }

    try {
        const report = await computeUnansweredDialogs();
        const waiting = report.unanswered.length + report.needsHuman.length;
        lines.push(waiting
            ? `💬 На відповідь чекають ${waiting} діалогів — деталі за командою /unanswered.`
            : '💬 Усі переписки з клієнтами закриті — жодне повідомлення не висить.');
    } catch (e) {
        console.error('digest unanswered error:', e);
    }

    lines.push('', 'Гарного і продуктивного дня, команда! ✨');
    const text = lines.join('\n');

    if (preview) {
        return NextResponse.json({ ok: true, overdue: overdue.length, upcoming: upcoming.length, text });
    }

    const sent = await sendWorkChatAlert(text);
    return NextResponse.json({ ok: sent.success, overdue: overdue.length, upcoming: upcoming.length, sent: sent.success, error: sent.error });
}
