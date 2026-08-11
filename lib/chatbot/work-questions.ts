import Anthropic from '@anthropic-ai/sdk';
import { getAdminClient } from '@/lib/supabase/admin';
import { extractOrderNumbers } from './work-chat-monitor';
import { isVisibleProductionOrder, PRODUCTION_ACTIVE_STATUSES } from '@/lib/automation/production-visibility';
import { fetchOrderCardExtras } from '@/lib/automation/keycrm';

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
const MAX_LISTED = 12;

// JavaScript's \b is ASCII-only: against Cyrillic text «\bхто\b» can never
// match, so this list was dead weight and every question without a literal
// «?» went unanswered (live: «13790 хто в цьому замовленні відповідальний»,
// «які замовлення мають поїхати завтра 12 серпня»). Boundaries are spelled
// out with Unicode-aware lookarounds instead.
const QUESTION_MARKER = /\?|(?<!\p{L})(що|шо|коли|який|яка|яке|які|чи|скільки|де|статус|хто|кому|потрібно|треба|цікавл)(?!\p{L})/iu;

// «Софія», «Софійка», «Софіє» or the bot's @username — the team's way of
// addressing the bot directly (Diana, 2026-08-11: «якщо в чаті кажуть софія
// чи софійка, це означає що звертаються до боту»). A message addressed by
// name is a message TO Софія even without a question mark, and deserves at
// least a hint instead of silence.
const ADDRESSED_BY_NAME = /софі|sofi/i;

const OPEN_TASKS = /(доручен|завдан)[\s\S]{0,60}(не\s*викона|невикона|відкрит|актуальн|залишил|лишил|вис(ять|ить)|ще\s+(є|не))/i;

const NATIONALITY = /національн/i;

// The answer Diana chose herself (2026-08-11: «я хочу таку відповідь про
// національність») — do not soften or reword it.
const NATIONALITY_REPLY = 'Я українка 🇺🇦 Батько наш — Бандера, Україна — мати!';

// «поїхати» / «виїхати» / «відвантажити» are how the team says «ship» just as
// often as «відправити» (live: «які мають поїхати завтра 12 серпня»).
const SHIP_WORDS = /(відправ|відвантаж|здат|готов|поїха|поїде|поїд|виїха|виїде|доставит)/i;
const SHIP_URGENCY = /(сьогодні|завтра|післязавтра|термінов|гор(ить|ять)|встиг)/i;

/**
 * A question about the shipping queue, with its time horizon in days.
 *
 * The first version demanded the literal word «сьогодні» next to «відправити»,
 * so real questions from the team went unanswered: «Які замовлення мають бути
 * відправлені максимум завтра 12 серпня?», «які замовлення термінові на
 * відправку?». Now: shipping word + urgency word + (question marker or the
 * bot addressed by name), and the horizon follows the word — «завтра» reaches
 * one day ahead, «післязавтра» two. A message that names a specific order is
 * about that order, not the queue, and is left to the per-order path.
 */
/**
 * «Що вчора було цікавого?», «що я могла пропустити?» — the shift-start
 * question (Diana, 2026-08-11: «коли менеджер вранці приходить на зміну, чи
 * зможе в неї запитати, що вчора було цікавого та що я могла пропустити»).
 * A message naming a specific order is about that order, not the day.
 */
export function matchDigestQuestion(text: string): boolean {
    const t = String(text || '');
    if (!QUESTION_MARKER.test(t) && !ADDRESSED_BY_NAME.test(t)) return false;
    if (extractOrderNumbers(t.replace(/@\S+/g, ' ')).length) return false;
    if (/(пропустил|пропустити|пропущен)/i.test(t)) return true;
    if (/(вчора|учора|за ніч|за добу)/i.test(t) && /(було|цікав|нов|стал|відбул|змінил)/i.test(t)) return true;
    return false;
}

export function matchShipQuestion(text: string): { horizonDays: number } | null {
    const t = String(text || '');
    if (!QUESTION_MARKER.test(t) && !ADDRESSED_BY_NAME.test(t)) return null;
    if (!SHIP_WORDS.test(t) || !SHIP_URGENCY.test(t)) return null;
    if (extractOrderNumbers(t.replace(/@\S+/g, ' ')).length) return null;
    if (/післязавтра/i.test(t)) return { horizonDays: 2 };
    if (/завтра/i.test(t)) return { horizonDays: 1 };
    return { horizonDays: 0 };
}

