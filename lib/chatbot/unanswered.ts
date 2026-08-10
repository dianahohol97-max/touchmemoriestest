import { getAdminClient } from '@/lib/supabase/admin';

/**
 * Shared "which client dialogs are waiting on us" computation. Used by the
 * /api/cron/social-unanswered watchdog and the /unanswered team command, so
 * both always agree on what counts as unanswered.
 *
 * A dialog is unanswered when its LATEST message is from the customer and is
 * older than the threshold (settings `social_unanswered_hours`, default 3).
 * Dialogs in `needs_human` are reported separately regardless of age.
 */

const LOOKBACK_DAYS = 14;
const HOUR_MS = 60 * 60 * 1000;

export type WaitingDialog = {
    name: string;
    platform: string;
    hours: number;
    text: string;
};

export type UnansweredReport = {
    unanswered: WaitingDialog[];
    needsHuman: WaitingDialog[];
    thresholdHours: number;
};

function platformLabel(platform: string): string {
    if (platform === 'telegram') return 'Telegram';
    if (platform === 'instagram') return 'Instagram';
    return platform;
}

export function waitingLabel(hours: number): string {
    if (hours < 24) return `${Math.round(hours)} год`;
    const days = Math.floor(hours / 24);
    return `${days} дн ${Math.round(hours - days * 24)} год`;
}

export async function computeUnansweredDialogs(): Promise<UnansweredReport> {
    const supabase = getAdminClient();
    const now = Date.now();
    const lookbackIso = new Date(now - LOOKBACK_DAYS * 24 * HOUR_MS).toISOString();

    const { data: thresholdSetting } = await supabase
        .from('settings').select('value').eq('key', 'social_unanswered_hours').maybeSingle();
    const rawThreshold = parseFloat(String(thresholdSetting?.value ?? ''));
    const thresholdHours = Number.isFinite(rawThreshold) && rawThreshold > 0 ? rawThreshold : 3;

    const { data: conversations, error: convErr } = await supabase
        .from('social_conversations')
        .select('id, platform, external_username, status, last_message_at')
        .gte('last_message_at', lookbackIso);
    if (convErr) throw new Error(convErr.message);
    if (!conversations?.length) return { unanswered: [], needsHuman: [], thresholdHours };

    // Latest message per conversation decides "answered or not". One query,
    // newest first; the first row seen per conversation wins.
    const convIds = conversations.map(c => c.id);
    const { data: messages, error: msgErr } = await supabase
        .from('social_messages')
        .select('conversation_id, sender, original_text, sent_at')
        .in('conversation_id', convIds)
        .gte('sent_at', lookbackIso)
        .order('sent_at', { ascending: false });
    if (msgErr) throw new Error(msgErr.message);

    const latestByConv = new Map<string, { sender: string; original_text: string | null; sent_at: string }>();
    for (const m of messages || []) {
        if (!latestByConv.has(m.conversation_id)) latestByConv.set(m.conversation_id, m);
    }

    const unanswered: WaitingDialog[] = [];
    const needsHuman: WaitingDialog[] = [];

    for (const conv of conversations) {
        const last = latestByConv.get(conv.id);
        if (!last) continue;
        const hours = (now - new Date(last.sent_at).getTime()) / HOUR_MS;
        const item: WaitingDialog = {
            name: conv.external_username || 'Без імені',
            platform: platformLabel(conv.platform),
            hours,
            text: (last.original_text || '').slice(0, 120),
        };
        if (conv.status === 'needs_human') {
            needsHuman.push(item);
        } else if (last.sender === 'customer' && hours >= thresholdHours) {
            unanswered.push(item);
        }
    }

    unanswered.sort((a, b) => b.hours - a.hours);
    needsHuman.sort((a, b) => b.hours - a.hours);
    return { unanswered, needsHuman, thresholdHours };
}
