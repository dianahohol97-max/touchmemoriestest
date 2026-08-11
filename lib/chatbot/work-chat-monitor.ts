import { getAdminClient } from '@/lib/supabase/admin';

/**
 * Silent monitoring of work group chats.
 *
 * The team writes order instructions straight into group chats — «Andriy тач
 * меморіс 13808 обов'язково 12.08 відправити», «13362 змініть накладну». This
 * module catches any group message that mentions an order and lands it where
 * the work actually lives:
 *
 *   1. an `order_history` row (action `work_chat_note` / `work_chat_done`) —
 *      visible in the admin order page timeline;
 *   2. when an instruction carries a dd.MM date — the order's deadline is
 *      TIGHTENED to it (earlier-only, like CRM comment dates), so the order
 *      surfaces on the production calendar and in the morning digest.
 *
 * Orders that are not in the site DB yet (fresh KeyCRM orders arrive via the
 * hourly mirror) go to a pending queue (`settings.work_chat_pending_mentions`)
 * and are attached by `processPendingMentions()` — called from the 15-minute
 * telegram-webhook-sync cron — as soon as the mirror delivers them. Entries
 * expire after 48h.
 *
 * Completion reports without an order number are attributed two ways:
 * a Telegram reply inherits the number from the message it answers, and a
 * bare «зробила» falls back to the chat's last directly-mentioned order if
 * that was within 2 hours. Deliberately NO status change from chat words —
 * the real closure is the TTN / CRM stage, which existing syncs propagate.
 *
 * The bot never talks in the chat; the webhook acknowledges with a reaction:
 * ✍ = instruction captured, 👌 = completion report recorded.
 *
 * Order references understood: TM-001234 / CRM-13808 / PB-…, and the team's
 * shorthand — a bare 5-digit number («13808»), treated as a KeyCRM id. A
 * bare number followed by a currency marker («13500 грн») is a price and is
 * ignored.
 */

const PREFIXED = /\b(TM|CRM|PB)[-\s]?(\d{3,6})\b/gi;
const BARE = /(?<![\d.,:+-])(\d{5})(?![\d])/g;

export function extractOrderNumbers(text: string): string[] {
    const found = new Set<string>();
    for (const m of text.matchAll(PREFIXED)) {
        const prefix = m[1].toUpperCase();
        found.add(prefix === 'TM' ? `TM-${m[2].padStart(6, '0')}` : `${prefix}-${m[2]}`);
    }
    for (const m of text.matchAll(BARE)) {
        const tail = text.slice((m.index ?? 0) + m[1].length, (m.index ?? 0) + m[1].length + 8).toLowerCase();
        if (/грн|₴|uah|€|eur|\$/.test(tail)) continue; // price, not an order
        found.add(`CRM-${m[1]}`);
    }
    return [...found];
}

/** First dd.MM in the text → a Date (09:00 UTC ≈ Kyiv midday); rolls to next year when the date is far in the past. */
export function extractDayMonth(text: string): Date | null {
    const m = text.match(/(?<![\d.])([0-3]?\d)[./]([01]?\d)(?![\d])/);
    if (!m) return null;
    const day = parseInt(m[1], 10);
    const month = parseInt(m[2], 10);
    if (day < 1 || day > 31 || month < 1 || month > 12) return null;
    const now = new Date();
    const candidate = new Date(Date.UTC(now.getUTCFullYear(), month - 1, day, 9, 0, 0));
    if (!Number.isFinite(candidate.getTime())) return null;
    if (candidate.getTime() < Date.now() - 30 * 24 * 60 * 60 * 1000) {
        candidate.setUTCFullYear(candidate.getUTCFullYear() + 1);
    }
    return candidate;
}

/**
 * "Manager reports it's done" detector: a completion verb («відправила»,
 * «зроблено», «готово», «змінила»…) without a negation right before it
 * («ще не відправила» is NOT done).
 */
