import { getAdminClient } from '@/lib/supabase/admin';
import {
    getBusinessConnection,
    getWorkChatIds,
    addWorkChatId,
    setWatchdogChatId,
    getOwnerUserIds,
    shouldGreetToday,
} from './telegram-business';
import { computeUnansweredDialogs, waitingLabel } from './unanswered';
import { isVisibleProductionOrder, PRODUCTION_ACTIVE_STATUSES } from '@/lib/automation/production-visibility';
import { computeLowStock, computeDeadlineRisks, computeWaitingForClient } from '@/lib/automation/risk-radar';

/**
 * Team commands for work group chats (and for Diana's private chat with the
 * bot). The customer-facing AI never runs here — a work chat is a control
 * panel, not a client dialog.
 *
 * Access model: commands expose order and customer data, so a group must be
 * registered first, and only the OWNER (the account connected via Telegram
 * Business) can register one. After registration every member of that group
 * can use the read commands — that is the point of a work chat.
 *
 *   /register     — owner-only: allow commands in this group
 *   /alerts_here  — owner-only: also send watchdog alerts to this chat
 *   /chatid       — works anywhere, prints the chat id
 *   /status       — orders + dialogs summary for the last 24h
 *   /order TM-…   — one order's live state
 *   /overdue      — orders past their deadline
 *   /unanswered   — client dialogs waiting on us
 */

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://touchmemories1.vercel.app';
const HOUR_MS = 60 * 60 * 1000;
const ACTION_WINDOW_DAYS = 21;
const MAX_LISTED = 10;

const ORDER_STATUS_UA: Record<string, string> = {
    new: 'нове',
    confirmed: 'підтверджене',
    shipped: 'відправлене',
    delivered: 'доставлене',
    completed: 'виконане',
    cancelled: 'скасоване',
};

const PAYMENT_STATUS_UA: Record<string, string> = {
    paid: 'оплачено',
    pending: 'очікує оплати',
    partially_paid: 'часткова оплата',
    refunded: 'повернено',
};

// Statuses that still need work — everything not shipped out or cancelled.
const ACTIVE_STATUSES = ['new', 'confirmed'];

/** Kyiv-local hour and date — the bot's voice lives on Diana's clock, not UTC. */
export function kyivHour(): number {
    return parseInt(new Date().toLocaleString('en-US', { timeZone: 'Europe/Kyiv', hour: '2-digit', hour12: false }), 10);
}

export function kyivDate(): string {
    return new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Kyiv' });
}

/**
 * Diana's tone rules: before 8:00 the chat is early birds, after 10:00 it's
 * sleepyheads, in between a plain warm good morning.
 */
export function morningGreeting(): string {
    const h = kyivHour();
    if (h < 8) return 'Доброго ранку, ранні пташки! 🐦☀️';
    if (h < 10) return 'Доброго ранку! ☀️';
    return 'Доброго ранку, соньки! 😴☕';
}

function fmtDate(iso: string | null): string {
    if (!iso) return '—';
    const d = new Date(iso);
    if (!Number.isFinite(d.getTime())) return '—';
    return d.toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Europe/Kyiv' });
}

