import Anthropic from '@anthropic-ai/sdk';
import { getAdminClient } from '@/lib/supabase/admin';
import { extractOrderNumbers } from './work-chat-monitor';
import { isTestOrder } from '@/lib/automation/test-orders';

/**
 * Софія answers questions in the work chats (Diana, 2026-08-11):
 *
 *   «що сьогодні термінового треба відправити»  → today's + overdue deadlines
 *   «які доручення з чатів ще не виконані»      → open chat-task threads
 *   «13644 коли відправка», «що з ТМ-1178»      → the relevant facts of THAT
 *                                                  order, answered to the
 *                                                  actual question
 *
 * The commands (/status, /order…) stay; this layer catches natural questions.
 * It answers ONLY when the intent is unambiguous — a question marker plus a
 * recognised subject — because a work chat that gets bot noise on every
 * message stops being read. Everything else stays silent, and the silent
 * instruction capture (✍ reaction, history note) runs regardless.
 */

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://touchmemories1.vercel.app';
const HOUR_MS = 60 * 60 * 1000;
const ACTIVE_STATUSES = ['new', 'confirmed'];
const MAX_LISTED = 12;

const QUESTION_MARKER = /\?|\b(що|шо|коли|який|яка|які|чи|скільки|де|статус|хто)\b/i;

const SHIP_TODAY = /(сьогодні[\s\S]{0,40}(відправ|здат|готов|терміно))|((відправ|терміно)[\s\S]{0,40}сьогодні)/i;
const OPEN_TASKS = /(доручен|завдан)[\s\S]{0,60}(не\s*викона|невикона|відкрит|актуальн|залишил|лишил|вис(ять|ить)|ще\s+(є|не))/i;

function fmtDate(iso: string | null): string {
    if (!iso) return '—';
    const d = new Date(iso);
    if (!Number.isFinite(d.getTime())) return '—';
    return d.toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit', timeZone: 'Europe/Kyiv' });
}

/**
 * A question addressed to Софія ABOUT the queue itself, not about one order —
 * «що сьогодні термінового», «які доручення не виконані». The webhook checks
 * this BEFORE the silent instruction capture: such a message is a request for
 * a report, and capturing it as if it were an instruction is how «Які
 * доручення ще не виконані?» once closed a live task as done.
 */
export function isMetaWorkQuestion(text: string): boolean {
    const t = String(text || '').trim();
    if (!t || t.startsWith('/')) return false;
    return SHIP_TODAY.test(t) || OPEN_TASKS.test(t);
}

/**
 * The router. Returns the reply text, or null when this message is not a
 * question Софія should answer.
 */
export async function handleWorkQuestion(params: {
    text: string;
    replyText?: string;
}): Promise<string | null> {
    const text = String(params.text || '').trim();
    if (!text || text.startsWith('/')) return null;
    if (!QUESTION_MARKER.test(text)) return null;

    if (SHIP_TODAY.test(text)) return buildShipToday();
    if (OPEN_TASKS.test(text)) return buildOpenChatTasks();

    // A question about a specific order — the number may be in the message
    // itself or in the message it replies to. Telegram handles are stripped
    // first: the digits in «@nika11090» are not an order.
    const numbers = extractOrderNumbers(`${text} ${params.replyText || ''}`.replace(/@\S+/g, ' '));
    if (numbers.length) return answerOrderQuestion(text, numbers);

    return null;
}

