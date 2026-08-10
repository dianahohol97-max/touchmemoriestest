import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { sendEmail } from '@/lib/email/resend';
import { calculateProductionDeadline } from '@/lib/automation/deadline-calculator';
import { fetchRecentKeycrmOrders, phoneKey, type KeycrmOrder } from '@/lib/automation/keycrm';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Operations digest — the "what is stuck right now" report, by email.
 *
 * Why this exists: orders live in two systems. The website writes them to
 * Supabase and the admin panel shows them there, then a manager re-types each
 * one into KeyCRM by hand. Neither system can see the other, so keeping the
 * queue honest meant opening both and comparing them by eye, every day, for
 * every order. That is the work this replaces.
 *
 * Two deliberate design choices:
 *
 *  1. The digest is computed from live state, not from an event log. An item
 *     keeps reappearing in every run until it is actually resolved, so a missed
 *     email costs nothing — the next one repeats it. Each line carries how long
 *     the order has been waiting, so a repeat still reads as new information.
 *
 *  2. Long buckets are reported as a count with only the worst few spelled out.
 *     A report that lists forty unpaid orders is a report nobody opens.
 *
 * KeyCRM is pulled read-only and best-effort. If the CRM is unreachable or the
 * token is missing, the digest still goes out with the website sections and a
 * line saying the CRM part is missing — a monitoring job must not go silent
 * precisely when something is broken.
 *
 * Auth: Vercel Cron sends `Authorization: Bearer $CRON_SECRET` automatically.
 * Add `?preview=1` to get the payload back as JSON without sending any mail —
 * that is the safe way to check the wording and the matching before it goes out.
 */

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://touchmemories1.vercel.app';

// Orders older than this are history, not a work queue: dragging them into the
// digest would bury today's real problems under last quarter's leftovers.
const LOOKBACK_DAYS = 60;

// Buckets that ask someone to DO something are limited to this window. The
// older backlog is real, but a twice-daily email cannot fix three months of it
// and listing it every time is how a report becomes wallpaper. The footer says
// out loud that the window exists, so nobody reads the digest as "all clear".
const ACTION_WINDOW_DAYS = 21;

// Deadlines are only back-filled for recently paid orders. Computing one for an
// order paid two months ago produces a deadline that is instantly overdue and
// floods the first digest with alarms nobody can act on.
const DEADLINE_BACKFILL_DAYS = 14;

// A website order needs a little time to reach the CRM by hand before its
// absence counts as forgotten rather than simply fresh.
const CRM_TRANSFER_GRACE_HOURS = 12;

// A CRM order nobody touched for this long is either finished and left in the
// wrong stage, or genuinely abandoned. Both are worth a look.
const CRM_STALE_DAYS = 5;

const MAX_ITEMS_PER_BUCKET = 5;

const HOUR_MS = 60 * 60 * 1000;

type OrderRow = {
    id: string;
    order_number: string;
    customer_name: string | null;
    customer_email: string | null;
    customer_phone: string | null;
    payment_status: string | null;
    order_status: string | null;
    with_designer: boolean | null;
    designer_id: string | null;
    ttn: string | null;
    deadline: string | null;
    paid_at: string | null;
    created_at: string;
    custom_attributes: any;
    notes: string | null;
    total: number | null;
};

type Item = {
    label: string;
    sublabel: string;
    href?: string;
    waitingHours: number;
};

type Bucket = {
    title: string;
    items: Item[];
    /** Count-only buckets are summarised in one line instead of listing rows. */
    countOnly?: boolean;
    hint?: string;
};

