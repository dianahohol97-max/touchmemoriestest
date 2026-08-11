import { getAdminClient } from '@/lib/supabase/admin';
import {
    getBusinessConnection,
    getWorkChatIds,
    addWorkChatId,
    setWatchdogChatId,
    getOwnerUserIds,
} from './telegram-business';
import { computeUnansweredDialogs, waitingLabel } from './unanswered';
import { isTestOrder } from '@/lib/automation/test-orders';

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
                '/alerts_here — надсилати сповіщення в цей чат (тільки власниця)',
                '/chatid — показати ID чату',
            ].join('\n');
        }

        case '/status': {
            if (!registered) return unregisteredReply(isPrivate);
            return buildStatus();
        }

        case '/order': {
            if (!registered) return unregisteredReply(isPrivate);
            const num = (args[0] || '').toUpperCase();
            if (!num) return 'Вкажи номер замовлення, наприклад: /order TM-001234';
            return buildOrderCard(num);
        }

        case '/overdue': {
            if (!registered) return unregisteredReply(isPrivate);
            return buildOverdue();
        }

        case '/unanswered': {
            if (!registered) return unregisteredReply(isPrivate);
            return buildUnanswered();
        }

        default:
            // Unknown commands stay silent so we don't answer other bots'
            // commands in shared groups.
            return null;
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

    const [created, paid, unpaid, overdue] = await Promise.all([
        supabase.from('orders').select('id', { count: 'exact', head: true })
            .gte('created_at', dayAgo),
        supabase.from('orders').select('id', { count: 'exact', head: true })
            .gte('paid_at', dayAgo),
        supabase.from('orders').select('id', { count: 'exact', head: true })
            .eq('payment_status', 'pending').in('order_status', ACTIVE_STATUSES)
            .gte('created_at', windowAgo),
        supabase.from('orders').select('id', { count: 'exact', head: true })
            .lt('deadline', nowIso).in('order_status', ACTIVE_STATUSES),
    ]);

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
        `Прострочених дедлайнів: ${overdue.count ?? 0}`,
        dialogsLine,
        '',
        `Деталі: /overdue, /unanswered, або ${SITE_URL}/admin/orders`,
    ].join('\n');
}

async function buildOrderCard(orderNumber: string): Promise<string> {
    const supabase = getAdminClient();
    const { data: order } = await supabase
        .from('orders')
        .select('id, order_number, order_status, payment_status, total, customer_name, deadline, ttn, created_at, with_designer, paid_at')
        .eq('order_number', orderNumber)
        .maybeSingle();

    if (!order) return `Замовлення ${orderNumber} не знайшла. Перевір номер — формат виглядає як TM-001234.`;

    const lines = [
        `📦 Замовлення ${order.order_number}`,
        '',
        `Статус: ${ORDER_STATUS_UA[order.order_status] || order.order_status || '—'}`,
        `Оплата: ${PAYMENT_STATUS_UA[order.payment_status] || order.payment_status || '—'}${order.paid_at ? ` (${fmtDate(order.paid_at)})` : ''}`,
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
    const { data: orders } = await supabase
        .from('orders')
        .select('id, order_number, customer_name, deadline, order_status')
        .lt('deadline', new Date(nowMs).toISOString())
        .in('order_status', ACTIVE_STATUSES)
        .order('deadline', { ascending: true })
        .limit(MAX_LISTED + 1);

    const real = (orders || []).filter(o => !isTestOrder(o as any));
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