export async function handleWorkCommand(msg: any): Promise<string | null> {
    const text: string = (msg.text || '').trim();
    if (!text.startsWith('/')) return null;

    const [cmdRaw, ...args] = text.split(/\s+/);
    // In groups commands arrive as /status@BotName — strip the mention.
    const cmd = cmdRaw.split('@')[0].toLowerCase();

    const chatId = Number(msg.chat?.id);
    const fromId = msg.from?.id ? Number(msg.from.id) : null;
    const isPrivate = msg.chat?.type === 'private';

    const state = await getBusinessConnection();
    const extraOwners = await getOwnerUserIds();
    // Diana runs two accounts (personal + brand); either counts as owner.
    const isOwner = (!!state && fromId === state.user_id) || (fromId != null && extraOwners.includes(fromId));
    const workChats = await getWorkChatIds();
    const registered = isPrivate ? isOwner : workChats.includes(chatId);

    switch (cmd) {
        case '/chatid':
            return `ID цього чату: ${chatId}`;

        case '/whoami':
            return [
                `Твій Telegram ID: ${fromId ?? 'невідомий'}`,
                `ID цього чату: ${chatId}`,
                isOwner
                    ? 'Я впізнаю тебе як власницю ✅'
                    : 'Цей акаунт не в списку власників — команди реєстрації для нього закриті.',
            ].join('\n');

        case '/register': {
            if (isPrivate) return 'Ця команда потрібна тільки в групових чатах — у нашій особистій переписці команди й так працюють.';
            if (!state && !extraOwners.length) return 'Спочатку підключи мене через Telegram Business у своїх налаштуваннях — так я знатиму, хто власник, і зможу безпечно реєструвати робочі чати.';
            if (!isOwner) return 'Реєструвати робочі чати може тільки власниця акаунта. Якщо це таки ти, але з іншого акаунта — надішли /whoami і передай Клоду свій ID, він додасть цей акаунт у власники.';
            await addWorkChatId(chatId);
            return 'Чат зареєстровано як робочий ✅\nТепер усі учасники можуть користуватись командами: /status, /order, /overdue, /unanswered. Щоб я ще й надсилала сюди сповіщення про діалоги без відповіді — виконай /alerts_here.';
        }

        case '/alerts_here': {
            if (!state && !extraOwners.length) return 'Спочатку підключи мене через Telegram Business у своїх налаштуваннях — так я знатиму, хто власник.';
            if (!isOwner) return 'Налаштовувати сповіщення може тільки власниця акаунта.';
            if (!isPrivate) await addWorkChatId(chatId);
            await setWatchdogChatId(chatId);
            return 'Домовились — тепер сповіщення про діалоги без відповіді та проблеми надсилатиму сюди 🔔';
        }

        case '/help':
        case '/start': {
            if (!registered && !isPrivate) return null;
            if (!registered) return null;
            return [
                'Ось що я вмію в робочому чаті:',
                '',
                '/status — зведення за останню добу: замовлення, оплати, дедлайни, діалоги',
                '/order TM-001234 — стан конкретного замовлення',
                '/overdue — замовлення з простроченим дедлайном',
                '/unanswered — переписки з клієнтами, що чекають на відповідь',
                '/risk — замовлення під загрозою зриву дедлайну',
                '/stock — матеріали, що закінчуються',
                '/waiting — оплачені замовлення без фото від клієнта',
                '/alerts_here — надсилати сповіщення в цей чат (тільки власниця)',
                '/chatid — показати ID чату',
            ].join('\n');
        }

        case '/status': {
            if (!registered) return unregisteredReply(isPrivate);
            return withDailyGreeting(chatId, await buildStatus());
        }

        case '/order': {
            if (!registered) return unregisteredReply(isPrivate);
            const num = (args[0] || '').toUpperCase();
            if (!num) return 'Вкажи номер замовлення, наприклад: /order TM-001234';
            return withDailyGreeting(chatId, await buildOrderCard(num));
        }

        case '/overdue': {
            if (!registered) return unregisteredReply(isPrivate);
            return withDailyGreeting(chatId, await buildOverdue());
        }

        case '/stock': {
            if (!registered) return unregisteredReply(isPrivate);
            return withDailyGreeting(chatId, await buildStock());
        }

        case '/risk':
        case '/ryzyk': {
            if (!registered) return unregisteredReply(isPrivate);
            return withDailyGreeting(chatId, await buildRisks());
        }

        case '/waiting': {
            if (!registered) return unregisteredReply(isPrivate);
            return withDailyGreeting(chatId, await buildWaiting());
        }

        case '/unanswered': {
            if (!registered) return unregisteredReply(isPrivate);
            return withDailyGreeting(chatId, await buildUnanswered());
        }

        default:
            // Unknown commands stay silent so we don't answer other bots'
            // commands in shared groups.
            return null;
    }
}

/**
 * The first data command in a chat each Kyiv day gets a time-of-day greeting
 * on top (early birds before 8, sleepyheads after 10); late-evening requests
 * get a sweet-dreams sign-off instead.
 */
async function withDailyGreeting(chatId: number, body: string): Promise<string> {
    try {
        if (!(await shouldGreetToday(chatId, kyivDate()))) return body;
        const h = kyivHour();
        if (h < 12) return `${morningGreeting()}\n\n${body}`;
        if (h >= 21) return `${body}\n\nНе засиджуйтесь допізна — солодких снів! 🌙`;
        return body;
    } catch {
        return body;
    }
}

