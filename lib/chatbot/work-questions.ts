import Anthropic from '@anthropic-ai/sdk';
import { getAdminClient } from '@/lib/supabase/admin';
import { clientDialogContext } from '@/lib/chatbot/client-chat-lookup';
import { extractOrderNumbers } from './work-chat-monitor';
import { isVisibleProductionOrder, PRODUCTION_ACTIVE_STATUSES } from '@/lib/automation/production-visibility';
import { ANDRIY_TAG, MAGNETS_TAG, PHOTO_TAG } from '@/lib/automation/order-tags';
import { answerFromMemory } from './open-questions';
import { mirrorSingleKeycrmOrder } from '@/lib/automation/keycrm-mirror';
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
// Diana, 2026-08-13: «якщо я тебе запитала, то давай повну відповідь» — a
// list she asked for is not shortened. The cap that remains is a sanity
// bound, and long messages are split across several Telegram posts.
const MAX_LISTED = 60;

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
const ADDRESSED_BY_NAME = /софі\p{L}*|sofi\p{L}*/iu;

/**
 * Addressed to the BOT, not merely mentioning a person who shares the name.
 * Live case: the bare message «Sofiia Gerega» (a teammate's full name) drew
 * the bot into the conversation. The name word immediately followed by a
 * capitalised word is somebody's ім'я та прізвище — «Софія Герега сьогодні
 * відправила» is about her, while «Софія, як справи» (punctuation or
 * lowercase after the name) is to the bot.
 */
function isAddressedToBot(text: string): boolean {
    const raw = String(text || '');
    const m = raw.match(ADDRESSED_BY_NAME);
    if (!m) return false;

    const after = raw.slice((m.index ?? 0) + m[0].length).replace(/^[ \t]+/, '');
    if (!/^[A-ZА-ЯІЇЄҐ]\p{L}+/u.test(after)) return true;

    // A capitalised word follows. That is a full name — «Sofiia Gerega
    // сьогодні відправила» — only when the message IS just the name. A live
    // miss: «Софія Скажи мені скільки замовлень…» went unanswered because the
    // capital in «Скажи» made it look like somebody's surname, and the team
    // capitalises the first word after the name all the time.
    const words = raw.trim().split(/\s+/);
    return words.length > 3;
}

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
    if (!QUESTION_MARKER.test(t) && !isAddressedToBot(t)) return false;
    if (extractOrderNumbers(t.replace(/@\S+/g, ' ')).length) return false;

    // A COUNTING question is not a digest, however many «вчора» and «було» it
    // contains. Live: «скільки замовлень з тегом терміновий з доплатою було
    // зроблено вчора» got the whole shift digest — twenty-two new orders and
    // eighteen chat instructions — because «вчора» + «було» matched here
    // first. Anything naming a tag, a count, stock or a person belongs to the
    // narrower handlers below.
    if (/(скільки|кількість|тег|таг|позначк|залиш|склад|менеджер|відповідальн)/iu.test(t)) return false;

    if (/(пропустил|пропустити|пропущен)/i.test(t)) return true;
    if (/(вчора|учора|за ніч|за добу)/i.test(t) && /(було|цікав|нов|стал|відбул|змінил)/i.test(t)) return true;
    return false;
}