const DONE_WORDS = /(відправлен|відправил|зроблен|зробил|готово|виконан|змінил|оновил|передал|надіслал)/i;
// No \b here: JavaScript's \b only knows ASCII word characters, so against
// Cyrillic text `\bне` never matches and the old guard was dead code — «Які
// доручення ще не виконані?» read as a completion report and closed a live
// task (CRM-13534, caught by Diana). The boundary is spelled out instead:
// start-of-text or a separator, then optional «ще», then «не» right before
// the verb (possibly with one word in between: «не буде відправлено»).
const NEGATED = /(?:^|[\s,;:().«»"'-])(?:ще\s+)?не\s+\S{0,15}?(відправ|зроб|готов|викон|змін|оновл|перед|надісл)/i;

export function looksDone(text: string): boolean {
    return DONE_WORDS.test(text) && !NEGATED.test(text);
}

/**
 * A real ANSWER to a question closes the thread (Diana, 2026-08-11: «якщо
 * запитання отримало реальну відповідь — коли доставка: завтра, коли
 * відправка: 13 числа — то ставити виконаним»). Counts only when the message
 * REPLIES to a question and itself names a time: «завтра», a weekday, a
 * dd.MM date, «13 числа». A counter-question («а хто знає?») closes nothing.
 */
const ANSWER_TIME = /(завтра|сьогодні|післязавтра|наступн\S*\s+тижн|понеділ|вівтор|серед[уиі]|четвер|п.ятниц|субот|неділ|(?<![\d.,:])[0-3]?\d[./][01]?\d(?![\d])|[0-3]?\d\s*(числа|серпня|вересня|жовтня|листопада|грудня|січня|лютого|березня|квітня|травня|червня|липня))/i;

export function looksAnswered(text: string, replyText?: string): boolean {
    if (!replyText || !replyText.includes('?')) return false;
    if (text.includes('?')) return false;
    return ANSWER_TIME.test(text);
}

/**
 * Which chat messages deserve to become a task on the order card.
 *
 * Diana, 2026-08-11, after eleven rows piled up on 13790 — «13790. Який
 * велюр?» repeated by three people, «хто відповідальний», a test message:
 * «не треба це все записувати в коментарі, в адмінку і в замовлення, тільки
 * релевантний і підсумковий».
 *
 * A QUESTION is not an instruction. Софія answers it in the chat and the
 * answer is the end of it; nothing lands on the card. What lands there is what
 * somebody has to DO: a named date, a completion report, or an imperative.
 * Everything is still recorded in the chat history Софія reads, so nothing is
 * lost — it simply stops filling the order card and the CRM comment.
 */
const INSTRUCTION_WORDS = /(треба|потрібно|необхідно|обовʼязково|обов'язково|терміново|зроб|переробити|переробіть|відправ|надішл|надісл|додай|додати|постав|постав\w*|помін|заміни|виправ|уточни|уточніть|перевір|звʼяжіть|звяжіть|зателефон|передзвон|напиши|напишіть|не забуд|швидше|прискор|скасуй|скасувати|притримай|притримати)/iu;

export function looksLikeInstruction(text: string, hasDate: boolean, done: boolean): boolean {
    if (done || hasDate) return true;
    const t = String(text || '');
    // A question mark alone settles it: «13790. Який велюр?» is a question even
    // though «велюр» sits next to words that look operational.
    if (t.includes('?')) return false;
    return INSTRUCTION_WORDS.test(t);
}

type PendingMention = {
    num: string;
    text: string;
    chat: string;
    sender: string;
    due: string | null;
    done: boolean;
    ts: string;
};

async function readSetting(supabase: any, key: string): Promise<any | null> {
    const { data } = await supabase.from('settings').select('value').eq('key', key).maybeSingle();
    return data?.value ?? null;
}

async function writeSetting(supabase: any, key: string, value: any): Promise<void> {
    const { error } = await supabase
        .from('settings')
        .upsert({ key, value, updated_at: new Date().toISOString() });
    if (error) console.error(`[work-chat] failed to save ${key}:`, error);
}

/** Attach one mention to an order if it exists. Returns false when the order is not in the DB (yet). */
async function attachToOrder(supabase: any, orderNum: string, p: {
    text: string;
    chat: string;
    sender: string;
    due: Date | null;
    done: boolean;
}): Promise<boolean> {
    let { data: order } = await supabase
        .from('orders')
        .select('id, order_number, deadline')
        .eq('order_number', orderNum)
        .maybeSingle();

    // A bare CRM number may belong to a HAND-TRANSFERRED site order: the CRM
    // card 13707 is never mirrored (site source), but TM-001149 carries
    // keycrm.order_id=13707 since the adoption pass tied them together. Found
    // live when an instruction about 13707 could not attach anywhere.
    if (!order && orderNum.startsWith('CRM-')) {
        const bare = orderNum.slice(4);
        const { data: adopted } = await supabase
            .from('orders')
            .select('id, order_number, deadline')
            .eq('custom_attributes->keycrm->>order_id', bare)
            .limit(1);
        order = adopted?.[0] || null;
    }
    if (!order) return false;

    // The same instruction repeated (a manager re-sends it, two people say the
    // same thing, a test message is fired five times) is ONE task, not five.
    const { data: recent } = await supabase
        .from('order_history')
        .select('id, notes')
        .eq('order_id', order.id)
        .in('action', ['work_chat_note', 'work_chat_done'])
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .limit(30);
    const fingerprint = p.text.toLowerCase().replace(/\s+/g, ' ').trim();
    if ((recent || []).some((r: any) => String(r.notes || '').toLowerCase().includes(fingerprint))) {
        return true;
    }

    await supabase.from('order_history').insert({
        order_id: order.id,
        action: p.done ? 'work_chat_done' : 'work_chat_note',
        notes: p.done
            ? `Виконано (звіт у чаті «${p.chat}», ${p.sender}): «${p.text.slice(0, 300)}»`
            : `Доручення з чату «${p.chat}» (${p.sender}): «${p.text.slice(0, 300)}»`,
        details: {
            source: 'telegram_work_chat',
            chat: p.chat,
            sender: p.sender,
            date_found: p.due ? p.due.toISOString() : null,
            done: p.done,
        },
        added_by: null,
    });

    // A completion report must not tighten the deadline — «відправила 12.08»
    // is history, not a new commitment.
    if (p.due && !p.done) {
        const currentMs = order.deadline ? new Date(order.deadline).getTime() : null;
        if (!currentMs || p.due.getTime() < currentMs) {
            // deadline_locked: a date a PERSON named owns the deadline from
            // here on — the mirror's resolver must not recompute over it.
            const { data: cur } = await supabase
                .from('orders')
                .select('custom_attributes')
                .eq('id', order.id)
                .maybeSingle();
            const attrs = (cur?.custom_attributes && typeof cur.custom_attributes === 'object')
                ? cur.custom_attributes as Record<string, any>
                : {};

            await supabase.from('orders').update({
                deadline: p.due.toISOString(),
                custom_attributes: { ...attrs, deadline_locked: true },
            }).eq('id', order.id);
            await supabase.from('order_history').insert({
                order_id: order.id,
                action: 'deadline_tightened',
                notes: `Дедлайн підтягнуто до ${p.due.toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit', timeZone: 'Europe/Kyiv' })} за повідомленням у чаті «${p.chat}».`,
                added_by: null,
            });
        }
    }
    return true;
}

export async function captureWorkChatOrderMentions(params: {
    text: string;
    replyText?: string;
    chatId: string | number;
    chatTitle: string;
    senderName: string;
}): Promise<{ captured: string[]; pending: string[]; done: boolean }> {
    const supabase = getAdminClient();

    // Telegram handles carry digits that read exactly like order numbers —
    // «@nika11090» once pulled the long-delivered April order 11090 out of
    // the CRM. Mentions are stripped before any number is extracted.
    const cleanText = params.text.replace(/@\S+/g, ' ');
    const cleanReply = params.replyText ? params.replyText.replace(/@\S+/g, ' ') : undefined;

    // A completion report OR a real answer to a question — either resolves
    // the thread.
    const done = looksDone(cleanText) || looksAnswered(cleanText, cleanReply);

    // Attribution ladder: numbers in the message itself → numbers in the
    // replied-to message → (completion reports only) the chat's last
    // directly-mentioned order within 2 hours.
    let numbers = extractOrderNumbers(cleanText);
    let noteText = params.text;
    if (!numbers.length && cleanReply) {
        numbers = extractOrderNumbers(cleanReply);
        if (numbers.length) noteText = `${params.text} (відповідь на: «${String(params.replyText || '').slice(0, 120)}»)`;
    }
    if (!numbers.length && done) {
        const lastMap = (await readSetting(supabase, 'work_chat_last_mention')) || {};
        const last = lastMap[String(params.chatId)];
        if (last?.num && last?.ts && Date.now() - new Date(last.ts).getTime() < 2 * 60 * 60 * 1000) {
            numbers = [String(last.num)];
            noteText = `${params.text} (звіт без номера — віднесено до останнього згаданого замовлення в чаті)`;
        }
    }
    if (!numbers.length) return { captured: [], pending: [], done };

    const due = extractDayMonth(params.text);

    // Questions and idle mentions stay in the chat — see looksLikeInstruction.
    if (!looksLikeInstruction(noteText, !!due, done)) {
        return { captured: [], pending: [], done };
    }
    const captured: string[] = [];
    const pendingNew: string[] = [];

    for (const num of numbers.slice(0, 5)) {
        const ok = await attachToOrder(supabase, num, {
            text: noteText,
            chat: params.chatTitle,
            sender: params.senderName,
            due,
            done,
        });
        if (ok) captured.push(num);
        else pendingNew.push(num);
    }

    // Orders not in the DB yet (the hourly KeyCRM mirror hasn't delivered
    // them) wait in the queue; the 15-minute cron attaches them later.
    if (pendingNew.length) {
        const queue: PendingMention[] = (await readSetting(supabase, 'work_chat_pending_mentions')) || [];
        const ts = new Date().toISOString();
        for (const num of pendingNew) {
            queue.push({
                num,
                text: noteText.slice(0, 300),
                chat: params.chatTitle,
                sender: params.senderName,
                due: due ? due.toISOString() : null,
                done,
                ts,
            });
        }
        await writeSetting(supabase, 'work_chat_pending_mentions', queue.slice(-100));
    }

    // Remember the chat's latest direct mention so a bare «зробила» right
    // after has something to attach to.
    const direct = extractOrderNumbers(params.text);
    if (direct.length) {
        const lastMap = (await readSetting(supabase, 'work_chat_last_mention')) || {};
        lastMap[String(params.chatId)] = { num: direct[0], ts: new Date().toISOString() };
        await writeSetting(supabase, 'work_chat_last_mention', lastMap);
    }

    return { captured, pending: pendingNew, done };
}

/**
 * Drain the pending queue: attach mentions whose orders have since arrived
 * (KeyCRM mirror runs hourly), keep the rest, drop entries older than 48h.
 */
export async function processPendingMentions(): Promise<{ attached: number; kept: number }> {
    const supabase = getAdminClient();
    const queue: PendingMention[] = (await readSetting(supabase, 'work_chat_pending_mentions')) || [];
    if (!queue.length) return { attached: 0, kept: 0 };

    const cutoff = Date.now() - 48 * 60 * 60 * 1000;
    const keep: PendingMention[] = [];
    let attached = 0;

    for (const p of queue) {
        if (!p?.num || !p?.ts || new Date(p.ts).getTime() < cutoff) continue;
        let ok = await attachToOrder(supabase, p.num, {
            text: p.text,
            chat: p.chat,
            sender: p.sender,
            due: p.due ? new Date(p.due) : null,
            done: !!p.done,
        });

        // Still absent — usually an OLD CRM order outside the mirror's recency
        // window (found live: «запитайте чи можна зняти 13020»). Pull that one
        // order from KeyCRM by id and retry, so an instruction about any order
        // the CRM knows lands on a real card instead of dying in this queue
        // after 48 hours.
        if (!ok && p.num.startsWith('CRM-')) {
            try {
                const { mirrorSingleKeycrmOrder } = await import('@/lib/automation/keycrm-mirror');
                if (await mirrorSingleKeycrmOrder(p.num.slice(4))) {
                    ok = await attachToOrder(supabase, p.num, {
                        text: p.text,
                        chat: p.chat,
                        sender: p.sender,
                        due: p.due ? new Date(p.due) : null,
                        done: !!p.done,
                    });
                }
            } catch (e) {
                console.error('[work-chat] single-order rescue failed:', e);
            }
        }

        if (ok) attached++;
        else keep.push(p);
    }

    await writeSetting(supabase, 'work_chat_pending_mentions', keep);
    return { attached, kept: keep.length };
}
