import { getAdminClient } from '@/lib/supabase/admin';

/**
 * Silent monitoring of work group chats.
 *
 * The team writes order instructions straight into group chats — «Andriy тач
 * меморіс 13808 обов'язково 12.08 відправити», «13362 змініть накладну». This
 * module catches any group message that mentions an order and lands it where
 * the work actually lives:
 *
 *   1. an `order_history` row → the note shows up in the admin order page's
 *      timeline, attributed to the chat and author;
 *   2. when the message carries a dd.MM date — the order's deadline is
 *      TIGHTENED to it (earlier-only, like CRM comment dates), so the order
 *      surfaces on the production calendar and in the morning digest.
 *
 * The bot never talks in the chat; the webhook acknowledges a captured
 * instruction with a silent ✍ reaction on the message instead.
 *
 * Order references understood: TM-001234 / CRM-13808 / PB-…, and the team's
 * shorthand — a bare 5-digit number («13808») — which is treated as a KeyCRM
 * id. A bare number followed by a currency marker («13500 грн») is a price,
 * not an order, and is ignored.
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
 * "Manager reports it's done" detector: the message names an order AND a
 * completion verb («відправила», «зроблено», «готово», «змінила»…) without a
 * negation right before it («ще не відправила» is NOT done). Deliberately
 * does NOT change the order status — words in a chat are a report, the real
 * closure comes from the TTN / CRM stage, which the existing syncs pick up.
 */
const DONE_WORDS = /(відправлен|відправил|зроблен|зробил|готово|виконан|змінил|оновил|передал|надіслал)/i;
const NEGATED = /(\bне\s+\S*|\bще\s+не\s+\S*)(відправ|зроб|готов|викон|змін|оновл|перед|надісл)/i;

export function looksDone(text: string): boolean {
    return DONE_WORDS.test(text) && !NEGATED.test(text);
}

export async function captureWorkChatOrderMentions(params: {
    text: string;
    chatTitle: string;
    senderName: string;
}): Promise<{ captured: string[]; done: boolean }> {
    const numbers = extractOrderNumbers(params.text);
    if (!numbers.length) return { captured: [], done: false };

    const supabase = getAdminClient();
    const due = extractDayMonth(params.text);
    const done = looksDone(params.text);
    const captured: string[] = [];

    for (const num of numbers.slice(0, 5)) {
        const { data: order } = await supabase
            .from('orders')
            .select('id, order_number, deadline')
            .eq('order_number', num)
            .maybeSingle();
        if (!order) continue;

        await supabase.from('order_history').insert({
            order_id: order.id,
            action: done ? 'work_chat_done' : 'work_chat_note',
            notes: done
                ? `Виконано (звіт у чаті «${params.chatTitle}», ${params.senderName}): «${params.text.slice(0, 300)}»`
                : `Доручення з чату «${params.chatTitle}» (${params.senderName}): «${params.text.slice(0, 300)}»`,
            details: {
                source: 'telegram_work_chat',
                chat: params.chatTitle,
                sender: params.senderName,
                date_found: due ? due.toISOString() : null,
                done,
            },
            added_by: null,
        });

        // A completion report must not tighten the deadline — «відправила
        // 12.08» is history, not a new commitment.
        if (due && !done) {
            const currentMs = order.deadline ? new Date(order.deadline).getTime() : null;
            if (!currentMs || due.getTime() < currentMs) {
                await supabase.from('orders').update({ deadline: due.toISOString() }).eq('id', order.id);
                await supabase.from('order_history').insert({
                    order_id: order.id,
                    action: 'deadline_tightened',
                    notes: `Дедлайн підтягнуто до ${due.toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit', timeZone: 'Europe/Kyiv' })} за повідомленням у чаті «${params.chatTitle}».`,
                    added_by: null,
                });
            }
        }

        captured.push(order.order_number);
    }

    return { captured, done };
}
