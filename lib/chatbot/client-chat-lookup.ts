import { getAdminClient } from '@/lib/supabase/admin';

/**
 * Answers that live only in the client's own chat.
 *
 * Diana, 2026-08-11: «яка обкладинка по замовленню такому-то — і ти йшла в
 * CRM чи сайт, якщо там нічого немає, тоді в чат з цим клієнтом»; and then
 * «по адресу — люди з чату вказують дані для доставки». Both are the same
 * gap: a detail the customer typed in a Telegram dialog and nobody copied
 * into the order — the velour colour, the cover, the Nova Poshta branch,
 * who receives the parcel.
 *
 * ЯК ЦЕ ПРАЦЮЄ ТЕПЕР (2026-09-14) І ЧОМУ ІНАКШЕ, НІЖ РАНІШЕ.
 *
 * Діалог береться за ЗБЕРЕЖЕНОЮ привʼязкою: social_conversations.order_id,
 * проставлений матчером public.link_social_conversations. До цього кожне
 * питання запускало пошук наосліп — по тексту всіх повідомлень шукався
 * телефон, а як не знаходився, то довге слово з імені клієнта. Саме іменний
 * крок і виявився небезпечним: у чаті звучить не тільки імʼя самого клієнта, а
 * й імʼя того, кому книга в подарунок, і того, на кого накладна. Перевірка на
 * бойових даних 14.09.2026 дала двадцять два збіги за іменем, з яких добра
 * половина була чужою перепискою, а найгірший випадок — діалог фотографа на
 * три тисячі повідомлень, що підійшов одразу до двадцяти різних замовлень.
 *
 * Тому:
 *   • читається рівно той діалог, чия належність доведена номером замовлення
 *     або телефоном (link_confidence 'order' чи 'phone');
 *   • діалоги, звʼязані лише за іменем, не читаються ВЗАГАЛІ — навіть якщо
 *     колись хтось запише їх у базу з p_name_phase = true;
 *   • коли привʼязки немає, функція каже про це прямо, і Софія має відповісти
 *     «переписки не знайдено», а не добудовувати відповідь з повітря.
 *
 * Привʼязку оновлює кожен запуск /api/cron/social-unanswered (кожні пів
 * години), тож новий діалог стає видимим у межах цього вікна.
 */

/** Скільки останніх повідомлень діалогу бачить модель. */
const MAX_MESSAGES = 15;

/**
 * Відсутність переписки — це теж ФАКТ, і його треба назвати вголос.
 *
 * Порожній рядок тут був гіршим за будь-який текст: у фактах про замовлення
 * зʼявлялася діра, а модель діри заповнює вигадкою. Рівно так Софія свого часу
 * зібрала неіснуючу пошту клієнтки з її імені, і лікувалося це тим самим —
 * явним рядком «клієнт НЕ лишив email».
 */
export const NO_DIALOG_LINE =
    'Переписка з клієнтом: до цього замовлення переписки в месенджері не привʼязано. '
    + 'Це означає, що діалогу з доведеною належністю саме цьому замовленню в нас немає — '
    + 'відповідай тільки з фактів про замовлення і прямо скажи, що переписки не знайдено.';

export type ClientDialogMatch = {
    conversationId: string;
    who: string;
    platform: string;
    /** Чим доведено привʼязку. Іменних збігів тут не буває за побудовою. */
    confidence: 'order' | 'phone';
};

/**
 * Складання тексту, який поїде в модель. Винесено окремо і без звернень до
 * бази навмисно: це єдине місце, де вирішується, що саме побачить модель, коли
 * діалогу немає, і саме його перевіряє tests/client-dialog-context.test.ts.
 */
export function buildDialogContext(match: ClientDialogMatch | null, transcript: string): string {
    if (!match || !transcript) return NO_DIALOG_LINE;

    const caveat = match.confidence === 'order'
        ? ' (у діалозі названо номер замовлення)'
        : ' (звірено за номером телефону)';
    return `Переписка з клієнтом «${match.who}» у ${match.platform}${caveat}:\n${transcript}`;
}

/**
 * Діалог, привʼязаний до замовлення. Повертає null, а не здогад.
 *
 * Коли до одного замовлення привʼязано кілька розмов (та сама людина писала з
 * двох акаунтів, або її номер звучав у чужому діалозі), береться та, де писали
 * востаннє. Інші не читаються: дві переписки в одній відповіді переплутати
 * легше, ніж прочитати.
 */
export async function findClientDialog(order: { id?: string | null }): Promise<ClientDialogMatch | null> {
    const orderId = String(order?.id || '').trim();
    if (!orderId) return null;

    const supabase = getAdminClient();
    const { data, error } = await supabase
        .from('social_conversations')
        .select('id, platform, external_username, link_confidence')
        .eq('order_id', orderId)
        .in('link_confidence', ['order', 'phone'])
        .order('last_message_at', { ascending: false })
        .limit(1);

    if (error) {
        console.error('[client-chat-lookup] conversation lookup failed:', error.message);
        return null;
    }
    const conv: any = (data || [])[0];
    if (!conv) return null;

    return {
        conversationId: String(conv.id),
        who: conv.external_username || 'клієнт',
        platform: conv.platform,
        confidence: conv.link_confidence === 'order' ? 'order' : 'phone',
    };
}

/** The dialog's recent messages, oldest first, as plain text for the model. */
export async function fetchDialogTranscript(conversationId: string, limit = MAX_MESSAGES): Promise<string> {
    const supabase = getAdminClient();
    const { data } = await supabase
        .from('social_messages')
        .select('sender, original_text, sent_at')
        .eq('conversation_id', conversationId)
        .order('sent_at', { ascending: false })
        .limit(limit);
    if (!data?.length) return '';

    return data
        .reverse()
        .map(m => {
            const who = m.sender === 'customer' ? 'Клієнт' : m.sender === 'ai' ? 'Софія' : 'Ми';
            const when = new Date(m.sent_at).toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit', timeZone: 'Europe/Kyiv' });
            return `[${when}] ${who}: ${String(m.original_text || '').slice(0, 300)}`;
        })
        .join('\n');
}

/**
 * Everything the client dialog can contribute to a question about an order:
 * the transcript plus a line naming its owner. Ніколи не повертає порожнє —
 * коли діалогу немає, повертає NO_DIALOG_LINE, і відсутність переписки
 * доходить до моделі як факт.
 */
export async function clientDialogContext(order: { id?: string | null }): Promise<string> {
    try {
        const match = await findClientDialog(order);
        if (!match) return NO_DIALOG_LINE;
        const transcript = await fetchDialogTranscript(match.conversationId);
        return buildDialogContext(match, transcript);
    } catch (e) {
        console.error('[client-chat-lookup] failed:', e);
        return NO_DIALOG_LINE;
    }
}