function unregisteredReply(isPrivate: boolean): string {
    if (isPrivate) return 'Команди в особистих повідомленнях доступні тільки власниці акаунта.';
    return 'Цей чат ще не зареєстрований як робочий. Попроси Діану виконати тут команду /register.';
}

/** Shared with /api/cron/work-chat-digest — the morning digest is this same summary, pushed on schedule. */
export async function buildStatus(): Promise<string> {
    const supabase = getAdminClient();
    const now = Date.now();
    const dayAgo = new Date(now - 24 * HOUR_MS).toISOString();
    const windowAgo = new Date(now - ACTION_WINDOW_DAYS * 24 * HOUR_MS).toISOString();
    const nowIso = new Date(now).toISOString();

    // The overdue figure follows the production-visibility rules (a bare
    // status count once reported July orders long finished in KeyCRM), so it
    // reads rows and filters instead of asking for a head-count.
    const [created, paid, unpaid, overdueRows] = await Promise.all([
        supabase.from('orders').select('id', { count: 'exact', head: true })
            .gte('created_at', dayAgo),
        supabase.from('orders').select('id', { count: 'exact', head: true })
            .gte('paid_at', dayAgo),
        supabase.from('orders').select('id', { count: 'exact', head: true })
            .eq('payment_status', 'pending').in('order_status', ACTIVE_STATUSES)
            .gte('created_at', windowAgo),
        supabase.from('orders')
            .select('customer_name, source, created_at, custom_attributes')
            .lt('deadline', nowIso).in('order_status', PRODUCTION_ACTIVE_STATUSES)
            .limit(500),
    ]);

    const overdueCount = (overdueRows.data || []).filter(o => isVisibleProductionOrder(o as any)).length;

    let dialogsLine = 'Діалоги: не вдалося порахувати.';
    try {
        const report = await computeUnansweredDialogs();
        dialogsLine = `Діалоги з клієнтами: без відповіді — ${report.unanswered.length}, чекають на людину — ${report.needsHuman.length}.`;
    } catch (e) {
        console.error('/status unanswered error:', e);
    }

    return [
        '📊 Зведення за останні 24 години',
        '',
        `Нових замовлень: ${created.count ?? 0}`,
        `Оплачено: ${paid.count ?? 0}`,
        `Неоплачених у роботі (за ${ACTION_WINDOW_DAYS} дн): ${unpaid.count ?? 0}`,
        `Прострочених дедлайнів: ${overdueCount}`,
        dialogsLine,
        '',
        `Деталі: /overdue, /unanswered, або ${SITE_URL}/admin/orders`,
    ].join('\n');
}