/** «Що сьогодні термінового треба відправити» — today's deadlines plus everything already late. */
async function buildShipToday(): Promise<string> {
    const supabase = getAdminClient();

    // End of the Kyiv day, in UTC.
    const kyivToday = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Kyiv' });
    const endOfToday = new Date(`${kyivToday}T23:59:59+03:00`);

    const { data } = await supabase
        .from('orders')
        .select('id, order_number, customer_name, deadline, order_status, ttn')
        .lte('deadline', endOfToday.toISOString())
        .in('order_status', ACTIVE_STATUSES)
        .order('deadline', { ascending: true })
        .limit(MAX_LISTED + 5);

    const real = (data || []).filter(o => !isTestOrder(o as any));
    if (!real.length) return 'Сьогодні нічого термінового не горить — усі дедлайни попереду ✅';

    const nowMs = Date.now();
    const lines = [`🔥 Терміново на сьогодні (${real.length}):`, ''];
    for (const o of real.slice(0, MAX_LISTED)) {
        const overdueDays = Math.floor((nowMs - new Date(o.deadline).getTime()) / (24 * HOUR_MS));
        const flag = overdueDays > 0 ? ` — прострочено ${overdueDays} дн ⚠️` : '';
        lines.push(`• ${o.order_number} — ${o.customer_name || 'без імені'}, дедлайн ${fmtDate(o.deadline)}${o.ttn ? `, ТТН є` : ''}${flag}`);
    }
    if (real.length > MAX_LISTED) lines.push('…решту дивись в адмінці.');
    lines.push('', `${SITE_URL}/admin/production-calendar`);
    return lines.join('\n');
}

/** «Які доручення з чатів ще не виконані» — the open threads, same grouping as the важливо tab. */
async function buildOpenChatTasks(): Promise<string> {
    const supabase = getAdminClient();
    const since = new Date(Date.now() - 14 * 24 * HOUR_MS).toISOString();

    const { data: rows } = await supabase
        .from('order_history')
        .select('order_id, action, notes, details, created_at')
        .in('action', ['work_chat_note', 'work_chat_done'])
        .gte('created_at', since)
        .order('created_at', { ascending: true })
        .limit(300);

    const threads = new Map<string, any[]>();
    for (const r of rows || []) {
        const key = r.order_id || `row-${r.created_at}`;
        const list = threads.get(key) || [];
        list.push(r);
        threads.set(key, list);
    }

    // Open = the latest event on the order is not a completion report.
    const open = [...threads.entries()].filter(([, list]) => list[list.length - 1].action !== 'work_chat_done');
    if (!open.length) return 'Усі доручення з чатів закриті — нічого не висить ✅';

    const orderIds = open.map(([key]) => key).filter(k => !String(k).startsWith('row-'));
    const orderById = new Map<string, any>();
    if (orderIds.length) {
        const { data: orders } = await supabase
            .from('orders')
            .select('id, order_number, customer_name, deadline')
            .in('id', orderIds);
        for (const o of orders || []) orderById.set(o.id, o);
    }

    const lines = [`📌 Невиконані доручення з чатів (${open.length}):`, ''];
    for (const [key, list] of open.slice(0, MAX_LISTED)) {
        const last = list[list.length - 1];
        const order = orderById.get(String(key));
        const head = order ? `${order.order_number} (дедлайн ${fmtDate(order.deadline)})` : 'без замовлення';
        const sender = last.details?.sender ? `${last.details.sender}: ` : '';
        lines.push(`• ${head} — останнє: ${sender}«${String(last.notes || '').slice(0, 120)}»`);
    }
    if (open.length > MAX_LISTED) lines.push('…решту дивись у вкладці доручень.');
    lines.push('', `${SITE_URL}/admin/reprints`);
    return lines.join('\n');
}

const ORDER_STATUS_UA: Record<string, string> = {
    new: 'нове', confirmed: 'підтверджене', shipped: 'відправлене',
    delivered: 'доставлене', completed: 'виконане', cancelled: 'скасоване',
};

/**
 * Recommended next action for a chat-task thread (Diana, 2026-08-11: after
 * Toma's «Фоток не було ще» the card should say «Уточнити у виробництва,
 * коли будуть фото»).
 *
 * Generated at CAPTURE time — one small model call per captured message, so
 * the важливо tab loads instantly and never spends tokens on rendering.
 * Stored in orders.custom_attributes.chat_task; cleared when the thread's
 * latest event is a completion report.
 */
