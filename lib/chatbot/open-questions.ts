import { getAdminClient } from '@/lib/supabase/admin';
import { extractOrderNumbers } from './work-chat-monitor';

/**
 * Questions asked in the work chat, and what becomes of them.
 *
 * Two rules from Diana (2026-08-12), which together replace «every message
 * with a number becomes a task on the card»:
 *
 *  1. A question is not a task — but an UNANSWERED question is a problem. So a
 *     question about an order waits an hour. If somebody answers it in the
 *     chat, it disappears without trace. If nobody does, it lands in «Важливо»
 *     marked as an open question, not as an instruction.
 *
 *  2. «Якщо хтось запитує те саме різними формулюваннями — Софія має
 *     відповісти з памʼяті. Але жодних вигадувань.» So a repeat of a question
 *     the chat already answered is answered by QUOTING that answer, with who
 *     said it and when. Nothing is composed: if there is no answer in the
 *     chat's stored messages, Софія stays silent and the question starts its
 *     own hour.
 */

const HOUR_MS = 60 * 60 * 1000;
const QUEUE_KEY = 'work_chat_open_questions';
const MINUTES_KEY = 'open_question_minutes';
const DEFAULT_MINUTES = 60;
/** A question older than this is history, not something to answer from. */
const MEMORY_DAYS = 7;

export type OpenQuestion = {
    id: string;
    chatId: string;
    chatTitle: string;
    messageId: string | null;
    sender: string;
    text: string;
    numbers: string[];
    ts: string;
};

async function readQueue(supabase: any): Promise<OpenQuestion[]> {
    const { data } = await supabase.from('settings').select('value').eq('key', QUEUE_KEY).maybeSingle();
    return Array.isArray(data?.value) ? data.value : [];
}

async function writeQueue(supabase: any, queue: OpenQuestion[]): Promise<void> {
    const { error } = await supabase
        .from('settings')
        .upsert({ key: QUEUE_KEY, value: queue.slice(-200), updated_at: new Date().toISOString() });
    if (error) console.error('[open-questions] queue write failed:', error);
}

/** «?» or a question word — the same test the router uses to stay quiet. */
export function isQuestion(text: string): boolean {
    const t = String(text || '');
    if (t.includes('?')) return true;
    return /(?<!\p{L})(що|шо|коли|який|яка|яке|які|чи|скільки|де|хто|кому|чому)(?!\p{L})/iu.test(t);
}

/**
 * Messages that answer nothing, whoever wrote them: Софія's own misses and a
 * colleague's «не знаю». Quoting one back as «це вже питали» would present a
 * dead end as a resolution.
 */
const NON_ANSWER = /(не знайшл|не видно|не підкаж|не зрозумі|напиши номер|перевір номер|це вже питали|не вмію|не знаю|хз|уточни)/i;

/** Words worth comparing two questions by: four letters or more, lower-cased. */
function significantWords(text: string): string[] {
    return String(text || '')
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\s]/gu, ' ')
        .split(/\s+/)
        .filter(w => w.length >= 4);
}

/**
 * The same question in other words. An order number shared by both is the
 * strongest signal; otherwise two long words in common («велюр», «відправка»)
 * — one is not enough, «коли» and «замовлення» are in every second message.
 */
function sameQuestion(a: string, b: string): boolean {
    const numsA = extractOrderNumbers(a.replace(/@\S+/g, ' '));
    const numsB = extractOrderNumbers(b.replace(/@\S+/g, ' '));
    const sharedNumber = numsA.some(n => numsB.includes(n));

    // Two DIFFERENT orders are two different questions, however identically
    // they are worded. Live: «13745 питає за макет, коли буде?» was answered
    // with what had been said about 12916 — the same sentence about another
    // customer's order, which is exactly the kind of confident wrong answer
    // that destroys trust in the whole thing.
    if (numsA.length && numsB.length && !sharedNumber) return false;

    const wordsA = new Set(significantWords(a));
    const wordsB = significantWords(b).filter(w => wordsA.has(w));
    // «замовлення» and «сьогодні» are shared by half the chat, so the count
    // ignores the words that carry no topic.
    const topical = wordsB.filter(w => !/(замовлен|сьогодн|завтра|будь|ласка|дякую|скажи|підкажи)/.test(w));

    if (sharedNumber) return topical.length >= 1 || wordsB.length >= 2;
    return topical.length >= 2;
}