async function buildOrderCard(orderNumber: string): Promise<string> {
    const supabase = getAdminClient();

    // Managers type the number the way they say it: «13644», «тм 1234»,
    // «CRM-13644». Build every canonical form the input could mean and look
    // them all up — a bare number is most often the KeyCRM id.
    const candidates: string[] = [];
    const bare = orderNumber.match(/^(\d+)$/);
    const prefixed = orderNumber.match(/^(TM|CRM|PB)[-\s]?(\d+)$/i);
    if (bare) {
        candidates.push(`CRM-${bare[1]}`, `TM-${bare[1].padStart(6, '0')}`, `PB-${bare[1]}`);
    } else if (prefixed) {
        const prefix = prefixed[1].toUpperCase();
        candidates.push(prefix === 'TM' ? `TM-${prefixed[2].padStart(6, '0')}` : `${prefix}-${prefixed[2]}`);
    } else {
        candidates.push(orderNumber);
    }

    const { data: matches } = await supabase
        .from('orders')
        .select('id, order_number, order_status, payment_status, total, customer_name, deadline, ttn, created_at, with_designer, paid_at, custom_attributes, prepaid_amount, source, manager:staff!orders_manager_id_fkey(name), designer:staff!orders_designer_id_fkey(name)')
        .in('order_number', candidates)
        .order('created_at', { ascending: false })
        .limit(1);
    let order = matches?.[0];

    // A bare CRM number can belong to a hand-transferred site order: card
    // 13707 is never mirrored (site source), but TM-001149 carries
    // keycrm.order_id=13707 after adoption. Second look before giving up.
    if (!order && bare) {
        const { data: adopted } = await supabase
            .from('orders')
            .select('id, order_number, order_status, payment_status, total, customer_name, deadline, ttn, created_at, with_designer, paid_at, custom_attributes, prepaid_amount, source, manager:staff!orders_manager_id_fkey(name), designer:staff!orders_designer_id_fkey(name)')
            .eq('custom_attributes->keycrm->>order_id', bare[1])
            .limit(1);
        order = adopted?.[0];
    }

    if (!order) return `Замовлення ${orderNumber} не знайшла (шукала як ${candidates.join(', ')}). Якщо воно щойно створене в KeyCRM — з'явиться в базі після найближчого годинного синку.`;

    // The CRM stage name is the truth the team lives by («Передано на друк»);
    // the site status is a coarse mapping (TTN present → «відправлене» even
    // while the book is still printing). Show the CRM stage first when we
    // have it, with the site status as context.
    const crmStage = (order as any)?.custom_attributes?.keycrm?.status_label;
    const siteStatus = ORDER_STATUS_UA[order.order_status] || order.order_status || '—';
    const statusLine = crmStage
        ? `Статус у CRM: ${crmStage} (на сайті: ${siteStatus})`
        : `Статус: ${siteStatus}`;

    // Partial payments: for mirrored CRM orders prepaid_amount is the money
    // the CRM actually collected, so «передоплата» reads straight from it.
    const prepaid = Number((order as any).prepaid_amount || 0);
    const paymentLine = order.payment_status === 'paid'
        ? `оплачено${order.paid_at ? ` (${fmtDate(order.paid_at)})` : ''}`
        : (order as any).source === 'keycrm' && prepaid > 0
            ? `передоплата ${prepaid.toLocaleString('uk-UA')} ₴ із ${Number(order.total || 0).toLocaleString('uk-UA')} ₴`
            : (PAYMENT_STATUS_UA[order.payment_status] || order.payment_status || '—');

    // Who is responsible: the CRM's manager for mirrored orders, the site's
    // staff assignment otherwise — «хто відповідальний?» must have an answer.
    const crmManager = (order as any)?.custom_attributes?.keycrm?.manager_name;
    const siteManager = (order as any)?.manager?.name;
    const siteDesigner = (order as any)?.designer?.name;
    const managerLine = crmManager
        ? `Менеджер (CRM): ${crmManager}`
        : siteManager
            ? `Менеджер: ${siteManager}`
            : 'Менеджер: не призначений';

    const lines = [
        `📦 Замовлення ${order.order_number}`,
        '',
        statusLine,
        managerLine,
        ...(siteDesigner ? [`Дизайнер: ${siteDesigner}`] : []),
        `Оплата: ${paymentLine}`,
        `Сума: ${order.total ?? '—'} ₴`,
        `Клієнт: ${order.customer_name || '—'}`,
        `Створене: ${fmtDate(order.created_at)}`,
        `Дедлайн: ${fmtDate(order.deadline)}`,
    ];
    if (order.with_designer) lines.push('Послуга дизайнера: так');
    if (order.ttn) lines.push(`ТТН: ${order.ttn}`);
    lines.push('', `${SITE_URL}/admin/orders/${order.id}`);
    return lines.join('\n');
}

async function buildOverdue(): Promise<string> {
    const supabase = getAdminClient();
    const nowMs = Date.now();
    // Production visibility rules, same as the calendar board and Софія's
    // «що термінового» answer: without them this listed hand-transferred July
    // orders long finished in KeyCRM, and missed mirrored CRM orders whose
    // status is already in_production.
    const { data: orders } = await supabase
        .from('orders')
        .select('id, order_number, customer_name, deadline, order_status, source, created_at, custom_attributes')
        .lt('deadline', new Date(nowMs).toISOString())
        .in('order_status', PRODUCTION_ACTIVE_STATUSES)
        .order('deadline', { ascending: true })
        .limit(200);

    const real = (orders || []).filter(o => isVisibleProductionOrder(o as any));
    if (!real.length) return 'Прострочених дедлайнів немає — все під контролем ✅';

    const lines = [`⏰ Прострочені дедлайни (${real.length > MAX_LISTED ? `${MAX_LISTED}+` : real.length}):`, ''];
    for (const o of real.slice(0, MAX_LISTED)) {
        const daysOver = Math.max(1, Math.floor((nowMs - new Date(o.deadline).getTime()) / (24 * HOUR_MS)));
        lines.push(`• ${o.order_number} — ${o.customer_name || 'без імені'}, дедлайн ${fmtDate(o.deadline)} (прострочено ${daysOver} дн)`);
    }
    if (real.length > MAX_LISTED) lines.push('…список неповний, решту дивись в адмінці.');
    lines.push('', `${SITE_URL}/admin/orders`);
    return lines.join('\n');
}

