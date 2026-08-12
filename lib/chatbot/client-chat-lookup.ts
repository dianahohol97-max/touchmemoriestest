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
 * Софія already stores those dialogs (Telegram Business + Instagram land in
 * social_conversations / social_messages), so the material is there. What is
 * missing is the link from an ORDER to the RIGHT dialog, and that link is
 * inherently approximate: a CRM order carries «Шитікова Олена» and a phone,
 * while a Telegram chat carries «Олена» and a username. So:
 *
 *  · matching is by phone first (exact, when the dialog ever carried one),
 *    then by name overlap — and never on a single common first name alone;
 *  · every answer built from a dialog says WHOSE dialog and WHEN it was
 *    said, so a wrong match is visible to the person reading it rather than
 *    quietly believed.
 */

const MAX_MESSAGES = 40;

/** Digits only, last 9 — «+380 (67) 123-45-67» and «0671234567» are one number. */
function phoneKey(value: string | null | undefined): string {
    const digits = String(value || '').replace(/\D/g, '');
    return digits.length >= 9 ? digits.slice(-9) : '';
}

function nameTokens(value: string | null | undefined): string[] {
    return String(value || '')
        .toLowerCase()
        .replace(/[^\p{L}\s]/gu, ' ')
        .split(/\s+/)
        .filter(w => w.length >= 4);
}

export type ClientDialogMatch = {
    conversationId: string;
    who: string;
    platform: string;
    confidence: 'order' | 'phone' | 'name';
};

/**
 * Conversations whose MESSAGES contain a string — the order number, the phone,
 * the customer's surname. This is what makes the link work at all: a Telegram
 * dialog is titled «Надійка» or «vladixx», never «Біленька Валентина», so the
 * title almost never matches a CRM name. What does match is the text the
 * client typed — their full name and phone for the waybill, the order number
 * when they ask about it.
 */
async function conversationsMentioning(term: string, limit = 5): Promise<string[]> {
    if (!term || term.length < 4) return [];
    const supabase = getAdminClient();
    // Escape the LIKE wildcards so a name with «%» cannot widen the search.
    const safe = term.replace(/[%_]/g, ' ').trim();
    if (safe.length < 4) return [];

    const { data } = await supabase
        .from('social_messages')
        .select('conversation_id')
        .ilike('original_text', `%${safe}%`)
        .order('sent_at', { ascending: false })
        .limit(limit * 6);

    const seen: string[] = [];
    for (const row of data || []) {
        const id = String((row as any).conversation_id || '');
        if (id && !seen.includes(id)) seen.push(id);
        if (seen.length >= limit) break;
    }
    return seen;
}

/**
 * Find the dialog that belongs to an order's customer. Returns null rather
 * than a guess when nothing matches convincingly.
 */
export async function findClientDialog(order: {
    order_number?: string | null;
    customer_name?: string | null;
    customer_phone?: string | null;
}): Promise<ClientDialogMatch | null> {
    const supabase = getAdminClient();

    const { data: conversations } = await supabase
        .from('social_conversations')
        .select('id, platform, external_username, external_user_id, last_message_at')
        .order('last_message_at', { ascending: false })
        .limit(500);
    if (!conversations?.length) return null;

    const byId = new Map(conversations.map((c: any) => [c.id, c]));
    const describe = (id: string, confidence: ClientDialogMatch['confidence']): ClientDialogMatch | null => {
        const conv: any = byId.get(id);
        if (!conv) return null;
        return {
            conversationId: conv.id,
            who: conv.external_username || 'клієнт',
            platform: conv.platform,
            confidence,
        };
    };

    const wantedPhone = phoneKey(order.customer_phone);
    const wantedName = nameTokens(order.customer_name);

    // 1. The order number typed in the dialog. Decisive when present: nobody
    //    else's chat carries this shop's order id.
    const bare = String(order.order_number || '').replace(/\D/g, '');
    if (bare.length >= 4) {
        for (const id of await conversationsMentioning(bare, 2)) {
            const match = describe(id, 'order');
            if (match) return match;
        }
    }

    // 2. The phone. Clients type it for the waybill, in every possible format,
    //    so the search uses the last nine digits — «0677546059» and
    //    «677546059» both hit, and the local «067…» spelling too.
    if (wantedPhone) {
        for (const term of [wantedPhone, `0${wantedPhone.slice(-9)}`]) {
            for (const id of await conversationsMentioning(term, 2)) {
                const match = describe(id, 'phone');
                if (match) return match;
            }
        }
        // Rare, but decisive when it happens: the dialog is titled by a phone.
        const byTitle = conversations.find((c: any) => phoneKey(c.external_username) === wantedPhone);
        if (byTitle) return describe(byTitle.id, 'phone');
    }

    if (!wantedName.length) return null;

    // 3. The name as the client typed it for delivery — «Біленька Валентина»
    //    in the dialog text, while the dialog itself is titled «Валя». Only a
    //    long token counts, and only when exactly one dialog carries it: two
    //    Оксани would be a guess, and a guess here answers about the wrong
    //    customer's order.
    for (const token of [...wantedName].sort((a, b) => b.length - a.length)) {
        if (token.length < 5) continue;
        const found = await conversationsMentioning(token, 3);
        if (found.length === 1) {
            const match = describe(found[0], 'name');
            if (match) return match;
        }
    }

    // 4. Last resort: the dialog's TITLE shares a long word with the CRM name.
    // Short tokens are dropped above precisely so «Оля» does not match every
    // Olga in the inbox; a single shared LONG token (a surname, or a rare
    // first name) is the weakest link this will accept.
    let best: { conv: any; score: number } | null = null;
    for (const conv of conversations) {
        const tokens = nameTokens(conv.external_username);
        if (!tokens.length) continue;
        const shared = tokens.filter(t => wantedName.includes(t)).length;
        if (!shared) continue;
        if (!best || shared > best.score) best = { conv, score: shared };
    }
    if (!best) return null;

    return {
        conversationId: best.conv.id,
        who: best.conv.external_username || 'клієнт',
        platform: best.conv.platform,
        confidence: 'name',
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
 * the transcript plus a line naming its owner, ready to append to the facts.
 * Empty string when no dialog matches — the caller then answers from the
 * order alone, as before.
 */
export async function clientDialogContext(order: {
    order_number?: string | null;
    customer_name?: string | null;
    customer_phone?: string | null;
}): Promise<string> {
    try {
        const match = await findClientDialog(order);
        if (!match) return '';
        const transcript = await fetchDialogTranscript(match.conversationId);
        if (!transcript) return '';

        const caveat = match.confidence === 'name'
            ? ' (звірено за імʼям — якщо клієнт не той, скажи про це)'
            : match.confidence === 'order'
                ? ' (у діалозі згадано номер замовлення)'
                : ' (звірено за номером телефону)';
        return `Переписка з клієнтом «${match.who}» у ${match.platform}${caveat}:\n${transcript}`;
    } catch (e) {
        console.error('[client-chat-lookup] failed:', e);
        return '';
    }
}