export async function refreshTaskRecommendations(orderNumbers: string[]): Promise<void> {
    if (!orderNumbers.length) return;
    const supabase = getAdminClient();

    const { data: orders } = await supabase
        .from('orders')
        .select('id, order_number, order_status, deadline, ttn, custom_attributes')
        .in('order_number', orderNumbers);

    for (const order of orders || []) {
        try {
            const { data: rows } = await supabase
                .from('order_history')
                .select('action, notes, details, created_at')
                .eq('order_id', order.id)
                .in('action', ['work_chat_note', 'work_chat_done'])
                .order('created_at', { ascending: true })
                .limit(20);
            if (!rows?.length) continue;

            const attrs = (order.custom_attributes && typeof order.custom_attributes === 'object')
                ? order.custom_attributes as Record<string, any>
                : {};

            // Thread closed — the recommendation has served its purpose.
            if (rows[rows.length - 1].action === 'work_chat_done') {
                if (attrs.chat_task) {
                    await supabase.from('orders')
                        .update({ custom_attributes: { ...attrs, chat_task: null } })
                        .eq('id', order.id);
                }
                continue;
            }

            if (!process.env.ANTHROPIC_API_KEY) continue;

            const crmStage = attrs?.keycrm?.status_label || null;
            const thread = rows
                .map(r => `${r.details?.sender || '—'}: ${String(r.notes || '').slice(0, 200)}`)
                .join('\n');

            const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
            const response = await anthropic.messages.create({
                model: 'claude-haiku-4-5',
                max_tokens: 120,
                temperature: 0.2,
                system: [
                    'Ти — Софія, асистентка команди touch.memories.',
                    'Прочитай нитку доручення по замовленню і сформулюй ОДНУ коротку рекомендовану наступну дію для команди українською.',
                    'Приклад формату: «Уточнити у виробництва, коли будуть готові фото».',
                    'Відповідай лише самою дією, без пояснень. Не використовуй речення з одного-двох слів.',
                ].join(' '),
                messages: [{
                    role: 'user',
                    content: [
                        `Замовлення ${order.order_number}.`,
                        `Дедлайн виробництва: ${fmtDate(order.deadline)}.`,
                        crmStage ? `Етап у CRM: ${crmStage}.` : '',
                        order.ttn ? 'ТТН уже створена.' : 'ТТН ще немає.',
                        '',
                        'Нитка доручення:',
                        thread,
                    ].filter(Boolean).join('\n'),
                }],
            });

            const reco = response.content[0]?.type === 'text' ? response.content[0].text.trim() : '';
            if (!reco) continue;

            await supabase.from('orders')
                .update({
                    custom_attributes: {
                        ...attrs,
                        chat_task: { recommendation: reco.slice(0, 300), updated_at: new Date().toISOString() },
                    },
                })
                .eq('id', order.id);
        } catch (e) {
            console.error('[work-questions] recommendation failed:', e);
        }
    }
}

/**
 * A free-form question about one order: gather the order's live facts and let
 * the model answer THE QUESTION from them — nothing else. Falls back to a
 * plain fact card when the AI is unavailable, so the chat always gets an
 * answer.
 */