function unauthorized(req: Request) {
    const auth = req.headers.get('authorization');
    return !process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`;
}

function escapeHtml(value: string): string {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function hoursSince(iso: string | null, now: Date): number {
    if (!iso) return 0;
    const ms = new Date(iso).getTime();
    if (!Number.isFinite(ms)) return 0;
    return Math.max(0, Math.round((now.getTime() - ms) / HOUR_MS));
}

/** Ukrainian plural forms for "година" — a report that says "5 година" reads as broken. */
function hoursWord(hours: number): string {
    const mod100 = hours % 100;
    const mod10 = hours % 10;
    if (mod100 >= 11 && mod100 <= 14) return 'годин';
    if (mod10 === 1) return 'година';
    if (mod10 >= 2 && mod10 <= 4) return 'години';
    return 'годин';
}

function waitingLabel(hours: number): string {
    if (hours < 48) return `${hours} ${hoursWord(hours)}`;
    return `${Math.round(hours / 24)} дн.`;
}

function isPaid(order: OrderRow): boolean {
    return order.payment_status === 'paid';
}

function isClosed(order: OrderRow): boolean {
    return ['cancelled', 'delivered', 'refunded'].includes(order.order_status || '');
}

function isShipped(order: OrderRow): boolean {
    return ['shipped', 'delivered'].includes(order.order_status || '');
}

function siteItem(order: OrderRow, now: Date, sublabelExtra?: string): Item {
    const waitingHours = hoursSince(order.paid_at || order.created_at, now);
    const name = (order.customer_name || '').trim() || 'без імені';
    const parts = [name, `чекає ${waitingLabel(waitingHours)}`];
    if (sublabelExtra) parts.push(sublabelExtra);

    return {
        label: `#${order.order_number || order.id.slice(0, 8)}`,
        sublabel: parts.join(', '),
        href: `${SITE_URL}/admin/orders/${order.id}`,
        waitingHours,
    };
}

/**
 * Fill `deadline` for orders that were paid while the automation wire was
 * missing. Everything downstream — the overdue bucket here, the designer
 * reminders in lib/automation/telegram-notifications.ts — filters on this
 * column, so an order without it is invisible to every alert we have.
 */
async function backfillDeadlines(supabase: any, orders: OrderRow[], now: Date): Promise<number> {
    const cutoff = now.getTime() - DEADLINE_BACKFILL_DAYS * 24 * HOUR_MS;

    const candidates = orders.filter(o =>
        isPaid(o) &&
        !o.deadline &&
        !isClosed(o) &&
        o.paid_at &&
        new Date(o.paid_at).getTime() >= cutoff
    );

    if (!candidates.length) return 0;

    const activeCount = orders.filter(o =>
        ['confirmed', 'in_production', 'quality_check'].includes(o.order_status || '')
    ).length;

    let filled = 0;
    for (const order of candidates) {
        const attrs = order.custom_attributes || {};
        const deadline = calculateProductionDeadline({
            paid_at: new Date(order.paid_at!),
            page_count: attrs.page_count || 0,
            has_express_tag: Array.isArray(attrs.tags)
                ? attrs.tags.some((t: string) => String(t).includes('швидше'))
                : false,
            active_orders_count: activeCount,
        });

        const { error } = await supabase
            .from('orders')
            .update({ deadline: deadline.toISOString() })
            .eq('id', order.id);

        if (error) {
            console.error(`[ops-digest] deadline backfill failed for ${order.order_number}:`, error.message);
            continue;
        }

        // Keep the in-memory copy in sync so this run's digest already reflects
        // the new deadline instead of reporting it again tomorrow.
        order.deadline = deadline.toISOString();
        filled++;
    }

    return filled;
}

/**
 * Fuzzy fallback for orders carried over by hand, before the sync existed.
 *
 * There is no shared key for those, so four signals are tried, strongest first:
 * the order number pasted into the CRM's external reference or into either
 * comment field, then the buyer's email, then the buyer's phone. Email and
 * phone are matched only within a date window, otherwise every repeat customer
 * would mask a genuinely forgotten order.
 *
 * This is deliberately NOT used for orders the sync itself handles — see
 * isCarriedOver for why guessing became dangerous once the CRM started holding
 * orders that never existed on the site.
 */