async function buildUnanswered(): Promise<string> {
    try {
        const report = await computeUnansweredDialogs();
        if (!report.unanswered.length && !report.needsHuman.length) {
            return 'Усі переписки з клієнтами закриті — ніхто не чекає на відповідь ✅';
        }
        const lines: string[] = [];
        if (report.needsHuman.length) {
            lines.push(`❗ Чекають на людину (${report.needsHuman.length}):`);
            for (const i of report.needsHuman.slice(0, MAX_LISTED)) {
                lines.push(`• ${i.name} (${i.platform}), ${waitingLabel(i.hours)}: «${i.text}»`);
            }
            lines.push('');
        }
        if (report.unanswered.length) {
            lines.push(`⏳ Без відповіді довше ${report.thresholdHours} год (${report.unanswered.length}):`);
            for (const i of report.unanswered.slice(0, MAX_LISTED)) {
                lines.push(`• ${i.name} (${i.platform}), чекає ${waitingLabel(i.hours)}: «${i.text}»`);
            }
        }
        lines.push('', `${SITE_URL}/admin/social-inbox`);
        return lines.join('\n');
    } catch (e: any) {
        console.error('/unanswered error:', e);
        return 'Не вдалося отримати список переписок, спробуй ще раз за хвилину.';
    }
}

/** «Що закінчується» — CRM stock mirrored onto confirmed catalogue pairs. */
async function buildStock(): Promise<string> {
    try {
        const { items, threshold } = await computeLowStock();
        if (!items.length) return `Матеріалів менше ${threshold} шт немає — запаси в нормі ✅`;
        const lines = [`📦 Закінчуються (менше ${threshold} шт):`, ''];
        for (const i of items.slice(0, MAX_LISTED)) {
            const work = i.inWork ? `, у роботі ${i.inWork} замовл.` : '';
            lines.push(`• ${i.name}${i.variant ? ` ${i.variant}` : ''} — ${i.stock} шт${work}`);
        }
        if (items.length > MAX_LISTED) lines.push(`…і ще ${items.length - MAX_LISTED} позицій.`);
        return lines.join('\n');
    } catch (e: any) {
        console.error('/stock failed:', e);
        return 'Не вдалося прочитати залишки, спробуй за хвилину.';
    }
}

/** «Що може зірватись» — deadlines still ahead but not yet handed to print. */
async function buildRisks(): Promise<string> {
    try {
        const risks = await computeDeadlineRisks();
        if (!risks.length) return 'Нічого під загрозою — усе, що з дедлайном на цьому тижні, вже в роботі ✅';
        const lines = [`⚠️ Під загрозою зриву (${risks.length}):`, ''];
        for (const r of risks.slice(0, MAX_LISTED)) {
            lines.push(`• ${r.orderNumber} — ${r.customer}, ${r.reason} (стадія: ${r.stage})`);
        }
        if (risks.length > MAX_LISTED) lines.push(`…і ще ${risks.length - MAX_LISTED} замовлень.`);
        return lines.join('\n');
    } catch (e: any) {
        console.error('/risk failed:', e);
        return 'Не вдалося порахувати ризики, спробуй за хвилину.';
    }
}

/** «Чекаємо матеріали» — paid orders with no files attached. */
async function buildWaiting(): Promise<string> {
    try {
        const waiting = await computeWaitingForClient();
        if (!waiting.length) return 'Усі оплачені замовлення мають матеріали від клієнтів ✅';
        const lines = [`📥 Чекаємо фото від клієнта (${waiting.length}):`, ''];
        for (const w of waiting.slice(0, MAX_LISTED)) {
            lines.push(`• ${w.orderNumber} — ${w.customer}, оплачено ${w.paidDaysAgo} дн тому`);
        }
        if (waiting.length > MAX_LISTED) lines.push(`…і ще ${waiting.length - MAX_LISTED} замовлень.`);
        return lines.join('\n');
    } catch (e: any) {
        console.error('/waiting failed:', e);
        return 'Не вдалося отримати список, спробуй за хвилину.';
    }
}
