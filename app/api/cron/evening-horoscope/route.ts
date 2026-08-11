import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { getAdminClient } from '@/lib/supabase/admin';
import { sendWorkChatAlert } from '@/lib/chatbot/telegram-business';
import { ZODIAC, collectHighlights, fetchHoroscopes, type HoroscopeEntry } from '@/lib/automation/evening-extras';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Вечірній гороскоп — 18:05 UTC = 21:05 Kyiv (Diana, 2026-08-11).
 *
 * Six signs the team follows, plus «щось цікаве» про завтра: an eclipse, a
 * public holiday, a professional date.
 *
 * Diana's rule for this one is strict: «має бути з перевірених джерел, а не
 * сама видумувала». So the model here NEVER writes a horoscope — it only
 * translates and shortens text that came from the published source, and the
 * source is named in the message. Three failure paths, all honest:
 *
 *  · source unreachable → horoscope section omitted, highlights still sent;
 *  · no ANTHROPIC_API_KEY → same, because an untranslated English blob is not
 *    something to post into a Ukrainian work chat;
 *  · nothing at all to say → nothing is sent (no empty ritual message).
 *
 * Toggle: settings key `evening_horoscope_enabled` (false disables without a
 * redeploy). `?preview=1` builds the text and returns it without sending.
 */

/**
 * Vercel Cron authenticates with the bearer. A person (or an agent with
 * database access) can also run it out of schedule with a ONE-TIME token
 * placed in settings('evening_horoscope_run_token') as
 * { token, expires_at } — the row is deleted the moment it is used, so the
 * link cannot be replayed, and issuing one requires admin access to the
 * database in the first place.
 */
async function authorized(req: Request): Promise<boolean> {
    const auth = req.headers.get('authorization');
    if (process.env.CRON_SECRET && auth === `Bearer ${process.env.CRON_SECRET}`) return true;

    const token = new URL(req.url).searchParams.get('token');
    if (!token) return false;

    try {
        const supabase = getAdminClient();
        const { data } = await supabase.from('settings').select('value').eq('key', 'evening_horoscope_run_token').maybeSingle();
        const stored = data?.value as any;
        if (!stored?.token || stored.token !== token) return false;
        // Always consume, valid or expired: one attempt per issued token.
        await supabase.from('settings').delete().eq('key', 'evening_horoscope_run_token');
        return !!stored.expires_at && new Date(stored.expires_at).getTime() > Date.now();
    } catch (e) {
        console.error('[evening-horoscope] token check failed:', e);
        return false;
    }
}

async function isEnabled(): Promise<boolean> {
    try {
        const supabase = getAdminClient();
        const { data } = await supabase.from('settings').select('value').eq('key', 'evening_horoscope_enabled').maybeSingle();
        const value = data?.value;
        if (value === false || value === 'false') return false;
        return true;
    } catch {
        return true;
    }
}

/**
 * Translate + condense, never compose. One short Ukrainian sentence per sign,
 * keeping the meaning of the source line. Signs the model drops are dropped
 * from the message rather than filled in from imagination.
 */
async function condense(entries: HoroscopeEntry[]): Promise<HoroscopeEntry[]> {
    if (!entries.length || !process.env.ANTHROPIC_API_KEY) return [];

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const response = await anthropic.messages.create({
        model: 'claude-haiku-4-5',
        max_tokens: 700,
        temperature: 0.2,
        system: [
            'Ти — перекладачка гороскопів для українського робочого чату.',
            'Тобі дають англомовні гороскопи з published джерела. Твоє завдання — переказати їх українською, стисло і природно.',
            'Категорично заборонено вигадувати чи додавати передбачення, яких немає у вихідному тексті. Тільки те, що є в оригіналі.',
            'Для кожного знаку — рівно одне речення, максимум 140 символів, живою українською мовою.',
            'Не використовуй речення з одного-двох слів. Без списків, без емодзі, без пояснень.',
            'Формат відповіді: кожен рядок «Знак: текст». Нічого більше.',
        ].join(' '),
        messages: [{
            role: 'user',
            content: entries.map(e => `${e.sign}: ${e.text}`).join('\n\n'),
        }],
    });

    const raw = response.content
        .filter((b: any) => b.type === 'text')
        .map((b: any) => b.text)
        .join('\n');

    const byName = new Map(ZODIAC.map(z => [z.ua.toLowerCase(), z]));
    const out: HoroscopeEntry[] = [];
    for (const line of raw.split('\n')) {
        const m = line.match(/^\s*[-•*]?\s*([^:]{3,20}):\s*(.+)$/);
        if (!m) continue;
        const sign = byName.get(m[1].trim().toLowerCase());
        const text = m[2].trim();
        if (!sign || !text) continue;
        if (out.some(e => e.sign === sign.ua)) continue;
        out.push({ sign: sign.ua, emoji: sign.emoji, text });
    }

    // Keep the team's usual order regardless of what the model returned.
    return ZODIAC.map(z => out.find(e => e.sign === z.ua)).filter(Boolean) as HoroscopeEntry[];
}

export async function GET(req: Request) {
    if (!(await authorized(req))) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const preview = new URL(req.url).searchParams.get('preview') === '1';

    if (!(await isEnabled())) {
        return NextResponse.json({ ok: true, skipped: 'disabled' });
    }

    let horoscopes: HoroscopeEntry[] = [];
    let source = '';
    try {
        const fetched = await fetchHoroscopes('TOMORROW');
        source = fetched.source;
        horoscopes = await condense(fetched.entries);
    } catch (e) {
        console.error('[evening-horoscope] horoscopes failed:', e);
    }

    let highlights: string[] = [];
    try {
        highlights = await collectHighlights();
    } catch (e) {
        console.error('[evening-horoscope] highlights failed:', e);
    }

    if (!horoscopes.length && !highlights.length) {
        return NextResponse.json({ ok: true, skipped: 'nothing to say' });
    }

    const parts: string[] = [];
    if (horoscopes.length) {
        parts.push('🔮 Гороскоп на завтра для наших знаків:');
        parts.push(horoscopes.map(h => `${h.emoji} ${h.sign}: ${h.text}`).join('\n'));
        parts.push(`Джерело: ${source}`);
    }
    if (highlights.length) {
        parts.push(highlights.join('\n'));
    }
    parts.push('Гарного вечора і солодких снів ✨');

    const text = parts.join('\n\n');

    if (preview) {
        return NextResponse.json({ ok: true, signs: horoscopes.length, highlights, text });
    }

    const sent = await sendWorkChatAlert(text);
    return NextResponse.json({ ok: sent.success, signs: horoscopes.length, highlights: highlights.length, error: sent.error });
}