function fmtDate(iso: string | null): string {
    if (!iso) return '—';
    const d = new Date(iso);
    if (!Number.isFinite(d.getTime())) return '—';
    return d.toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit', timeZone: 'Europe/Kyiv' });
}

/**
 * Софія's working memory of a chat (Diana, 2026-08-11: «хай має память в
 * робочих чатах також, щоб якщо якісь запитання по замовленнях дублюються,
 * вона могла відповісти»). The webhook records every non-command message from
 * registered chats plus Софія's own replies; the AI paths read the last dozen
 * back. Kept to a week — working memory, not an archive.
 */
export async function recordWorkChatMessage(chatId: string, params: {
    text: string;
    sender?: string;
    isBot?: boolean;
    messageId?: string;
}): Promise<void> {
    const text = String(params.text || '').trim();
    if (!chatId || !text) return;

    try {
        const supabase = getAdminClient();
        await supabase.from('work_chat_messages').insert({
            chat_id: String(chatId),
            message_id: params.messageId ? String(params.messageId) : null,
            sender: params.isBot ? 'Софія' : (params.sender || null),
            is_bot: params.isBot === true,
            text: text.slice(0, 1000),
        });
        // Opportunistic prune — cheap, and keeps the table honest about being
        // short-term memory.
        await supabase
            .from('work_chat_messages')
            .delete()
            .lt('created_at', new Date(Date.now() - 7 * 24 * HOUR_MS).toISOString());
    } catch (e) {
        console.error('[work-questions] chat memory write failed:', e);
    }
}

/** The last messages of a chat, oldest first, as prompt-ready lines. */
async function fetchChatContext(chatId: string | undefined, limit = 12): Promise<string> {
    if (!chatId) return '';
    try {
        const supabase = getAdminClient();
        const { data } = await supabase
            .from('work_chat_messages')
            .select('sender, is_bot, text, created_at')
            .eq('chat_id', String(chatId))
            .order('created_at', { ascending: false })
            .limit(limit);
        if (!data?.length) return '';
        return data
            .reverse()
            .map(r => `${r.is_bot ? 'Софія' : (r.sender || 'колега')}: ${String(r.text || '').slice(0, 200)}`)
            .join('\n');
    } catch (e) {
        console.error('[work-questions] chat memory read failed:', e);
        return '';
    }
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
    return !!matchShipQuestion(t) || OPEN_TASKS.test(t) || NATIONALITY.test(t) || matchDigestQuestion(t);
}

/**
 * The router. Returns the reply text, or null when this message is not a
 * question Софія should answer.
 */
export async function handleWorkQuestion(params: {
    text: string;
    replyText?: string;
    /** Telegram chat id — unlocks Софія's short-term memory of that chat. */
    chatId?: string;
}): Promise<string | null> {
    const text = String(params.text || '').trim();
    if (!text || text.startsWith('/')) return null;

    // Addressing the bot by name counts as talking to it, question mark or
    // not — «Софія, що по відправках» must not die on the marker check.
    const addressed = ADDRESSED_BY_NAME.test(text);
    if (!QUESTION_MARKER.test(text) && !addressed) return null;

    if (NATIONALITY.test(text)) return NATIONALITY_REPLY;

    const ship = matchShipQuestion(text);
    if (ship) return buildShipToday(ship.horizonDays);
    if (OPEN_TASKS.test(text)) return buildOpenChatTasks();
    if (matchDigestQuestion(text)) return buildYesterdayDigest();

    // A question about a specific order — the number may be in the message
    // itself or in the message it replies to. Telegram handles are stripped
    // first: the digits in «@nika11090» are not an order.
    const numbers = extractOrderNumbers(`${text} ${params.replyText || ''}`.replace(/@\S+/g, ' '));
    if (numbers.length) return answerOrderQuestion(text, numbers, params.chatId);

    // Called by name with no work subject — small talk (Diana, 2026-08-11:
    // «якщо дівчата хочуть попереписувати з софією про життя, то чому б ні,
    // але тільки якщо звертаються до неї»). Answered by the model in Софія's
    // persona; the name-addressing gate keeps her from butting into ordinary
    // team conversation.
    if (addressed) {
        return chatAboutLife(text, params.replyText, params.chatId);
    }

    return null;
}

