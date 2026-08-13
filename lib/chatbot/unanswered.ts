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
    id: string;
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

    // Dialogs a manager touched recently are "in work" (design approvals,
    // revision rounds — the Тома/Оксана/Юля/Таня folders) and must not spam
    // the watchdog. Telegram folders are invisible to bots, so recency of a
    // human reply is the working equivalent of "it's in someone's folder".
    const { data: activeSetting } = await supabase
        .from('settings').select('value').eq('key', 'social_watchdog_active_hours').maybeSingle();
    const rawActive = parseFloat(String(activeSetting?.value ?? ''));
    const activeHours = Number.isFinite(rawActive) && rawActive >= 0 ? rawActive : 24;

    // …EXCEPT when that last human reply is the print handoff («передано в
    // друк»): the design phase is over, so silence after it is a potentially
    // forgotten client, not work in progress — the dialog re-enters full
    // monitoring immediately. Phrases configurable for the team's wording.
    const { data: handoffSetting } = await supabase
        .from('settings').select('value').eq('key', 'social_watchdog_handoff_phrases').maybeSingle();
    const handoffPhrases: string[] = Array.isArray(handoffSetting?.value)
        ? handoffSetting.value.map(String)
        : ['передано в друк', 'передаємо в друк', 'передали в друк'];

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
    const lastHumanByConv = new Map<string, { sent_at: string; text: string }>();
    for (const m of messages || []) {
        if (!latestByConv.has(m.conversation_id)) latestByConv.set(m.conversation_id, m);
        if (m.sender === 'human_manager' && !lastHumanByConv.has(m.conversation_id)) {
            lastHumanByConv.set(m.conversation_id, { sent_at: m.sent_at, text: m.original_text || '' });
        }
    }

    const isHandoff = (text: string) => {
        const lower = text.toLowerCase();
        return handoffPhrases.some(p => p && lower.includes(p.toLowerCase()));
    };

    // A short thanks or goodbye CLOSES a conversation — it is not a question
    // waiting on us (Diana, 2026-08-11, twice: a bare «Дякую)», then «Дякую,
    // навзаєм» and «Дякую і вам гарного дня ♥️» — an exact-phrase list keeps
    // losing to the variety of politeness, so the check is a VOCABULARY: a
    // short message with no «?» whose every word is a pleasantry counts as a
    // closer. «Дякую, а коли відправите?» still alerts — it carries a
    // question and non-pleasantry words.
    //
    // The vocabulary is bilingual on purpose: a large share of the clients
    // write Russian, and a Ukrainian-only list let «Спасибо большое ☺️» through
    // as an unanswered question (Diana, 2026-08-11: «ми ж домовлялись такі
    // повідомлення не підсвічувати»).
    const CLOSER_WORDS = new Set([
        'дякую', 'дякуємо', 'дяки', 'спасибі', 'спс', 'вдячна', 'вдячний', 'вдячні',
        // Russian pleasantries — same closers, other language.
        'спасибо', 'спасибочки', 'благодарю', 'пожалуйста', 'большое', 'огромное',
        'хорошо', 'отлично', 'ладно', 'понятно', 'ясно', 'взаимно', 'вечера',
        'ночи', 'утра', 'удачи', 'здоровья', 'свидания', 'пока', 'приятно',
        'было', 'очень', 'тоже', 'ещё', 'еще', 'раз', 'вам', 'тебе', 'и', 'а',
        'навзаєм', 'взаємно', 'гарного', 'чудового', 'доброго', 'приємного',
        'дня', 'вечора', 'ночі', 'ранку', 'вихідних', 'тижня', 'свят',
        'вам', 'тобі', 'і', 'та', 'й', 'а', 'все', 'зрозуміло', 'прийнято',
        'добре', 'ок', 'окей', 'okay', 'ok', 'супер', 'чудово', 'клас', 'класно',
        'дуже', 'велике', 'щиро', 'до', 'побачення', 'зустрічі', 'бувайте', 'бувай',
        'всього', 'найкращого', 'успіхів', 'миру', 'здоровя', 'здоров',
        'приємно', 'було', 'теж', 'також', 'ще', 'раз', 'сама', 'сам', 'вас', 'тебе',
        // «Ок дякую чекаю» is a client settling in to wait, not a question
        // (Diana, 2026-08-13) — waiting words close a thread just like thanks.
        'чекаю', 'чекаємо', 'чекатиму', 'жду', 'ждем', 'ждём', 'буду', 'домовились',
        'домовилися', 'зрозуміла', 'зрозумів', 'гаразд', 'звісно', 'звичайно',
    ]);
    const isCloser = (text: string) => {
        const raw = String(text || '').trim();
        if (raw.length > 80 || raw.includes('?')) return false;
        const words = raw
            .toLowerCase()
            .replace(/['’ʼ]/g, '')
            .replace(/[^\p{L}\s]/gu, ' ')
            .split(/\s+/)
            .filter(Boolean);
        if (!words.length) return true; // bare emoji / sticker reaction
        if (words.length > 10) return false;
        return words.every(w => CLOSER_WORDS.has(w));
    };

    const unanswered: WaitingDialog[] = [];
    const needsHuman: WaitingDialog[] = [];

    for (const conv of conversations) {
        const last = latestByConv.get(conv.id);
        if (!last) continue;
        const hours = (now - new Date(last.sent_at).getTime()) / HOUR_MS;
        const item: WaitingDialog = {
            id: conv.id,
            name: conv.external_username || 'Без імені',
            platform: platformLabel(conv.platform),
            hours,
            text: (last.original_text || '').slice(0, 120),
        };
        if (conv.status === 'needs_human') {
            needsHuman.push(item);
        } else if (last.sender === 'customer' && hours >= thresholdHours && !isCloser(last.original_text || '')) {
            // Two deliberate mutes: a dialog explicitly taken over by a human
            // (admin inbox status), and a dialog a manager replied to within
            // the active window — both are being handled, alerting on them
            // trains everyone to ignore the watchdog.
            if (conv.status === 'human_handling') continue;
            const lastHuman = lastHumanByConv.get(conv.id);
            const humanActive = activeHours > 0 && lastHuman
                && (now - new Date(lastHuman.sent_at).getTime()) < activeHours * HOUR_MS
                && !isHandoff(lastHuman.text);
            if (humanActive) continue;
            unanswered.push(item);
        }
    }

    unanswered.sort((a, b) => b.hours - a.hours);
    needsHuman.sort((a, b) => b.hours - a.hours);
    return { unanswered, needsHuman, thresholdHours };
}