export function matchShipQuestion(text: string): { horizonDays: number } | null {
    const t = String(text || '');
    if (!QUESTION_MARKER.test(t) && !isAddressedToBot(t)) return null;
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
 * The velour colour code as the team writes it on cards: «В-01», «в-11»,
 * occasionally with a Latin B. Returned exactly as many digits as written —
 * the code IS the answer, not something to normalise.
 */
/**
 * A colour named in words rather than by its code.
 *
 * Every velour colour has a number, and the number is the answer (Diana,
 * 2026-08-13). When there is none, a word like «бордовий» may still be in the
 * chat — worth reporting, but only as something somebody SAID, to be checked.
 * The word is only taken when it stands next to a colour subject, so «біле
 * вино» in a wedding conversation is not mistaken for a cover.
 */
const COLOUR_WORDS = /(бордов|пудров|беж|чорн|біл|син|блакитн|зелен|червон|рожев|сір|коричнев|кремов|мʼятн|мятн|лаванд|бірюз|персик|теракот|оливков|гірчичн|шоколадн|молочн|срібн|золот|фіолетов|бузков|марсал|капучін|карамель)\p{L}*/iu;

export function findSpokenColour(...texts: string[]): string | null {
    for (const raw of texts) {
        const text = String(raw || '');
        if (!text) continue;

        for (const sentence of text.split(/[\n.!?;]+/)) {
            if (!/(велюр|колір|кольор|обкладин)/i.test(sentence)) continue;
            const m = sentence.match(COLOUR_WORDS);
            if (m) return m[0].toLowerCase();
        }
    }
    return null;
}

export function findVelourCode(...texts: string[]): string | null {
    for (const t of texts) {
        const m = String(t || '').match(/(?<![\p{L}\d])[вВbB]\s?-\s?(\d{1,3})(?![\d])/u);
        if (m) return `В-${m[1]}`;
    }
    return null;
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
    /** The message this one replies to — the link that makes memory reliable. */
    replyToMessageId?: string;
}): Promise<void> {
    const text = String(params.text || '').trim();
    if (!chatId || !text) return;

    try {
        const supabase = getAdminClient();
        await supabase.from('work_chat_messages').insert({
            chat_id: String(chatId),
            message_id: params.messageId ? String(params.messageId) : null,
            reply_to_message_id: params.replyToMessageId ? String(params.replyToMessageId) : null,
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
    /** True when this message REPLIES to something Софія herself wrote. */
    repliedToBot?: boolean;
    /** True in a one-to-one dialog, where every message is addressed to her. */
    direct?: boolean;
    /** Telegram id of the message this one replies to. */
    replyToMessageId?: string;
    /** Who is asking — used to resolve «а колір який?» to their last order. */
    senderName?: string;
}): Promise<string | null> {
    const text = String(params.text || '').trim();
    if (!text || text.startsWith('/')) return null;

    // A reply to Софія's own stock clarification («Який саме цікавить?») is an
    // answer, not a question — «білих» alone must produce the number, so this
    // runs BEFORE the question-marker gate.
    if (params.replyText && params.replyText.includes('Який саме цікавить?')) {
        const clarified = await answerStockClarification(params.replyText, text);
        if (clarified) return clarified;
    }

    // Софія speaks only when spoken to (Diana, 2026-08-11: «якщо до Софії не
    // звертаються, не викликають її, то вона не має відповідати»).
    //
    // Three ways to call her, and nothing else: by name («Софія, що по
    // відправках»), by replying to one of her own messages, or in a private
    // dialog with her, where every message is addressed to her by definition.
    // A question mark is NOT a call — the team asks each other questions all
    // day, and a bot that answers them all is a bot everyone mutes.
    const addressed = isAddressedToBot(text) || !!params.repliedToBot || !!params.direct;
    if (!addressed) {
        // One exception, and it is not chatter: the same question asked again
        // in other words, when the chat already answered it (Diana,
        // 2026-08-12). The reply QUOTES that answer — who said it and when —
        // and stays silent when there is nothing to quote.
        return answerFromMemory({ chatId: params.chatId || '', text });
    }

    if (NATIONALITY.test(text)) return NATIONALITY_REPLY;

    // The tag count goes FIRST among the queue questions. It is the narrowest
    // of them and the most easily swallowed: «скільки замовлень з тегом
    // терміновий з доплатою було зроблено вчора» was answered with the whole
    // shift digest, because «вчора» plus «було» matched the digest first.
    if (TAG_WORD.test(text) && !extractOrderNumbers(text.replace(/@\S+/g, ' ')).length) {
        const tagReply = await buildTagOrders(text);
        if (tagReply) return tagReply;
    }

    const ship = matchShipQuestion(text);
    if (ship) return buildShipToday(ship.horizonDays);
    if (OPEN_TASKS.test(text)) return buildOpenChatTasks();
    if (matchDigestQuestion(text)) return buildYesterdayDigest();

    // «Скільки в нас залишилось маркерів на складі?» — stock by product name
    // (Diana, 2026-08-11: «чи можна щоб софія і залишки теж тягнула»).
    if (/(залиш|на склад|склад[іу]|наявн)/i.test(text)
        && !extractOrderNumbers(text.replace(/@\S+/g, ' ')).length) {
        const stockReply = await buildStockAnswer(text);
        if (stockReply) return stockReply;
    }

    // A question about a specific order — the number may be in the message
    // itself or in the message it replies to. Telegram handles are stripped
    // first: the digits in «@nika11090» are not an order.
    //
    // Resolved BEFORE the queue questions below, because a number changes what
    // the same words mean. Live case: «Хто відповідальний за замовлення 13815?»
    // was swallowed by the per-manager queue, which looked for a PERSON in the
    // text, found none and answered «Не впізнала імʼя відповідального» — while
    // the answer sat on the order the question named.
    let numbers = extractOrderNumbers(`${text} ${params.replyText || ''}`.replace(/@\S+/g, ' '));

    // A follow-up carries no number: «А колір обкладинки який?» right under
    // her own answer about 13852 (Diana, 2026-08-13). The thread knows which
    // order is meant, so the number is recovered from it before giving up.
    if (!numbers.length) {
        const carried = await carriedOrderNumber({
            chatId: params.chatId,
            replyToMessageId: params.replyToMessageId,
            senderName: params.senderName,
        });
        if (carried) numbers = [carried];
    }

    if (numbers.length) return answerOrderQuestion(text, numbers, params.chatId);

    // «Скільки активних замовлень з тегом для Андрія?» — the tag queue. Tags
    // are how the workshop routes work («для Андрія», «магніти», «фото») and
    // they are mirrored from KeyCRM onto the site card, so this is a plain
    // count, not something to hand back to a human. Gated on the word «тег» so
    // that ordinary sentences containing «фото» never trigger it.
    // Without the word «тег» the same question still arrives — «скільки
    // замовлень для Андрія сьогодні» — so it is tried too, but then only a
    // distinctive tag word counts (see requireStrongWord), never «фото».
    if (TAG_WORD.test(text) || /замовлен/i.test(text)) {
        const tagReply = await buildTagOrders(text, !TAG_WORD.test(text));
        if (tagReply) return tagReply;
    }

    // «Які не виконані замовлення у відповідального Оксана Мацьопа?» — the
    // per-manager queue (Diana, 2026-08-11).
    // The responsibility word is matched loosely because live questions come
    // with typos — «відпрвідального» must trigger the same as «відповідального»
    // (anchored on «дальн», so «відправити» stays a shipping word).
    const RESP_WORD = /(відповідальн|відп[а-яіїє]*дальн|менеджер|дизайнер|веде(?!\p{L})|(у|в)\s+кого)/iu;
    if (/(замовлен|черга|в роботі)/i.test(text) && RESP_WORD.test(text)) {
        const managerReply = await buildManagerOrders(text);
        if (managerReply) return managerReply;
    }

    // Called by name with no work subject — small talk (Diana, 2026-08-11:
    // «якщо дівчата хочуть попереписувати з софією про життя, то чому б ні,
    // але тільки якщо звертаються до неї»). Answered by the model in Софія's
    // persona; the name-addressing gate keeps her from butting into ordinary
    // team conversation.
    if (addressed) {
        // A work question she could not route is answered with a QUESTION, not
        // with pleasantries (Diana, 2026-08-12: «якщо не знає, то хай
        // запитує»). Only genuinely non-work talk reaches the chat model.
        const clarification = await clarifyWorkQuestion(text);
        if (clarification) return clarification;
        return chatAboutLife(text, params.replyText, params.chatId);
    }

    return null;
}

/**
 * The order a numberless follow-up is about.
 *
 * Two ways to recover it, both from what the chat actually holds:
 *  · the reply chain — the message being answered, and if that is one of
 *    Софія's own, the question SHE was answering, which is where the number
 *    was typed;
 *  · failing that, the last order this same person named in this chat within
 *    half an hour. Same person and a short window, because in a chat of
 *    thirteen the last number overall belongs to somebody else's thread.
 *
 * Returns null rather than a guess, and then the clarifier asks for a number.
 */
async function carriedOrderNumber(params: {
    chatId?: string;
    replyToMessageId?: string;
    senderName?: string;
}): Promise<string | null> {
    if (!params.chatId) return null;

    try {
        const supabase = getAdminClient();

        if (params.replyToMessageId) {
            const { data: replied } = await supabase
                .from('work_chat_messages')
                .select('text, reply_to_message_id')
                .eq('chat_id', params.chatId)
                .eq('message_id', params.replyToMessageId)
                .limit(1);

            const row: any = replied?.[0];
            if (row) {
                const direct = extractOrderNumbers(String(row.text || '').replace(/@\S+/g, ' '));
                if (direct.length) return direct[0];

                if (row.reply_to_message_id) {
                    const { data: parent } = await supabase
                        .from('work_chat_messages')
                        .select('text')
                        .eq('chat_id', params.chatId)
                        .eq('message_id', row.reply_to_message_id)
                        .limit(1);
                    const up = extractOrderNumbers(String(parent?.[0]?.text || '').replace(/@\S+/g, ' '));
                    if (up.length) return up[0];
                }
            }
        }

    } catch (e) {
        console.error('[work-questions] carried order lookup failed:', e);
    }

    return null;
}

/**
 * The one thing missing that would let her answer.
 *
 * Every branch above needs a handle: an order number, a tag name, a product.
 * When the message is clearly about work but carries none of them, the useful
 * reply is the question that unblocks it — «який тег?», «який номер?» — and it
 * is written deterministically, because this is precisely the moment when a
 * model invents a helpful-sounding sentence that helps nobody.
 *
 * Returns null for non-work messages, which then go to the chat persona.
 */
async function clarifyWorkQuestion(text: string): Promise<string | null> {
    const t = text.toLowerCase();

    if (TAG_WORD.test(t)) {
        const known = await knownTagNames();
        const list = known.length ? ` Зараз у нас такі: ${known.slice(0, 12).join(', ')}.` : '';
        return `Не зрозуміла, про який саме тег ідеться.${list} Напиши назву тегу — і я порахую, за сьогодні чи за будь-який період.`;
    }

    if (/(замовлен|заказ)/i.test(t)) {
        return 'Напиши номер замовлення — і я гляну статус, дедлайн, оплату чи склад. Без номера можу хіба порахувати чергу за тегом або за менеджером, тоді скажи, за яким саме.';
    }

    if (/(залиш|склад|наявн)/i.test(t)) {
        return 'Скажи, який саме товар цікавить — маркери, коробки, плівка — і я подивлюся залишок у CRM.';
    }

    return null;
}

/** Tag names currently in the site's tag list, mirrored from the CRM. */
async function knownTagNames(): Promise<string[]> {
    try {
        const supabase = getAdminClient();
        const { data } = await supabase.from('order_tags').select('name').order('sort_order').limit(30);
        return (data || []).map((r: any) => String(r.name || '')).filter(Boolean);
    } catch {
        return [];
    }
}

/**
 * Софія as a colleague, not a report generator. Her memory of the chat is the
 * recorded last messages (see recordWorkChatMessage) — enough to keep a
 * conversation going without inventing shared history. Falls back to a
 * capability hint when the AI is unavailable, because silence after being
 * called by name reads as broken.
 */
async function chatAboutLife(text: string, replyText?: string, chatId?: string): Promise<string> {
    // When Софія has no answer of her own, she hands over to a human (Diana,
    // 2026-08-11: «якщо софія не може відповісти, то хай тагає
    // @Alina_Avlastsova в чаті») — the tag pings Аліна, and the second
    // sentence keeps the handoff useful instead of a dead end.
    const fallback = 'Тут я, на жаль, не підкажу — @Alina_Avlastsova, глянь, будь ласка 🙏 А мене можна питати про відправки на сьогодні чи завтра, відкриті доручення, або про конкретне замовлення за його номером.';

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
                // Live case: asked to count orders by tag, she replied «я не маю
                // доступу до CRM» — she has it, she simply had no handler for that
                // question. Claiming the opposite teaches the team not to ask.
                'Ніколи не кажи, що не маєш доступу до CRM, до сайту чи до даних: доступ у тебе є. Якщо саме це питання ти порахувати не вмієш, чесно скажи, що поки не вмієш саме так рахувати, і попроси переформулювати або звернутися до дівчат.',
                // Live case: «дай мені хвилинку порахувати… щойно скажу
                // результат», after which nothing ever came. She has no way to
                // come back later — this message IS the whole answer.
                'Ти не можеш нічого зробити пізніше: у тебе немає можливості повернутися з відповіддю згодом. Ніколи не обіцяй «зараз порахую», «дай хвилинку», «повернуся з результатом». Або відповідай зараз, або чесно кажи, що не порахуєш.',
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
    return lines.join('\n');
}

// Words of a stock question that are not the product's name.
const STOCK_STOP_WORDS = new Set([
    'софія', 'софіє', 'софійка', 'скільки', 'залишилось', 'залишилося',
    'залишків', 'лишилось', 'лишилося', 'склад', 'складі', 'складу',
    'наявності', 'наявність', 'зараз', 'будь', 'ласка', 'підкажи', 'маємо',
]);

/**
 * Word stems tolerant to Ukrainian inflection, progressively shorter:
 * «маркерів»→«маркер», «білих»→«біл», «кутиками»→«кутик» (live case — the
 * single fixed-length cut produced «кутика», which «Кутики…» does not
 * contain, and the clarification reply fell through to the full list).
 */
function stemVariants(w: string): string[] {
    const out = [w];
    if (w.length > 4) out.push(w.slice(0, w.length - 2));
    if (w.length > 5) out.push(w.slice(0, w.length - 3));
    return out;
}

// The tail of every clarification message — the follow-up detector keys on it.
const STOCK_CLARIFY_TAIL = 'Який саме цікавить? Відпиши одним словом — назву цифру.';

async function fetchActiveProducts(): Promise<any[]> {
    const supabase = getAdminClient();
    const { data } = await supabase
        .from('products')
        .select('slug, name, stock, is_active')
        .order('name')
        .limit(1000);
    return (data || []).filter((p: any) => p.is_active !== false);
}

async function stockLines(products: any[]): Promise<string[]> {
    const supabase = getAdminClient();
    const { data: crmRows } = await supabase
        .from('keycrm_product_map')
        .select('site_slug, keycrm_stock')
        .in('site_slug', products.map((p: any) => p.slug))
        .eq('confirmed', true)
        .not('keycrm_stock', 'is', null);
    const crmBySlug = new Map<string, number>();
    for (const r of crmRows || []) {
        crmBySlug.set(r.site_slug, (crmBySlug.get(r.site_slug) || 0) + Number(r.keycrm_stock));
    }

    return products.map((p: any) => {
        const crm = crmBySlug.get(p.slug);
        const site = Number(p.stock);
        const siteLabel = site >= 999 ? 'без ліку' : `${site} шт`;
        const crmLabel = crm !== undefined && crm !== site ? ` (склад CRM: ${crm})` : '';
        return `• ${p.name} — ${siteLabel}${crmLabel}`;
    });
}

/**
 * Stock by product name (Diana, 2026-08-11: «софія скільки в нас залишилось
 * маркерів на складі»). One matching product answers with its number right
 * away. Several matches — «в нас є чотири види маркерів» — get NAMED, and
 * Софія asks which one (Diana: «софія має їх назвати та уточнити які саме, і
 * коли хтось відпише білих, вона має назвати цифру»); the reply is handled by
 * answerStockClarification, which recognises her own question by its tail
 * phrase. Null when nothing matches, so the router falls through.
 */
async function buildStockAnswer(question: string): Promise<string | null> {
    const stems = String(question)
        .toLowerCase()
        .replace(/@\S+/g, ' ')
        .split(/[^\p{L}\p{N}]+/u)
        .filter(w => w.length >= 4 && !STOCK_STOP_WORDS.has(w))
        .flatMap(stemVariants);
    if (!stems.length) return null;

    const products = await fetchActiveProducts();
    const matched = products.filter((p: any) =>
        stems.some(s => String(p.name || '').toLowerCase().includes(s)));
    if (!matched.length || matched.length > 25) return null;

    if (matched.length === 1) {
        const lines = await stockLines(matched);
        return `📦 ${lines[0].replace(/^• /, '')}`;
    }

    // Full product names on purpose: the follow-up finds the candidates by
    // matching these names back out of the quoted clarification message.
    const names = matched.slice(0, 15).map((p: any) => p.name).join('; ');
    return `У нас ${matched.length} ${matched.length < 5 ? 'види' : 'видів'}: ${names}. ${STOCK_CLARIFY_TAIL}`;
}

/**
 * The «білих» reply to Софія's stock clarification. Candidates are the full
 * product names inside the quoted clarification; the reply's word stems pick
 * one (or a few) of them, and the answer is their numbers. An unrecognised
 * reply answers with ALL the candidates' numbers — better complete than mute.
 */
async function answerStockClarification(replyText: string, answer: string): Promise<string | null> {
    const products = await fetchActiveProducts();
    const candidates = products.filter((p: any) => replyText.includes(p.name));
    if (!candidates.length) return null;

    const stems = String(answer)
        .toLowerCase()
        .replace(/@\S+/g, ' ')
        .split(/[^\p{L}\p{N}]+/u)
        .filter(w => w.length >= 3 && !STOCK_STOP_WORDS.has(w))
        .flatMap(stemVariants);

    let chosen = stems.length
        ? candidates.filter((p: any) => stems.some(s => String(p.name).toLowerCase().includes(s)))
        : [];
    if (!chosen.length) chosen = candidates;

    const lines = await stockLines(chosen.slice(0, 15));
    return chosen.length === 1
        ? `📦 ${lines[0].replace(/^• /, '')}`
        : [`📦 Залишки:`, '', ...lines].join('\n');
}

/**
 * The word that makes a question a tag question.
 *
 * «таг» with an А is how the team actually types it — Diana's own live
 * question was «скільки замовлень додали сьогодні в срм з тагом для Андрія»,
 * and a тег-only pattern missed it, so the question fell through to small talk.
 */
const TAG_WORD = /(тег|теґ|таг|теґ|tag|позначк)/iu;

/** Tag words too ordinary to identify a tag on their own. */
const GENERIC_TAG_WORDS = new Set([
    'оплата', 'оплату', 'оплати', 'доставка', 'доставкою', 'доставки', 'перед',
    'фото', 'сайт', 'наявності', 'наявність', 'журналу', 'замовлення', 'клієнту',
    'клієнтці', 'дані', 'відправити', 'зробити', 'тільки',
]);

/**
 * «за останні 5 днів», «за тиждень», «сьогодні» — the window a question asks
 * about, in days, or null when it asks about the current state. Diana,
 * 2026-08-11: «скільки замовлень з тегом для Андрія за останні 5 днів».
 */
/** Midnight in Kyiv, `daysAgo` days back, as a timestamp. */
function kyivMidnight(daysAgo = 0): number {
    const now = new Date();
    const kyiv = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Kyiv' }));
    const offset = now.getTime() - kyiv.getTime();
    kyiv.setHours(0, 0, 0, 0);
    kyiv.setDate(kyiv.getDate() - daysAgo);
    return kyiv.getTime() + offset;
}

function matchDayWindow(text: string): { since: number; until: number | null; label: string } | null {
    const t = text.toLowerCase();

    const explicit = t.match(/за\s+(?:останн[іїяе]\w*\s+)?(\d{1,3})\s*(день|дні|днів|дн)/u);
    if (explicit) {
        const days = parseInt(explicit[1], 10);
        if (days > 0 && days <= 365) {
            return { since: Date.now() - days * 24 * HOUR_MS, until: null, label: `за останні ${days} дн.` };
        }
    }

    // Calendar days in Kyiv, not rolling 24-hour windows: an order added
    // yesterday at 23:00 is not «сьогодні» at 09:00, and «вчора» ends at
    // midnight rather than trailing into today.
    if (/(за\s+)?сьогодн/u.test(t)) return { since: kyivMidnight(0), until: null, label: 'за сьогодні' };
    if (/(за\s+)?(вчора|учора)/u.test(t)) return { since: kyivMidnight(1), until: kyivMidnight(0), label: 'за вчора' };
    // «за цей тиждень» is the week we are in, from Monday — not the last seven
    // days (Diana asked whether she would understand it; she does now).
    if (/(цей|цього|поточн\w*|з\s+понеділка)\s*\w*\s*(тижд|тижн)/u.test(t)) {
        const kyiv = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Kyiv' }));
        const mondayOffset = (kyiv.getDay() + 6) % 7;
        return { since: kyivMidnight(mondayOffset), until: null, label: 'за цей тиждень' };
    }
    if (/(цей|цього|поточн\w*)\s*\w*\s*місяц/u.test(t)) {
        const kyiv = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Kyiv' }));
        return { since: kyivMidnight(kyiv.getDate() - 1), until: null, label: 'за цей місяць' };
    }
    if (/тижд|тижн|за\s+неділ/u.test(t)) return { since: Date.now() - 7 * 24 * HOUR_MS, until: null, label: 'за останній тиждень' };
    if (/місяц|місяць/u.test(t)) return { since: Date.now() - 30 * 24 * HOUR_MS, until: null, label: 'за останній місяць' };
    return null;
}

/**
 * Orders carrying a tag — «скільки активних замовлень з тегом для Андрія».
 *
 * Live case (Diana, 2026-08-11, with a screenshot): Софія answered «я не маю
 * доступу до CRM та не можу лічити замовлення по тегам», which is simply not
 * true — the mirror writes KeyCRM tags onto every order card (see
 * keycrm-mirror), and the workshop's own routing tags are added on top. So the
 * count is a query, and the model never has to guess at it.
 *
 * Which tag was meant is decided the same way as a manager name: a tag matches
 * when the stem of one of its words appears in the question, so «для Андрія»
 * answers to «Андрія», «Андрію» and «Андрій» alike. Case is ignored throughout:
 * the CRM writes «Для Андрія», the auto-tagger writes «для Андрія», and they
 * are the same tag.
 *
 * Two questions, two scopes. Without a period the answer is the CURRENT queue —
 * active orders only. With one («за останні 5 днів») it is everything CREATED in
 * that window whatever its state now, because that question is about volume,
 * not about what is left to do.
 */
async function buildTagOrders(question: string, requireStrongWord = false): Promise<string | null> {
    const supabase = getAdminClient();
    const window = matchDayWindow(question);

    let query = supabase
        .from('orders')
        .select('id, order_number, customer_name, deadline, order_status, source, created_at, tags, custom_attributes');

    if (window) {
        query = query.gte('created_at', new Date(window.since).toISOString());
        if (window.until) query = query.lt('created_at', new Date(window.until).toISOString());
        query = query.order('created_at', { ascending: false }).limit(600);
    } else {
        query = query.in('order_status', PRODUCTION_ACTIVE_STATUSES).order('deadline', { ascending: true }).limit(400);
    }

    const { data } = await query;
    const scoped = (data || []).filter(o => isVisibleProductionOrder(o as any));
    const tagsOf = (o: any): string[] => (Array.isArray(o?.tags) ? o.tags : []).map((t: any) => String(t || '').trim()).filter(Boolean);

    // The tag universe, keyed lower-case so «Для Андрія» and «для Андрія» are
    // one entry. Includes the workshop's own routing tags even when nothing
    // carries them right now — «скільки для Андрія?» on a quiet day must
    // answer «жодного», not fall through to a guess.
    const display = new Map<string, string>();
    const hits = new Map<string, number>();
    const addTag = (tag: string) => {
        const key = tag.toLowerCase();
        if (!display.has(key)) display.set(key, tag);
        hits.set(key, 0);
    };
    for (const tag of [ANDRIY_TAG, MAGNETS_TAG, PHOTO_TAG]) addTag(tag);
    // The WHOLE dictionary, not only what the window happens to contain. Live
    // miss (Diana, 2026-08-13): «сьогодні були замовлення зі статусом
    // „Терміновий з доплатою"?» was answered about «Оплата перед доставкою»,
    // because no order today carried the asked-for tag, so it was not among
    // the candidates at all and the nearest word-match won. A tag that exists
    // and has no orders must answer «жодного».
    for (const name of await knownTagNames()) addTag(name);
    for (const o of scoped) for (const tag of tagsOf(o)) addTag(tag);

    // Matching is word-to-word, not substring-in-sentence: «оплата» must not
    // be found inside «доплатою», which is how «Оплата перед доставкою» beat
    // «Терміновий з доплатою» on a question about the latter.
    const questionWords = question
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\s]/gu, ' ')
        .split(/\s+/)
        .filter(Boolean);

    for (const key of hits.keys()) {
        let score = 0;
        let strong = false;
        for (const word of key.split(/\s+/)) {
            const stem = word.length > 4 ? word.slice(0, word.length - 2) : word;
            if (stem.length < 3) continue;
            const matched = questionWords.some(w => w.startsWith(stem) || stem.startsWith(w.slice(0, Math.max(3, w.length - 2))) && w.length >= 4);
            if (!matched) continue;
            score++;
            // A long word is what makes a match trustworthy without the word
            // «тег» in the question: «андрі» identifies a tag, «фото» appears
            // in half the sentences this shop writes. Words that name ordinary
            // business things — оплата, доставка, сайт — never carry a tag on
            // their own either, or «скільки замовлень оплачено сьогодні?»
            // would be answered as the tag «Оплата перед доставкою».
            if (word.length >= 5 && !GENERIC_TAG_WORDS.has(word)) strong = true;
        }
        hits.set(key, requireStrongWord && !strong ? 0 : score);
    }
    // A one-word coincidence loses to a two-word match, and a tag whose words
    // ALL appear wins outright.
    const ranked = [...hits.entries()]
        .filter(([, score]) => score > 0)
        .sort((a, b) => {
            const coverage = (k: string, s: number) => s / Math.max(1, k.split(/\s+/).filter(w => w.length >= 3).length);
            return (b[1] - a[1]) || (coverage(b[0], b[1]) - coverage(a[0], a[1]));
        });
    if (!ranked.length) return null;

    const [key] = ranked[0];
    const tag = display.get(key) || key;
    const mine = scoped.filter(o => tagsOf(o).some(t => t.toLowerCase() === key));
    const scopeNote = window ? ` ${window.label}` : '';
    if (!mine.length) {
        return window
            ? `Замовлень з тегом «${tag}» ${window.label} не було.`
            : `Активних замовлень з тегом «${tag}» зараз немає — усе, що було, вже поїхало або чекає на іншому етапі.`;
    }

    const lines = [window
        ? `🏷 Тег «${tag}»${scopeNote} — ${mine.length}:`
        : `🏷 Тег «${tag}» — активні замовлення (${mine.length}):`, ''];
    for (const o of mine.slice(0, MAX_LISTED)) {
        const stage = (o as any)?.custom_attributes?.keycrm?.status_label || ORDER_STATUS_UA[o.order_status] || o.order_status;
        lines.push(`• ${o.order_number} — ${stage}, дедлайн ${fmtDate(o.deadline)}${o.customer_name ? `, ${o.customer_name}` : ''}`);
    }
    return lines.join('\n');
}