async function answerOrderQuestion(question: string, numbers: string[]): Promise<string | null> {
    const supabase = getAdminClient();

    const { data: matches } = await supabase
        .from('orders')
        .select('id, order_number, order_status, payment_status, total, prepaid_amount, customer_name, deadline, ttn, tracking_carrier, created_at, paid_at, with_designer, items, custom_attributes, source, notes, client_comment')
        .in('order_number', numbers)
        .order('created_at', { ascending: false })
        .limit(1);
    let order = matches?.[0];

    // A bare CRM number can belong to a hand-transferred site order (card
    // 13707 → TM-001149): those CRM cards are never mirrored, but the
    // adoption pass writes the CRM id onto the TM row — search there before
    // giving up.
    if (!order) {
        const crmIds = numbers
            .filter(n => n.startsWith('CRM-'))
            .map(n => n.slice(4));
        for (const crmId of crmIds) {
            const { data: adopted } = await supabase
                .from('orders')
                .select('id, order_number, order_status, payment_status, total, prepaid_amount, customer_name, deadline, ttn, tracking_carrier, created_at, paid_at, with_designer, items, custom_attributes, source, notes, client_comment')
                .eq('custom_attributes->keycrm->>order_id', crmId)
                .limit(1);
            if (adopted?.[0]) { order = adopted[0]; break; }
        }
    }

    if (!order) {
        return `Замовлення ${numbers.join(' / ')} не знайшла в базі. Якщо воно щойно створене в KeyCRM — з'явиться після найближчого годинного синку.`;
    }

    const { data: history } = await supabase
        .from('order_history')
        .select('action, notes, created_at')
        .eq('order_id', order.id)
        .order('created_at', { ascending: false })
        .limit(6);

    const crmStage = (order as any)?.custom_attributes?.keycrm?.status_label || null;
    const itemsSummary = Array.isArray(order.items)
        ? order.items.map((i: any) => i?.product_name).filter(Boolean).slice(0, 4).join(', ')
        : '';

    const facts = [
        `Номер: ${order.order_number}`,
        `Статус на сайті: ${ORDER_STATUS_UA[order.order_status] || order.order_status}`,
        crmStage ? `Етап у KeyCRM: ${crmStage}` : '',
        `Оплата: ${order.payment_status === 'paid' ? `оплачено${order.paid_at ? ` ${fmtDate(order.paid_at)}` : ''}` : (Number(order.prepaid_amount) > 0 && (order as any).source === 'keycrm' ? `передоплата ${order.prepaid_amount} ₴ із ${order.total} ₴` : 'очікує оплати')}`,
        `Сума: ${order.total} ₴`,
        `Клієнт: ${order.customer_name || '—'}`,
        `Створене: ${fmtDate(order.created_at)}`,
        `Дедлайн виробництва: ${fmtDate(order.deadline)}`,
        order.ttn ? `ТТН: ${order.ttn}${order.tracking_carrier ? ` (${order.tracking_carrier})` : ''}` : 'ТТН ще не створено',
        order.with_designer ? 'Послуга дизайнера: так' : '',
        itemsSummary ? `Товари: ${itemsSummary}` : '',
        order.client_comment ? `Коментар клієнта: ${String(order.client_comment).slice(0, 200)}` : '',
        (history || []).length
            ? `Останні події: ${(history || []).map(h => `${fmtDate(h.created_at)} — ${String(h.notes || h.action).slice(0, 100)}`).join('; ')}`
            : '',
    ].filter(Boolean).join('\n');

    const link = `${SITE_URL}/admin/orders/${order.id}`;

    if (!process.env.ANTHROPIC_API_KEY) {
        return `📦 ${order.order_number}\n\n${facts}\n\n${link}`;
    }

    try {
        const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
        const response = await anthropic.messages.create({
            model: 'claude-haiku-4-5',
            max_tokens: 300,
            temperature: 0.2,
            system: [
                'Ти — Софія, асистентка команди touch.memories у робочому чаті.',
                'Відповідай на питання колеги коротко і по суті, українською, ТІЛЬКИ з наведених фактів про замовлення.',
                'Якщо відповіді на питання у фактах немає, чесно скажи, що в системі цього не видно, і порадь відкрити картку замовлення.',
                'Нічого не вигадуй. Не використовуй речення з одного-двох слів.',
            ].join(' '),
            messages: [{
                role: 'user',
                content: `Факти про замовлення:\n${facts}\n\nПитання колеги: «${question}»`,
            }],
        });
        const reply = response.content[0]?.type === 'text' ? response.content[0].text.trim() : '';
        if (!reply) return `📦 ${order.order_number}\n\n${facts}\n\n${link}`;
        return `${reply}\n\n${link}`;
    } catch (e) {
        console.error('[work-questions] AI answer failed:', e);
        return `📦 ${order.order_number}\n\n${facts}\n\n${link}`;
    }
}
