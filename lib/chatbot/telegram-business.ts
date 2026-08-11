import { getAdminClient } from '@/lib/supabase/admin';

/**
 * Telegram Business bridge.
 *
 * Diana connects the public bot (Софія) to her PERSONAL Telegram account via
 * Settings → Telegram Business → Chatbots. After that, Telegram delivers every
 * message in her private client dialogs to the bot's webhook as
 * `business_message` updates, and (with the reply permission granted) the bot
 * can answer ON BEHALF OF HER ACCOUNT via sendMessage + business_connection_id.
 *
 * All state lives in the `settings` table (jsonb values), so behaviour is
 * switchable from SQL/admin without a redeploy:
 *
 *   telegram_business_connection   — saved from the `business_connection`
 *                                    update; holds connection_id, the owner's
 *                                    user_id (to tell her outgoing messages
 *                                    from client messages) and user_chat_id
 *                                    (her private chat with the bot — the
 *                                    default destination for drafts/alerts).
 *   telegram_business_mode         — "draft" (default): AI reply is sent to
 *                                    Diana as a suggestion, never to the
 *                                    client. "auto": bot replies to the client
 *                                    directly. "off": messages are only
 *                                    recorded for monitoring.
 *   telegram_business_draft_chat_id — optional override for where drafts and
 *                                    alerts go (e.g. a work group chat id).
 *   telegram_business_human_silence_hours — after Diana replies manually in a
 *                                    dialog, the bot stays silent there for
 *                                    this many hours (default 3).
 */

const TELEGRAM_API_URL = 'https://api.telegram.org/bot';

export type BusinessConnectionState = {
    connection_id: string;
    user_id: number;
    user_chat_id: number | null;
    can_reply: boolean;
    is_enabled: boolean;
    updated_at: string;
};

export type BusinessMode = 'draft' | 'auto' | 'off';

async function readSetting(key: string): Promise<any | null> {
    const supabase = getAdminClient();
    const { data } = await supabase.from('settings').select('value').eq('key', key).maybeSingle();
    return data?.value ?? null;
}

export async function saveBusinessConnection(state: BusinessConnectionState): Promise<void> {
    const supabase = getAdminClient();
    const { error } = await supabase
        .from('settings')
        .upsert({ key: 'telegram_business_connection', value: state, updated_at: new Date().toISOString() });
    if (error) console.error('[TG Business] Failed to save connection state:', error);
}

export async function getBusinessConnection(): Promise<BusinessConnectionState | null> {
    const value = await readSetting('telegram_business_connection');
    if (!value || typeof value !== 'object' || !value.connection_id) return null;
    return value as BusinessConnectionState;
}

export async function getBusinessMode(): Promise<BusinessMode> {
    const value = await readSetting('telegram_business_mode');
    const mode = typeof value === 'string' ? value : value?.mode;
    if (mode === 'auto' || mode === 'off') return mode;
    // Draft is the safe default: a misconfigured mode must never let the AI
    // message real clients from Diana's personal account.
    return 'draft';
}

/** Where drafts and monitoring alerts go: explicit override, else Diana's own chat with the bot. */
export async function getAlertChatId(): Promise<string | null> {
    const override = await readSetting('telegram_business_draft_chat_id');
    if (override) return String(typeof override === 'object' ? override.chat_id : override);
    const conn = await getBusinessConnection();
    return conn?.user_chat_id ? String(conn.user_chat_id) : null;
}

/**
 * Extra owner accounts. Diana runs two Telegram accounts (personal + the
 * touch.memories brand account that holds the Business connection); owner-
 * gated commands must accept both. The Business connection's user_id is
 * always an owner; this list adds the rest (settings `telegram_owner_user_ids`).
 */
export async function getOwnerUserIds(): Promise<number[]> {
    const value = await readSetting('telegram_owner_user_ids');
    if (Array.isArray(value)) return value.map(Number).filter(Number.isFinite);
    return [];
}

/**
 * Work group chats where team commands (/status, /order, …) are allowed.
 * Registration is owner-gated (see work-commands.ts) because the commands
 * expose order and customer data.
 */
export async function getWorkChatIds(): Promise<number[]> {
    const value = await readSetting('telegram_work_chat_ids');
    if (Array.isArray(value)) return value.map(Number).filter(Number.isFinite);
    return [];
}

export async function addWorkChatId(chatId: number): Promise<void> {
    const existing = await getWorkChatIds();
    if (existing.includes(chatId)) return;
    const supabase = getAdminClient();
    const { error } = await supabase
        .from('settings')
        .upsert({ key: 'telegram_work_chat_ids', value: [...existing, chatId], updated_at: new Date().toISOString() });
    if (error) console.error('[TG Business] Failed to save work chat id:', error);
}