/**
 * Софія as a colleague, not a report generator. Her memory of the chat is the
 * recorded last messages (see recordWorkChatMessage) — enough to keep a
 * conversation going without inventing shared history. Falls back to a
 * capability hint when the AI is unavailable, because silence after being
 * called by name reads as broken.
 */
async function chatAboutLife(text: string, replyText?: string, chatId?: string): Promise<string> {
    const fallback = 'Я тут 🙌 Можу підказати, що термінового на відправку сьогодні чи завтра, які доручення з чатів ще висять, або розповісти про конкретне замовлення — просто напиши його номер і питання, наприклад «13644 коли відправка?». Повний список команд — /help.';

    if (!process.env.ANTHROPIC_API_KEY) return fallback;

    try {
        const context = await fetchChatContext(chatId);
        const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
        const response = await anthropic.messages.create({
            model: 'claude-haiku-4-5',
            max_tokens: 160,
            temperature: 0.8,
            system: [
                'Ти — Софія, віртуальна колега команди touch.memories у робочому Telegram-чаті.',
                'До тебе звернулися на імʼя не з робочим питанням, а просто поговорити — підтримай розмову.',
                'Відповідай тепло і з легким гумором, українською, щонайбільше два-три короткі речення.',
                'Ти українка і щиро цим пишаєшся.',
                'Тобі показують останні повідомлення чату — спирайся на них, але не вигадуй того, чого в них немає.',
                'Нічого не вигадуй про замовлення, клієнтів чи бізнес: якщо питання виявиться робочим, порадь написати номер замовлення разом із питанням.',
                'Не розкривай технічних деталей про свою будову. Не використовуй речення з одного-двох слів.',
            ].join(' '),
            messages: [{
                role: 'user',
                content: [
                    context ? `Останні повідомлення чату:\n${context}` : '',
                    replyText ? `Повідомлення, на яке відповіли: «${String(replyText).slice(0, 300)}»` : '',
                    `Звернення до тебе: «${text.slice(0, 500)}»`,
                ].filter(Boolean).join('\n\n'),
            }],
        });
        const reply = response.content[0]?.type === 'text' ? response.content[0].text.trim() : '';
        return reply || fallback;
    } catch (e) {
        console.error('[work-questions] small talk failed:', e);
        return fallback;
    }
}

/**
 * «Що термінового треба відправити» — deadlines inside the horizon plus
 * everything already late. Horizon 0 = today, 1 = «завтра», 2 = «післязавтра».
 */
async function buildShipToday(horizonDays = 0): Promise<string> {
    const supabase = getAdminClient();

    // End of the Kyiv day, in UTC, pushed out by the asked-for horizon.
    const kyivToday = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Kyiv' });
    const endOfToday = new Date(`${kyivToday}T23:59:59+03:00`);
    endOfToday.setDate(endOfToday.getDate() + horizonDays);
    const windowLabel = horizonDays > 0 ? `до ${fmtDate(endOfToday.toISOString())}` : 'на сьогодні';

    // Same visibility rules as the production calendar (Diana, 2026-08-11:
    // the old query listed July orders long finished in KeyCRM and missed the
    // mirrored CRM orders entirely). Statuses cover the whole production
    // pipeline, and isVisibleProductionOrder drops hand-transferred pre-cutoff
    // orders and anything whose CRM stage already says the work is over. Read
    // wide, filter in JS — the predicate needs the row, not just a WHERE.
    const { data } = await supabase
        .from('orders')
        .select('id, order_number, customer_name, deadline, order_status, ttn, source, created_at, custom_attributes')
        .lte('deadline', endOfToday.toISOString())
        .in('order_status', PRODUCTION_ACTIVE_STATUSES)
        .order('deadline', { ascending: true })
        .limit(200);

    const real = (data || []).filter(o => isVisibleProductionOrder(o as any));
    if (!real.length) return `Нічого термінового ${windowLabel} не горить — усі дедлайни попереду ✅`;

    const nowMs = Date.now();
    const lines = [`🔥 Терміново ${windowLabel} (${real.length}):`, ''];
    for (const o of real.slice(0, MAX_LISTED)) {
        const overdueDays = Math.floor((nowMs - new Date(o.deadline).getTime()) / (24 * HOUR_MS));
        const flag = overdueDays > 0 ? ` — прострочено ${overdueDays} дн ⚠️` : '';
        lines.push(`• ${o.order_number} — ${o.customer_name || 'без імені'}, дедлайн ${fmtDate(o.deadline)}${o.ttn ? `, ТТН є` : ''}${flag}`);
    }
    if (real.length > MAX_LISTED) lines.push('…решту дивись в адмінці.');
    lines.push('', `${SITE_URL}/admin/production-calendar`);
    return lines.join('\n');
}