/** Записати питання, яке чекає на відповідь. */
export async function noteOpenQuestion(params: {
    chatId: string | number;
    chatTitle: string;
    messageId: string | number | null;
    sender: string;
    text: string;
}): Promise<void> {
    const numbers = extractOrderNumbers(String(params.text).replace(/@\S+/g, ' '));
    if (!numbers.length) return; // an open question needs an order to hang on

    try {
        const supabase = getAdminClient();
        const queue = await readQueue(supabase);

        // The same question asked twice is one open question, not two.
        if (queue.some(q => q.chatId === String(params.chatId) && sameQuestion(q.text, params.text))) return;

        queue.push({
            id: `${params.chatId}:${params.messageId || Date.now()}`,
            chatId: String(params.chatId),
            chatTitle: params.chatTitle,
            messageId: params.messageId ? String(params.messageId) : null,
            sender: params.sender,
            text: String(params.text).slice(0, 400),
            numbers,
            ts: new Date().toISOString(),
        });
        await writeQueue(supabase, queue);
    } catch (e) {
        console.error('[open-questions] note failed:', e);
    }
}

/**
 * A new message in the chat closes the questions it answers: a reply to the
 * question itself, or any non-question message naming the same order.
 */
export async function resolveOpenQuestions(params: {
    chatId: string | number;
    text: string;
    replyToMessageId?: string | number | null;
}): Promise<number> {
    try {
        const supabase = getAdminClient();
        const queue = await readQueue(supabase);
        if (!queue.length) return 0;

        const chatId = String(params.chatId);
        const text = String(params.text || '');
        const replyTo = params.replyToMessageId ? String(params.replyToMessageId) : null;
        const answers = !isQuestion(text);
        const numbers = extractOrderNumbers(text.replace(/@\S+/g, ' '));

        const kept = queue.filter(q => {
            if (q.chatId !== chatId) return true;
            if (replyTo && q.messageId === replyTo) return false;
            if (answers && numbers.some(n => q.numbers.includes(n))) return false;
            return true;
        });

        if (kept.length !== queue.length) await writeQueue(supabase, kept);
        return queue.length - kept.length;
    } catch (e) {
        console.error('[open-questions] resolve failed:', e);
        return 0;
    }
}

/**
 * Questions nobody answered within the window become items in «Важливо»,
 * labelled as questions rather than instructions. Run from the 15-minute cron.
 */
export async function promoteStaleQuestions(): Promise<{ promoted: number }> {
    const supabase = getAdminClient();
    let promoted = 0;

    try {
        const queue = await readQueue(supabase);
        if (!queue.length) return { promoted: 0 };

        const { data: setting } = await supabase
            .from('settings').select('value').eq('key', MINUTES_KEY).maybeSingle();
        const raw = parseFloat(String(setting?.value ?? ''));
        const minutes = Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_MINUTES;

        const cutoff = Date.now() - minutes * 60 * 1000;
        const keep: OpenQuestion[] = [];

        for (const q of queue) {
            const age = new Date(q.ts).getTime();
            if (!Number.isFinite(age)) continue;
            // Too young to worry about — it may still get an answer.
            if (age > cutoff) { keep.push(q); continue; }
            // Older than a day with nobody promoting it: the order was never
            // found in the database, and repeating the search forever is noise.
            if (age < Date.now() - 24 * HOUR_MS) continue;

            let attached = false;
            for (const num of q.numbers) {
                if (await attachQuestion(supabase, num, q, minutes)) { attached = true; break; }
            }
            if (!attached) keep.push(q);
            else promoted++;
        }

        await writeQueue(supabase, keep);
    } catch (e) {
        console.error('[open-questions] promotion failed:', e);
    }

    return { promoted };
}