/**
 * Where the unanswered-dialogs watchdog posts. A work chat can claim this via
 * /alerts_here; otherwise alerts fall back to the draft destination (Diana's
 * private chat with the bot).
 */
export async function getWatchdogChatId(): Promise<string | null> {
    const value = await readSetting('telegram_alerts_chat_id');
    if (value) return String(typeof value === 'object' ? value.chat_id : value);
    return getAlertChatId();
}

export async function setWatchdogChatId(chatId: number): Promise<void> {
    const supabase = getAdminClient();
    const { error } = await supabase
        .from('settings')
        .upsert({ key: 'telegram_alerts_chat_id', value: chatId, updated_at: new Date().toISOString() });
    if (error) console.error('[TG Business] Failed to save alerts chat id:', error);
}

export async function getHumanSilenceHours(): Promise<number> {
    const value = await readSetting('telegram_business_human_silence_hours');
    const parsed = parseFloat(typeof value === 'string' ? value : String(value ?? ''));
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : 3;
}

/**
 * True when Diana herself replied in this dialog within the last N hours —
 * the bot must not talk over a live human conversation, so both draft and
 * auto modes go quiet for the silence window.
 */
export async function humanRepliedRecently(
    platform: string,
    externalUserId: string,
    hours: number
): Promise<boolean> {
    if (hours <= 0) return false;
    const supabase = getAdminClient();
    const { data: conversation } = await supabase
        .from('social_conversations')
        .select('id')
        .eq('platform', platform)
        .eq('external_user_id', externalUserId)
        .maybeSingle();
    if (!conversation) return false;

    const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
    const { data: lastHuman } = await supabase
        .from('social_messages')
        .select('id')
        .eq('conversation_id', conversation.id)
        .eq('sender', 'human_manager')
        .gte('sent_at', since)
        .limit(1);
    return !!lastHuman?.length;
}

/**
 * Send a message from the public bot. With `businessConnectionId` set the
 * message goes out on behalf of Diana's personal account (Telegram Business);
 * without it, it is a plain bot message (drafts, alerts).
 */
export async function sendViaPublicBot(params: {
    chat_id: string | number;
    text: string;
    businessConnectionId?: string;
}): Promise<{ success: boolean; error?: string }> {
    const botToken = process.env.TELEGRAM_PUBLIC_BOT_TOKEN;
    if (!botToken) return { success: false, error: 'TELEGRAM_PUBLIC_BOT_TOKEN not configured' };

    try {
        const response = await fetch(`${TELEGRAM_API_URL}${botToken}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: params.chat_id,
                text: params.text,
                ...(params.businessConnectionId
                    ? { business_connection_id: params.businessConnectionId }
                    : {}),
            }),
        });
        const data = await response.json();
        if (!data.ok) return { success: false, error: data.description || 'sendMessage failed' };
        return { success: true };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

/**
 * Once-a-day greeting tracker: returns true exactly once per chat per Kyiv
 * day (and records the fact), so the bot greets the first person who talks
 * to it in the morning and doesn't repeat itself all day.
 */
export async function shouldGreetToday(chatId: number, kyivDateStr: string): Promise<boolean> {
    const supabase = getAdminClient();
    const { data } = await supabase.from('settings').select('value').eq('key', 'telegram_daily_greeted').maybeSingle();
    const map: Record<string, string> = (data?.value && typeof data.value === 'object') ? data.value : {};
    if (map[String(chatId)] === kyivDateStr) return false;
    // Keep only today's entries — yesterday's greetings are dead weight.
    const next: Record<string, string> = {};
    for (const [id, d] of Object.entries(map)) if (d === kyivDateStr) next[id] = d;
    next[String(chatId)] = kyivDateStr;
    await supabase.from('settings').upsert({ key: 'telegram_daily_greeted', value: next, updated_at: new Date().toISOString() });
    return true;
}

/**
 * Post a message to the team's alert destination: the chat claimed via
 * /alerts_here, else Diana's private chat with the bot. Silently no-ops when
 * neither exists yet — callers treat this as best-effort notification.
 */
export async function sendWorkChatAlert(text: string): Promise<{ success: boolean; error?: string }> {
    const chatId = await getWatchdogChatId();
    if (!chatId) return { success: false, error: 'no alert chat configured' };
    return sendViaPublicBot({ chat_id: chatId, text });
}

/** Human-readable placeholder for non-text business messages, so monitoring history has no gaps. */
export function describeNonTextMessage(msg: any): string {
    if (msg.photo) return '📷 [фото]';
    if (msg.voice) return '🎤 [голосове повідомлення]';
    if (msg.video || msg.video_note) return '🎬 [відео]';
    if (msg.document) return '📎 [файл]';
    if (msg.sticker) return '[стікер]';
    if (msg.location) return '📍 [геолокація]';
    return '[повідомлення без тексту]';
}