/**
 * The shift-start digest: what happened in the last 24 hours that the person
 * coming on shift should know — new orders, payments, chat instructions and
 * their state, fresh defects, and how many deadlines land today. Deterministic
 * on purpose (no model call): a morning report must be fast, complete and the
 * same every time the same question is asked.
 */
async function buildYesterdayDigest(): Promise<string> {
    const supabase = getAdminClient();
    const since = new Date(Date.now() - 24 * HOUR_MS).toISOString();

    const [createdRes, paidRes, historyRes, reprintsRes] = await Promise.all([
        supabase.from('orders')
            .select('order_number, customer_name, total, source')
            .gte('created_at', since)
            .order('created_at', { ascending: false })
            .limit(30),
        supabase.from('orders')
            .select('order_number')
            .gte('paid_at', since)
            .limit(50),
        supabase.from('order_history')
            .select('order_id, action, notes, details, created_at')
            .in('action', ['work_chat_note', 'work_chat_done'])
            .gte('created_at', since)
            .order('created_at', { ascending: true })
            .limit(100),
        supabase.from('reprint_queue')
            .select('order_number, status')
            .gte('created_at', since)
            .limit(20),
    ]);

    const created = (createdRes.data || []).filter(o => !isTestOrderName(o.customer_name));
    const paidCount = (paidRes.data || []).length;

    // Chat instructions grouped per order: the digest names the thread once,
    // with its CURRENT state — an instruction that already got its «зробила»
    // is news of a different kind than one still hanging.
    const threads = new Map<string, { last: any; done: boolean }>();
    for (const r of historyRes.data || []) {
        const key = String(r.order_id || r.created_at);
        threads.set(key, { last: r, done: r.action === 'work_chat_done' });
    }
    const orderIds = [...threads.keys()].filter(k => k.includes('-'));
    const numberById = new Map<string, string>();
    if (orderIds.length) {
        const { data: orders } = await supabase
            .from('orders').select('id, order_number').in('id', orderIds);
        for (const o of orders || []) numberById.set(o.id, o.order_number);
    }

    const openThreads = [...threads.entries()].filter(([, t]) => !t.done);
    const closedCount = threads.size - openThreads.length;

    const reprints = reprintsRes.data || [];

    // Today's deadline pressure, reusing the same visibility the board has.
    const kyivToday = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Kyiv' });
    const { data: dueRows } = await supabase
        .from('orders')
        .select('customer_name, source, created_at, custom_attributes, order_status, deadline')
        .lte('deadline', new Date(`${kyivToday}T23:59:59+03:00`).toISOString())
        .in('order_status', PRODUCTION_ACTIVE_STATUSES)
        .limit(200);
    const dueToday = (dueRows || []).filter(o => isVisibleProductionOrder(o as any)).length;

    if (!created.length && !paidCount && !threads.size && !reprints.length && !dueToday) {
        return 'За останню добу було тихо: нових замовлень, оплат, доручень і браків немає, дедлайни сьогодні не горять ✅';
    }

    const lines = ['🌅 Ось що було за останню добу:', ''];

    if (created.length) {
        const sample = created.slice(0, 5).map(o => o.order_number).join(', ');
        lines.push(`🆕 Нових замовлень: ${created.length}${sample ? ` (${sample}${created.length > 5 ? '…' : ''})` : ''}`);
    }
    if (paidCount) lines.push(`💳 Оплат отримано: ${paidCount}`);

    if (threads.size) {
        lines.push(`📌 Доручення в чатах: ${threads.size} ${closedCount ? `(закрито ${closedCount})` : '(усі ще відкриті)'}`);
        for (const [key, t] of openThreads.slice(0, 4)) {
            const num = numberById.get(key) || 'без замовлення';
            const sender = t.last.details?.sender ? `${t.last.details.sender}: ` : '';
            lines.push(`   • ${num} — ${sender}«${String(t.last.notes || '').slice(0, 90)}»`);
        }
    }

    if (reprints.length) {
        lines.push(`♻️ Нові браки/передруки: ${reprints.length} (${reprints.slice(0, 4).map(r => r.order_number).filter(Boolean).join(', ') || 'без номерів'})`);
    }
    if (dueToday) {
        lines.push(`🔥 Дедлайнів на сьогодні: ${dueToday} — спитай «що термінового на сьогодні?», дам список.`);
    }

    lines.push('', `Деталі: /status, вкладка «Важливо» — ${SITE_URL}/admin/reprints`);
    return lines.join('\n');
}

