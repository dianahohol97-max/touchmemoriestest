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
    confidence: 'phone' | 'name';
};

/**
 * Find the dialog that belongs to an order's customer. Returns null rather
 * than a guess when nothing matches convincingly.
 */
export async function findClientDialog(order: {
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

    const wantedPhone = phoneKey(order.customer_phone);
    const wantedName = nameTokens(order.customer_name);

    // A phone in the dialog's own name field is rare but decisive.
    if (wantedPhone) {
        const byPhone = conversations.find(c => phoneKey(c.external_username) === wantedPhone);
        if (byPhone) {
            return {
                conversationId: byPhone.id,
                who: byPhone.external_username || 'клієнт',
                platform: byPhone.platform,
                confidence: 'phone',
            };
        }
    }

    if (!wantedName.length) return null;

    // Name overlap: at least one token of four letters or more must match.
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
            : '';
        return `Переписка з клієнтом «${match.who}» у ${match.platform}${caveat}:\n${transcript}`;
    } catch (e) {
        console.error('[client-chat-lookup] failed:', e);
        return '';
    }
}