function findCrmMatch(order: OrderRow, crmOrders: KeycrmOrder[]): KeycrmOrder | null {
    const number = (order.order_number || '').trim().toLowerCase();
    const email = (order.customer_email || '').trim().toLowerCase();
    const phone = phoneKey(order.customer_phone || '');
    const createdMs = new Date(order.created_at).getTime();

    const numberMatch = number && crmOrders.find(c =>
        c.source_uuid.toLowerCase().includes(number) ||
        c.manager_comment.toLowerCase().includes(number) ||
        c.buyer_comment.toLowerCase().includes(number)
    );
    if (numberMatch) return numberMatch;

    // ±7 days: a manager who transfers orders in a weekly batch still counts as
    // having transferred them.
    const withinWindow = (c: KeycrmOrder) => {
        const crmMs = new Date(c.created_at).getTime();
        if (!Number.isFinite(crmMs) || !Number.isFinite(createdMs)) return true;
        return Math.abs(crmMs - createdMs) <= 7 * 24 * HOUR_MS;
    };

    if (email) {
        const byEmail = crmOrders.find(c => c.buyer_email === email && withinWindow(c));
        if (byEmail) return byEmail;
    }

    if (phone) {
        const byPhone = crmOrders.find(c => phoneKey(c.buyer_phone) === phone && withinWindow(c));
        if (byPhone) return byPhone;
    }

    return null;
}

// The marker /api/cron/missing-print-files prepends to an order's notes when it
// finds a printable product with no uploaded files.
const MISSING_FILES_MARKER = 'файли для друку не завантажились';

/**
 * Is this website order already in the CRM?
 *
 * The two systems are now separate sources of orders, not one feeding the
 * other: the site takes its own orders, and managers enter Instagram orders
 * straight into KeyCRM, where those are also paid and fiscalised. So the CRM is
 * full of orders that never existed on the site and never should.
 *
 * That broke the old answer. Matching a site order to "some CRM order from the
 * same customer within a week" used to be a reasonable guess; now a repeat
 * buyer who also ordered through Instagram silently vouches for a site order
 * nobody ever transferred — the one case this report exists to catch.
 *
 * The reliable signal is the CRM id the sync writes back onto every order it
 * creates. The fuzzy match survives only for orders older than the sync, which
 * were carried over by hand and genuinely have nothing else to match on.
 */
function isCarriedOver(order: OrderRow, crmOrders: KeycrmOrder[]): boolean {
    if ((order.custom_attributes as any)?.keycrm?.order_id) return true;

    const syncFrom = String(process.env.KEYCRM_SYNC_FROM || '').trim();
    const cutoff = syncFrom ? new Date(syncFrom).getTime() : NaN;
    const created = new Date(order.created_at).getTime();

    const predatesSync = !Number.isFinite(cutoff) || created < cutoff;
    if (!predatesSync) return false;

    return Boolean(findCrmMatch(order, crmOrders));
}