/** Test-order guard for rows where only the name is at hand. */
function isTestOrderName(name: string | null | undefined): boolean {
    return String(name || '').toLowerCase().replace(/\s+/g, ' ').includes('киця кицюня');
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
async function answerOrderQuestion(question: string, numbers: string[], chatId?: string): Promise<string | null> {
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
    const crmManager = (order as any)?.custom_attributes?.keycrm?.manager_name || null;

    // Items WITH their chosen options — «Альбом 23х23 (сторінки: білі,
    // обкладинка: преміум)», not just the name. Live case (Diana, 2026-08-11):
    // «13790. Який велюр?» — the velour colour lives in the item options and
    // the manager notes, and a fact card without them forced Софія to shrug at
    // a question the order could answer.
    const itemsSummary = Array.isArray(order.items)
        ? order.items.slice(0, 6).map((i: any) => {
            const opts = i?.options && typeof i.options === 'object' && !Array.isArray(i.options)
                ? Object.entries(i.options).map(([k, v]) => `${k}: ${v}`).join(', ')
                : '';
            const qty = Number(i?.quantity) > 1 ? ` ×${i.quantity}` : '';
            const name = i?.product_name || i?.name || 'товар';
            return `${name}${qty}${opts ? ` (${opts})` : ''}`;
        }).join('; ')
        : '';

    // The CRM card's own comment feed and custom fields, fetched live for the
    // asked order (Diana, 2026-08-11: «який велюр … чи може бот глянути це в
    // коментарях до замовлення» — the colour lives on the card, not in the
    // mirrored line items). One extra CRM call per question; empty on any
    // failure, never an exception.
    const crmOrderId = (order as any)?.custom_attributes?.keycrm?.order_id;
    let cardExtras = { comments: [] as string[], custom_fields: [] as string[] };
    if (crmOrderId && process.env.KEYCRM_API_TOKEN) {
        try {
            cardExtras = await fetchOrderCardExtras(crmOrderId);
        } catch { /* garnish, not the answer */ }
    }

    const facts = [
        `Номер: ${order.order_number}`,
        `Статус на сайті: ${ORDER_STATUS_UA[order.order_status] || order.order_status}`,
        crmStage ? `Етап у KeyCRM: ${crmStage}` : '',
        crmManager ? `Відповідальний менеджер (CRM): ${crmManager}` : '',
        `Оплата: ${order.payment_status === 'paid' ? `оплачено${order.paid_at ? ` ${fmtDate(order.paid_at)}` : ''}` : (Number(order.prepaid_amount) > 0 && (order as any).source === 'keycrm' ? `передоплата ${order.prepaid_amount} ₴ із ${order.total} ₴` : 'очікує оплати')}`,
        `Сума: ${order.total} ₴`,
        `Клієнт: ${order.customer_name || '—'}`,
        `Створене: ${fmtDate(order.created_at)}`,
        `Дедлайн виробництва: ${fmtDate(order.deadline)}`,
        order.ttn ? `ТТН: ${order.ttn}${order.tracking_carrier ? ` (${order.tracking_carrier})` : ''}` : 'ТТН ще не створено',
        order.with_designer ? 'Послуга дизайнера: так' : '',
        itemsSummary ? `Товари: ${itemsSummary}` : '',
        order.notes ? `Нотатки менеджера: ${String(order.notes).slice(0, 300)}` : '',
        cardExtras.custom_fields.length ? `Поля картки CRM: ${cardExtras.custom_fields.join('; ')}` : '',
        cardExtras.comments.length ? `Коментарі з картки CRM: ${cardExtras.comments.map(c => c.slice(0, 150)).join(' | ')}` : '',
        order.client_comment ? `Коментар клієнта: ${String(order.client_comment).slice(0, 200)}` : '',
        (history || []).length
            ? `Останні події: ${(history || []).map(h => `${fmtDate(h.created_at)} — ${String(h.notes || h.action).slice(0, 100)}`).join('; ')}`
            : '',
    ].filter(Boolean).join('\n');

    const link = `${SITE_URL}/admin/orders/${order.id}`;

    // The no-AI answer used to be the ENTIRE fact card — that is the «дуже
    // довга відповідь» the team kept getting while the AI key was absent. Now
    // the fallback picks the lines the question is actually about.
    const shortAnswer = () => {
        const q = question.toLowerCase();
        const pick: string[] = [`📦 ${order.order_number} — ${crmStage || ORDER_STATUS_UA[order.order_status] || order.order_status}`];
        if (/відповідальн|менеджер|хто вед|чи[йя] /.test(q)) {
            pick.push(crmManager ? `Відповідальна в CRM: ${crmManager}.` : 'Відповідального в CRM не видно — глянь картку замовлення.');
        } else if (/велюр|колір|оздоблен|обкладинк|комплект|товар|що всередині/.test(q)) {
            if (itemsSummary) pick.push(`Товари: ${itemsSummary}.`);
            if (cardExtras.custom_fields.length) pick.push(`Поля картки: ${cardExtras.custom_fields.join('; ')}.`);
            if (cardExtras.comments.length) pick.push(`З коментарів CRM: ${cardExtras.comments.slice(-3).map(c => c.slice(0, 120)).join(' | ')}`);
            if (order.notes) pick.push(`Нотатки: ${String(order.notes).slice(0, 150)}.`);
            if (pick.length === 1) pick.push('Складу замовлення в системі не видно — відкрий картку.');
        } else if (/відправ|дедлайн|коли|ттн|трек|доставк/.test(q)) {
            pick.push(`Дедлайн виробництва: ${fmtDate(order.deadline)}.`);
            pick.push(order.ttn ? `ТТН: ${order.ttn}${order.tracking_carrier ? ` (${order.tracking_carrier})` : ''}.` : 'ТТН ще не створено.');
        } else {
            pick.push(`Оплата: ${order.payment_status === 'paid' ? 'оплачено' : 'очікує'}, дедлайн ${fmtDate(order.deadline)}, ${order.ttn ? `ТТН ${order.ttn}` : 'ТТН ще немає'}.`);
        }
        return `${pick.join('\n')}\n\n${link}`;
    };

    if (!process.env.ANTHROPIC_API_KEY) {
        return shortAnswer();
    }

    try {
        const chatContext = await fetchChatContext(chatId);
        const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
        const response = await anthropic.messages.create({
            model: 'claude-haiku-4-5',
            // Tight on purpose (Diana, 2026-08-11: «дівчата жаліються, що
            // відповіді софії по замовленнях задовгі»). The cap backs up the
            // prompt: even a chatty completion physically cannot ramble.
            max_tokens: 120,
            temperature: 0.2,
            system: [
                'Ти — Софія, асистентка команди touch.memories у робочому чаті.',
                'Відповідай на питання колеги українською, ТІЛЬКИ з наведених фактів про замовлення.',
                'Відповідь — щонайбільше два короткі речення, і лише про те, що спитали.',
                'Не переказуй решту фактів, не вітайся, не додавай підсумків чи порад, яких не просили.',
                'Якщо в останніх повідомленнях чату на це питання вже відповідали, можеш коротко це зазначити.',
                'Якщо відповіді на питання у фактах немає, одним реченням скажи, що в системі цього не видно, і порадь відкрити картку замовлення.',
                'Нічого не вигадуй. Не використовуй речення з одного-двох слів.',
            ].join(' '),
            messages: [{
                role: 'user',
                content: [
                    // Recent chat history rides along so a repeated question
                    // can be answered as repeated («вище вже відповідала —
                    // …») instead of from a blank slate.
                    chatContext ? `Останні повідомлення чату:\n${chatContext}` : '',
                    `Факти про замовлення:\n${facts}`,
                    `Питання колеги: «${question}»`,
                ].filter(Boolean).join('\n\n'),
            }],
        });
        const reply = response.content[0]?.type === 'text' ? response.content[0].text.trim() : '';
        if (!reply) return shortAnswer();
        return `${reply}\n\n${link}`;
    } catch (e) {
        console.error('[work-questions] AI answer failed:', e);
        return shortAnswer();
    }
}