async function attachQuestion(supabase: any, orderNum: string, q: OpenQuestion, minutes: number): Promise<boolean> {
    let { data: order } = await supabase
        .from('orders').select('id').eq('order_number', orderNum).maybeSingle();

    if (!order && orderNum.startsWith('CRM-')) {
        const { data: adopted } = await supabase
            .from('orders').select('id')
            .eq('custom_attributes->keycrm->>order_id', orderNum.slice(4)).limit(1);
        order = adopted?.[0] || null;
    }
    if (!order) return false;

    await supabase.from('order_history').insert({
        order_id: order.id,
        action: 'work_chat_note',
        notes: `❓ Відкрите питання з чату «${q.chatTitle}» (${q.sender}): «${q.text}» — ніхто не відповів за ${Math.round(minutes)} хв.`,
        details: {
            source: 'telegram_work_chat',
            kind: 'open_question',
            chat: q.chatTitle,
            sender: q.sender,
            asked_at: q.ts,
        },
        added_by: null,
    });
    return true;
}

/**
 * The answer this chat already gave to this question.
 *
 * Retrieval only — the reply quotes a stored message verbatim, names who wrote
 * it and when. When nothing matches, null, and Софія says nothing at all.
 */
export async function answerFromMemory(params: {
    chatId: string | number;
    text: string;
}): Promise<string | null> {
    const text = String(params.text || '');
    if (!isQuestion(text)) return null;

    // Only questions that NAME an order are answered from memory. Everything
    // else was guesswork: «13745 питає за макет» was answered with what had
    // been said about 12916, and «13500 яка країна» with «Софія мовчи!!!»,
    // because the old version took whatever message happened to follow.
    const numbers = extractOrderNumbers(text.replace(/@\S+/g, ' '));
    if (!numbers.length) return null;
    const bare = numbers.map(n => n.replace(/\D/g, '')).filter(Boolean);

    try {
        const supabase = getAdminClient();
        const { data: rows } = await supabase
            .from('work_chat_messages')
            .select('message_id, reply_to_message_id, sender, is_bot, text, created_at')
            .eq('chat_id', String(params.chatId))
            .gte('created_at', new Date(Date.now() - MEMORY_DAYS * 24 * HOUR_MS).toISOString())
            .order('created_at', { ascending: true })
            .limit(600);
        if (!rows?.length) return null;

        const mentionsOrder = (t: string) => bare.some(n => t.includes(n));
        const quotable = (row: any) => {
            const t = String(row.text || '').trim();
            return !!t && !isQuestion(t) && !NON_ANSWER.test(t) && t.length >= 3;
        };

        // Every earlier asking of this same thing, newest first.
        const asked = rows.filter(r => {
            const t = String(r.text || '');
            return t !== text && isQuestion(t) && sameQuestion(t, text);
        });

        for (let i = asked.length - 1; i >= 0; i--) {
            const question = asked[i];
            const askedAt = new Date(question.created_at).getTime();

            // An answer is tied to its question in one of exactly two ways:
            // it REPLIES to it, or it names the same order. Adjacency alone is
            // not a tie — that is what quoted «Софія мовчи!!!» as an answer
            // about a country.
            const candidates = rows.filter(r => {
                const when = new Date(r.created_at).getTime();
                if (when < askedAt || when - askedAt > 24 * HOUR_MS) return false;
                if (!quotable(r)) return false;
                if (question.message_id && r.reply_to_message_id === question.message_id) return true;
                return mentionsOrder(String(r.text || ''));
            });

            // Prefer a human's answer to Софія's own — a person's word about
            // an order outranks the bot's summary of it.
            const chosen = candidates.find(c => !c.is_bot) || candidates[0];
            if (!chosen) continue;

            const when = new Date(chosen.created_at).toLocaleString('uk-UA', {
                day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Kyiv',
            });
            const who = chosen.is_bot ? 'Софія' : (chosen.sender || 'колега');
            return `Це вже питали в чаті. ${when}, ${who}: «${String(chosen.text).slice(0, 300)}»`;
        }
    } catch (e) {
        console.error('[open-questions] memory answer failed:', e);
    }

    return null;
}