function buildBuckets(
    orders: OrderRow[],
    crm: { ok: boolean; orders: KeycrmOrder[] },
    ordersWithFiles: Set<string>,
    now: Date,
): Bucket[] {
    const nowMs = now.getTime();
    const open = orders.filter(o => !isClosed(o));

    // Anything that asks for action is scoped to the recent window; see
    // ACTION_WINDOW_DAYS for why.
    const recent = open.filter(o =>
        hoursSince(o.paid_at || o.created_at, now) <= ACTION_WINDOW_DAYS * 24
    );

    const overdue = recent.filter(o =>
        isPaid(o) && o.deadline && new Date(o.deadline).getTime() < nowMs && !isShipped(o)
    );

    const dueSoon = recent.filter(o => {
        if (!isPaid(o) || !o.deadline || isShipped(o)) return false;
        const dl = new Date(o.deadline).getTime();
        return dl >= nowMs && dl - nowMs <= 24 * HOUR_MS;
    });

    const noDesigner = recent.filter(o => isPaid(o) && o.with_designer && !o.designer_id);

    // Files are checked against order_files, not orders.print_file_url: the
    // column exists but nothing writes to it, so a rule built on it fires for
    // every order ever placed. Twenty-four hours of grace covers the normal
    // case where checkout links the files a moment after payment.
    const noFiles = recent.filter(o =>
        isPaid(o) && !ordersWithFiles.has(o.id) && hoursSince(o.paid_at, now) >= 24
    );

    // Surfaces the flag that /api/cron/missing-print-files already writes into
    // the order notes. It was only visible to whoever opened that exact order.
    const flaggedFiles = recent.filter(o =>
        (o.notes || '').toLowerCase().includes(MISSING_FILES_MARKER)
    );

    // Deliberately absent: a "no TTN" rule on orders.ttn. Waybills are created
    // in KeyCRM and the Nova Poshta cabinet, so the site column is empty for
    // every order and the rule would fire on all of them. The shipping signal
    // lives in the KeyCRM section below, where shipping actually happens.

    const unpaidStale = recent.filter(o => !isPaid(o) && hoursSince(o.created_at, now) >= 48);

    const noEmail = recent.filter(o => isPaid(o) && !o.customer_email?.trim());

    const buckets: Bucket[] = [
        { title: 'Дедлайн прострочено', items: overdue.map(o => siteItem(o, now)) },
        { title: 'Дедлайн менш ніж за добу', items: dueSoon.map(o => siteItem(o, now)) },
        { title: 'Оплачено, але дизайнера не призначено', items: noDesigner.map(o => siteItem(o, now)) },
        { title: 'Оплачено, але жодного файлу не прикріплено', items: noFiles.map(o => siteItem(o, now)) },
        { title: 'Позначені попередженням про відсутні файли', items: flaggedFiles.map(o => siteItem(o, now)) },
    ];

    // Cross-system check. Skipped entirely when the CRM pull failed, because an
    // empty CRM list would report every single order as "not transferred".
    if (crm.ok) {
        const notInCrm = recent.filter(o =>
            isPaid(o) &&
            hoursSince(o.paid_at || o.created_at, now) >= CRM_TRANSFER_GRACE_HOURS &&
            !isCarriedOver(o, crm.orders)
        );

        buckets.push({
            title: 'Є на сайті, але не знайдено в KeyCRM',
            items: notInCrm.map(o => siteItem(o, now, 'перенести в CRM')),
        });

        const staleCutoff = nowMs - CRM_STALE_DAYS * 24 * HOUR_MS;
        const stalledInCrm = crm.orders.filter(c => {
            const touched = new Date(c.updated_at).getTime();
            return Number.isFinite(touched) && touched < staleCutoff && !c.ttn;
        });

        // Covers Instagram orders too, and that is the point: they live only in
        // the CRM, so this bucket is the single place they are watched at all.
        buckets.push({
            title: `У KeyCRM без руху понад ${CRM_STALE_DAYS} днів і без ТТН`,
            items: stalledInCrm.map(c => ({
                label: `CRM #${c.id}`,
                sublabel: `${c.buyer_name || 'без імені'}, ${c.status_label}, без змін ${waitingLabel(hoursSince(c.updated_at, now))}`,
                waitingHours: hoursSince(c.updated_at, now),
            })),
        });
    }

    buckets.push(
        {
            title: 'Не оплачені довше двох діб',
            items: unpaidStale.map(o => siteItem(o, now)),
            countOnly: true,
            hint: 'Листи-нагадування пішли автоматично, тож руками варто чіпати лише великі суми.',
        },
        {
            title: 'Оплачені замовлення без email',
            items: noEmail.map(o => siteItem(o, now)),
            countOnly: true,
            hint: 'Цим клієнтам не піде ані трекінг, ані запит на відгук.',
        },
    );

    return buckets.filter(b => b.items.length > 0);
}