/**
 * Active orders of ONE manager, matched by name from the question.
 *
 * The CRM's manager rides on every mirrored order
 * (custom_attributes.keycrm.manager_name, refreshed each reconcile pass), so
 * «які не виконані замовлення у менеджера Оксана Мацьопа?» is a plain filter.
 * Names are matched by word STEMS because Ukrainian inflects them — «у
 * Мацьопи», «в Оксани» — and the stage in «Статус „прийнято"» becomes a
 * substring filter on the live CRM stage when present.
 */
async function buildManagerOrders(question: string): Promise<string | null> {
    const supabase = getAdminClient();

    const { data } = await supabase
        .from('orders')
        .select('id, order_number, customer_name, deadline, order_status, source, created_at, custom_attributes')
        .in('order_status', PRODUCTION_ACTIVE_STATUSES)
        .order('deadline', { ascending: true })
        .limit(400);

    const active = (data || []).filter(o => isVisibleProductionOrder(o as any));

    // Which known responsible person is named in the question? A name word
    // matches when its stem (all but the last two letters) appears in the
    // text, so «Мацьопа/Мацьопи/Мацьопі» all count. Requiring ANY word of the
    // full name keeps «Оксана» alone working while two Оксани would both
    // match — then the longer (more words matched) one wins.
    const q = question.toLowerCase();
    const managers = new Map<string, number>();
    for (const o of active) {
        const name = String((o as any)?.custom_attributes?.keycrm?.manager_name || '').trim();
        if (name) managers.set(name, 0);
    }
    for (const name of managers.keys()) {
        let hits = 0;
        for (const word of name.toLowerCase().split(/\s+/)) {
            const stem = word.length > 4 ? word.slice(0, word.length - 2) : word;
            if (stem.length >= 3 && q.includes(stem)) hits++;
        }
        managers.set(name, hits);
    }
    const ranked = [...managers.entries()].filter(([, hits]) => hits > 0).sort((a, b) => b[1] - a[1]);
    if (!ranked.length) {
        return 'Не впізнала імʼя відповідального серед активних замовлень — напиши його так, як воно записане в KeyCRM, і я перерахую.';
    }
    const [managerName] = ranked[0];

    // Optional stage filter: «Статус „прийнято"» or quoted stage words.
    const stageMatch = question.match(/статус[^«"']*[«"']([^»"']{2,40})[»"']/iu);
    const stageFilter = stageMatch ? stageMatch[1].toLowerCase().trim() : null;

    let mine = active.filter(o =>
        String((o as any)?.custom_attributes?.keycrm?.manager_name || '').trim() === managerName);
    if (stageFilter) {
        mine = mine.filter(o =>
            String((o as any)?.custom_attributes?.keycrm?.status_label || '').toLowerCase().includes(stageFilter));
    }

    const stageNote = stageFilter ? ` зі статусом «${stageFilter}»` : '';
    if (!mine.length) {
        return `У ${managerName} зараз немає активних замовлень${stageNote} — або в CRM відповідальним стоїть хтось інший.`;
    }

    const lines = [`👩‍💼 ${managerName} — активні замовлення${stageNote} (${mine.length}):`, ''];
    for (const o of mine.slice(0, MAX_LISTED)) {
        const stage = (o as any)?.custom_attributes?.keycrm?.status_label || ORDER_STATUS_UA[o.order_status] || o.order_status;
        lines.push(`• ${o.order_number} — ${stage}, дедлайн ${fmtDate(o.deadline)}${o.customer_name ? `, ${o.customer_name}` : ''}`);
    }
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

    lines.push('', 'Деталі — команда /status або вкладка «Важливо» в адмінці.');
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
/** Everything an order answer can need, in one place. */
const ORDER_FIELDS = 'id, order_number, order_status, payment_status, total, prepaid_amount, customer_name, customer_phone, deadline, ttn, tracking_carrier, created_at, paid_at, with_designer, items, custom_attributes, source, notes, client_comment, delivery_method, delivery_address';

async function answerOrderQuestion(question: string, numbers: string[], chatId?: string): Promise<string | null> {
    const supabase = getAdminClient();

    const { data: matches } = await supabase
        .from('orders')
        .select(ORDER_FIELDS)
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
                .select(ORDER_FIELDS)
                .eq('custom_attributes->keycrm->>order_id', crmId)
                .limit(1);
            if (adopted?.[0]) { order = adopted[0]; break; }
        }
    }

    // Not in the mirror — which is not the same as «does not exist». The
    // mirror keeps the last 14 days; Diana asked «13500 яка країна?» about an
    // order from June and got «не знайшла в базі», while the card sat in
    // KeyCRM the whole time. Pull that one card on demand and answer from it.
    if (!order) {
        for (const num of numbers) {
            const crmId = num.startsWith('CRM-') ? num.slice(4) : (/^\d{4,6}$/.test(num) ? num : '');
            if (!crmId) continue;
            try {
                const pulled = await mirrorSingleKeycrmOrder(crmId);
                if (!pulled) continue;
                const { data: fresh } = await supabase
                    .from('orders')
                    .select(ORDER_FIELDS)
                    .eq('order_number', `CRM-${crmId}`)
                    .limit(1);
                if (fresh?.[0]) { order = fresh[0]; break; }
            } catch (e) {
                console.error('[work-questions] on-demand CRM pull failed:', e);
            }
        }
    }

    if (!order) {
        return `Замовлення ${numbers.join(' / ')} не знайшла ні на сайті, ні в KeyCRM. Перевір номер, будь ласка.`;
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

    // The velour colour is written as a code on the card — «В-01», «в-11» —
    // usually inside the specification comment (Diana, 2026-08-11: «в-11 це
    // колір велюру»). Fished out of every text the order carries, so the
    // answer can name it directly instead of quoting paragraphs.
    //
    // The client's own dialog is read BEFORE the facts are assembled, because
    // the colour usually lives there and nowhere else (Diana, 2026-08-13:
    // «кожен колір має свій номер, зазвичай в чаті будуть номери»).
    const clientDialog = await clientDialogContext(order as any);

    const velourCode = findVelourCode(
        cardExtras.comments.join('\n'),
        String(order.notes || ''),
        String(order.client_comment || ''),
        itemsSummary,
        clientDialog,
    );

    // A colour named in WORDS is not the same fact as a code. Diana: «якщо
    // немає саме номера, то називати не треба — можна написати, що людина
    // сказала бордовий, але треба перевірити чат». So the word is reported as
    // what somebody said, never as the order's colour.
    const spokenColour = velourCode ? null : findSpokenColour(
        clientDialog,
        cardExtras.comments.join('\n'),
        String(order.notes || ''),
        String(order.client_comment || ''),
    );

    const facts = [
        `Номер: ${order.order_number}`,
        `Статус на сайті: ${ORDER_STATUS_UA[order.order_status] || order.order_status}`,
        crmStage ? `Етап у KeyCRM: ${crmStage}` : '',
        crmManager ? `Відповідальний менеджер (CRM): ${crmManager}` : '',
        velourCode ? `Колір велюру (код): ${velourCode}` : '',
        spokenColour ? `УВАГА: коду кольору ніде немає. У переписці/коментарях звучить слово «${spokenColour}» — це НЕ підтверджений колір, треба перевірити чат із клієнтом.` : '',
        `Оплата: ${order.payment_status === 'paid' ? `оплачено${order.paid_at ? ` ${fmtDate(order.paid_at)}` : ''}` : (Number(order.prepaid_amount) > 0 && (order as any).source === 'keycrm' ? `передоплата ${order.prepaid_amount} ₴ із ${order.total} ₴` : 'очікує оплати')}`,
        `Сума: ${order.total} ₴`,
        `Клієнт: ${order.customer_name || '—'}`,
        // Delivery, not just its method: «13500 яка країна?» is a normal
        // question and the address is where the answer lives.
        (order as any).delivery_address ? `Доставка: ${(order as any).delivery_address}` : '',
        (order as any).delivery_method ? `Спосіб доставки: ${(order as any).delivery_method}` : '',
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

    // The admin-card link is attached ONLY when it is asked for (Diana,
    // 2026-08-11: «прибери ось ці посилання з відповідей, тільки якщо тебе
    // запитують») — in a phone chat the long URL was most of the message.
    const link = /посилан|лінк|link|url/i.test(question)
        ? `\n\n${SITE_URL}/admin/orders/${order.id}`
        : '';

    // The no-AI answer used to be the ENTIRE fact card — that is the «дуже
    // довга відповідь» the team kept getting while the AI key was absent. Now
    // the fallback picks the lines the question is actually about.
    const shortAnswer = () => {
        const q = question.toLowerCase();
        const pick: string[] = [`📦 ${order.order_number} — ${crmStage || ORDER_STATUS_UA[order.order_status] || order.order_status}`];
        if (/відповідальн|менеджер|хто вед|чи[йя] /.test(q)) {
            pick.push(crmManager ? `Відповідальна в CRM: ${crmManager}.` : 'Відповідального в CRM не видно — глянь картку замовлення.');
        } else if (/велюр|колір|оздоблен|обкладинк|комплект|товар|що всередині/.test(q)) {
            if (velourCode) pick.push(`Колір велюру: ${velourCode}.`);
            if (!velourCode && spokenColour) pick.push(`Коду кольору немає. У переписці звучить «${spokenColour}» — варто перевірити в чаті з клієнтом.`);
            if (itemsSummary) pick.push(`Товари: ${itemsSummary}.`);
            if (!velourCode && cardExtras.custom_fields.length) pick.push(`Поля картки: ${cardExtras.custom_fields.join('; ')}.`);
            if (!velourCode && cardExtras.comments.length) pick.push(`З коментарів CRM: ${cardExtras.comments.slice(-3).map(c => c.slice(0, 120)).join(' | ')}`);
            if (!velourCode && order.notes) pick.push(`Нотатки: ${String(order.notes).slice(0, 150)}.`);
            if (pick.length === 1) pick.push('Складу замовлення в системі не видно — відкрий картку.');
        } else if (/країн|місто|адрес|куди|відділен|нова пошта|получател|одержувач/.test(q)) {
            const address = (order as any).delivery_address;
            pick.push(address ? `Доставка: ${address}.` : 'Адреси доставки в картці немає — скажи, куди дивитися, або уточни в клієнта.');
            if ((order as any).delivery_method) pick.push(`Спосіб: ${(order as any).delivery_method}.`);
        } else if (/відправ|дедлайн|коли|ттн|трек|доставк/.test(q)) {
            pick.push(`Дедлайн виробництва: ${fmtDate(order.deadline)}.`);
            pick.push(order.ttn ? `ТТН: ${order.ttn}${order.tracking_carrier ? ` (${order.tracking_carrier})` : ''}.` : 'ТТН ще не створено.');
        } else {
            pick.push(`Оплата: ${order.payment_status === 'paid' ? 'оплачено' : 'очікує'}, дедлайн ${fmtDate(order.deadline)}, ${order.ttn ? `ТТН ${order.ttn}` : 'ТТН ще немає'}.`);
        }
        return `${pick.join('\n')}${link}`;
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
            max_tokens: 300,
            temperature: 0.2,
            system: [
                'Ти — Софія, асистентка команди touch.memories у робочому чаті.',
                'Відповідай на питання колеги українською, ТІЛЬКИ з наведених фактів про замовлення.',
                'Відповідай стисло і лише про те, що спитали — але не губи деталей: якщо питання стосується кількох деталей (тип обкладинки, надпис, що на останній сторінці), назви їх усі.',
                'Не переказуй решту фактів, не вітайся, не додавай підсумків чи порад, яких не просили.',
                'Якщо в останніх повідомленнях чату на це питання вже відповідали, можеш коротко це зазначити.',
                'Спершу шукай відповідь у фактах про замовлення. Якщо там її немає — подивись у переписці з клієнтом, і тоді ОБОВʼЯЗКОВО зазнач, що це з переписки, і назви дату.',
                // Live: «мені не вистачає доступу до телеграм-переписки з
                // клієнтом» — she has it, the dialogs are stored; that
                // particular dialog just was not matched to the order.
                'Ніколи не кажи, що не маєш доступу до переписки з клієнтом чи до CRM: доступ у тебе є. Якщо переписки цього клієнта тобі не показали або в ній цього немає — так і скажи: у знайдених повідомленнях цього немає.',
                // Diana, 2026-08-13: «кожен колір має свій номер… якщо немає
                // саме номера, то називати не треба — можна написати, людина
                // сказала бордовий, але треба перевірити чат».
                'Колір велюру називай ТІЛЬКИ кодом (наприклад В-11). Якщо коду немає, не подавай колір як факт: скажи, що коду немає, і що в переписці звучало таке-то слово, яке варто перевірити в чаті з клієнтом.',
                // Diana, 2026-08-12: «якщо Софія знає відповідь, то відповідає…
                // а якщо не знає, то хай запитує». Not knowing is fine; a vague
                // reply that neither answers nor asks is what wastes the team's
                // time, because nobody can tell what to do with it.
                'Якщо немає ні там, ні там, скажи одним реченням, чого саме бракує в даних, і постав одне конкретне уточнювальне питання колезі — наприклад, попроси код кольору, номер, дату чи назву товару.',
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
                    clientDialog,
                    `Питання колеги: «${question}»`,
                ].filter(Boolean).join('\n\n'),
            }],
        });
        const reply = response.content[0]?.type === 'text' ? response.content[0].text.trim() : '';
        if (!reply) return shortAnswer();
        return `${reply}${link}`;
    } catch (e) {
        console.error('[work-questions] AI answer failed:', e);
        return shortAnswer();
    }
}