function renderEmail(buckets: Bucket[], now: Date, backfilled: number, crmWarning?: string): string {
    const date = now.toLocaleDateString('uk-UA', { day: '2-digit', month: 'long', timeZone: 'Europe/Kyiv' });
    const time = now.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Kyiv' });
    const total = buckets.reduce((sum, b) => sum + b.items.length, 0);

    const sections = buckets.map(bucket => {
        const count = bucket.items.length;
        const heading = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin:0 0 10px;">
        <span style="font-size:14px;font-weight:800;color:#0f172a;">${escapeHtml(bucket.title)}</span>
        <span style="font-size:13px;font-weight:800;color:#263a99;">${count}</span>
      </div>`;

        if (bucket.countOnly) {
            const hint = bucket.hint
                ? `<div style="font-size:13px;color:#64748b;line-height:1.6;">${escapeHtml(bucket.hint)}</div>`
                : '';
            return `<div style="background:#f8fafc;border:1.5px solid #e2e8f0;border-radius:12px;padding:16px 20px;margin:0 0 16px;">${heading}${hint}</div>`;
        }

        const shown = bucket.items
            .slice()
            .sort((a, b) => b.waitingHours - a.waitingHours)
            .slice(0, MAX_ITEMS_PER_BUCKET);

        const rows = shown.map(item => {
            const label = item.href
                ? `<a href="${escapeHtml(item.href)}" style="color:#263a99;text-decoration:none;font-weight:800;">${escapeHtml(item.label)}</a>`
                : `<span style="font-weight:800;color:#0f172a;">${escapeHtml(item.label)}</span>`;
            return `
        <div style="padding:8px 0;border-top:1px solid #eef2f7;">
          ${label}
          <span style="color:#64748b;font-size:13px;"> — ${escapeHtml(item.sublabel)}</span>
        </div>`;
        }).join('');

        const rest = count - shown.length;
        const tail = rest > 0
            ? `<div style="padding-top:10px;font-size:12px;color:#94a3b8;">Ще ${rest} у цьому списку, повний перелік відкривається в адмінці.</div>`
            : '';

        return `<div style="background:#ffffff;border:1.5px solid #e2e8f0;border-radius:12px;padding:16px 20px;margin:0 0 16px;">${heading}${rows}${tail}</div>`;
    }).join('');

    const notes = [
        backfilled > 0 ? `Дедлайни проставлені автоматично для ${backfilled} замовлень, які їх не мали.` : '',
        crmWarning || '',
    ].filter(Boolean).map(n => `<div style="font-size:12px;color:#94a3b8;margin-top:6px;">${escapeHtml(n)}</div>`).join('');

    return `<!DOCTYPE html>
<html lang="uk">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Що потребує уваги</title></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:640px;margin:24px auto;background:white;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
    <div style="background:linear-gradient(135deg,#1e2d7d,#263a99);padding:24px 32px;">
      <div style="color:white;font-size:19px;font-weight:900;">Що потребує уваги</div>
      <div style="color:rgba(255,255,255,0.75);font-size:13px;margin-top:4px;">${escapeHtml(date)}, ${escapeHtml(time)} — у списку ${total} ${total === 1 ? 'позиція' : 'позицій'}</div>
    </div>
    <div style="padding:24px 32px;">
      ${sections}
      <div style="text-align:center;margin-top:22px;">
        <a href="${SITE_URL}/admin/orders" style="display:inline-block;padding:13px 30px;background:#263a99;color:white;text-decoration:none;border-radius:10px;font-weight:800;font-size:14px;">Відкрити замовлення</a>
      </div>
      ${notes}
    </div>
    <div style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:16px 32px;text-align:center;">
      <p style="color:#94a3b8;font-size:12px;margin:0 0 6px;">Автоматичний звіт по замовленнях сайту та KeyCRM. Кожна позиція повторюється в наступному листі, поки її не закрито.</p>
      <p style="color:#cbd5e1;font-size:11px;margin:0;">У списки потрапляють замовлення за останній ${ACTION_WINDOW_DAYS} день, старіші замовлення сюди свідомо не потрапляють.</p>
    </div>
  </div>
</body>
</html>`;
}

function recipients(): string[] {
    return String(process.env.OPS_DIGEST_EMAIL || '')
        .split(',')
        .map(s => s.trim())
        .filter(Boolean);
}

async function deliver(subject: string, html: string): Promise<{ sent: number; errors: string[] }> {
    const to = recipients();
    if (!to.length) return { sent: 0, errors: ['OPS_DIGEST_EMAIL not configured'] };

    let sent = 0;
    const errors: string[] = [];

    for (const address of to) {
        const result = await sendEmail({ to: address, subject, html });
        if (result?.success) {
            sent++;
        } else {
            const reason = (result?.error as any)?.message || String(result?.error || 'unknown error');
            errors.push(`${address}: ${reason}`);
        }
    }

    return { sent, errors };
}

export async function GET(request: Request) {
    if (unauthorized(request)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const url = new URL(request.url);
    const preview = url.searchParams.get('preview') === '1';

    const supabase = getAdminClient();
    const now = new Date();
    const since = new Date(now.getTime() - LOOKBACK_DAYS * 24 * HOUR_MS).toISOString();

    try {
        const { data, error } = await supabase
            .from('orders')
            .select('id, order_number, customer_name, customer_email, customer_phone, payment_status, order_status, with_designer, designer_id, ttn, deadline, paid_at, created_at, custom_attributes, notes, total')
            .gte('created_at', since)
            .order('created_at', { ascending: false });

        if (error) throw error;

        const orders = (data || []) as OrderRow[];
        const backfilled = await backfillDeadlines(supabase, orders, now);

        // Which of these orders have any file attached at all. One query for the
        // whole batch — asking per order would be a hundred round trips.
        const { data: fileRows } = await supabase
            .from('order_files')
            .select('order_id')
            .in('order_id', orders.map(o => o.id));
        const ordersWithFiles = new Set<string>((fileRows || []).map((r: any) => r.order_id));

        const crm = await fetchRecentKeycrmOrders({ sinceIso: since });
        const buckets = buildBuckets(orders, crm, ordersWithFiles, now);

        const summary = {
            ok: true,
            backfilled,
            crm: { ok: crm.ok, orders: crm.orders.length, warning: crm.warning },
            buckets: buckets.map(b => ({ title: b.title, count: b.items.length })),
        };

        // Nothing to act on. Staying silent is the point — a report that lands
        // twice a day saying "все чисто" is a report that gets filtered into a
        // folder nobody opens. The morning run still writes in so the team knows
        // the job is alive.
        const isMorningRun = now.getUTCHours() <= 7;
        if (!buckets.length && !isMorningRun) {
            return NextResponse.json({ ...summary, sent: 0, reason: 'nothing to report' });
        }

        const html = buckets.length
            ? renderEmail(buckets, now, backfilled, crm.warning)
            : renderEmail(
                [{ title: 'Черга чиста, жодне замовлення не потребує втручання просто зараз', items: [], countOnly: true }],
                now, backfilled, crm.warning,
            );

        const total = buckets.reduce((sum, b) => sum + b.items.length, 0);
        const subject = buckets.length
            ? `Потребує уваги: ${total} ${total === 1 ? 'позиція' : 'позицій'}`
            : 'Черга чиста, втручання не потрібне';

        if (preview) {
            return NextResponse.json({ ...summary, sent: 0, subject, preview: html });
        }

        const { sent, errors } = await deliver(subject, html);
        if (errors.length) console.error('[ops-digest] delivery problems:', errors);

        return NextResponse.json({ ...summary, sent, errors });

    } catch (err: any) {
        console.error('[ops-digest] Fatal error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
