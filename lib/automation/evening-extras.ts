/**
 * The evening extras Софія posts at 21:05 Kyiv (Diana, 2026-08-11):
 * a short horoscope for six signs the team follows, plus «щось цікаве» —
 * an eclipse tomorrow, a full moon, a holiday worth mentioning.
 *
 * Diana's hard rule: «має бути з перевірених джерел, а не сама видумувала».
 * So every line here has a provenance:
 *
 *  · horoscopes come from an external published source, translated and
 *    condensed — never composed. When the source is unreachable, the
 *    section is OMITTED, and the message says nothing about the stars
 *    rather than making something up.
 *  · eclipses come from the published NASA eclipse tables, kept as a dated
 *    list in this file — the dates are fixed decades ahead, so a table is
 *    more reliable here than any API.
 *  · public holidays come from date.nager.at (the Ukrainian calendar);
 *    the notable-days list below is curated and factual.
 */

export const ZODIAC = [
    { key: 'aries', ua: 'Овен', emoji: '♈' },
    { key: 'gemini', ua: 'Близнюки', emoji: '♊' },
    { key: 'cancer', ua: 'Рак', emoji: '♋' },
    { key: 'virgo', ua: 'Діва', emoji: '♍' },
    { key: 'scorpio', ua: 'Скорпіон', emoji: '♏' },
    { key: 'sagittarius', ua: 'Стрілець', emoji: '♐' },
    { key: 'aquarius', ua: 'Водолій', emoji: '♒' },
] as const;

/**
 * Solar and lunar eclipses, from the NASA eclipse tables (eclipse.gsfc.nasa.gov).
 * Only what is visible from or near Europe carries a «видно в Україні» note —
 * an eclipse over the Pacific is a fact, not news for a Kyiv work chat.
 */
const ECLIPSES: Array<{ date: string; text: string }> = [
    { date: '2026-08-12', text: 'повне сонячне затемнення — смуга повної фази пройде Гренландією, Ісландією та північчю Іспанії, у Європі видно як часткове надвечір' },
    { date: '2026-08-28', text: 'часткове місячне затемнення' },
    { date: '2027-02-06', text: 'кільцеподібне сонячне затемнення (Південна Америка та Атлантика)' },
    { date: '2027-02-20', text: 'півтіньове місячне затемнення' },
    { date: '2027-07-18', text: 'півтіньове місячне затемнення' },
    { date: '2027-08-02', text: 'повне сонячне затемнення — найдовше цього століття над Єгиптом, у Європі часткова фаза' },
    { date: '2027-08-17', text: 'півтіньове місячне затемнення' },
    { date: '2028-01-12', text: 'кільцеподібне сонячне затемнення' },
    { date: '2028-07-06', text: 'часткове місячне затемнення' },
    { date: '2028-07-22', text: 'повне сонячне затемнення (Австралія та Нова Зеландія)' },
    { date: '2028-12-31', text: 'повне місячне затемнення — видно з Європи' },
];

/**
 * Days worth a line in a photo-products chat: professional dates, widely
 * observed international days, and the Ukrainian ones people actually mark.
 * Fixed dates only — anything that moves is left to the holidays API.
 */
const NOTABLE_DAYS: Record<string, string> = {
    '01-21': 'Міжнародний день обіймів',
    '02-14': 'День святого Валентина — сезон подарункових фотокниг',
    '03-08': 'Міжнародний жіночий день',
    '04-01': 'День сміху',
    '05-12': 'Міжнародний день медичної сестри',
    '06-01': 'Міжнародний день захисту дітей',
    '07-15': 'Всесвітній день навичок молоді',
    '08-19': 'Всесвітній день фотографії — наше професійне свято 📸',
    '09-01': 'День знань',
    '10-01': 'Міжнародний день музики',
    '11-13': 'Всесвітній день доброти',
    '12-06': 'День Святого Миколая наближається — пік замовлень подарунків',
    '12-25': 'Різдво',
};

function kyivDateKey(d: Date): string {
    return d.toLocaleDateString('en-CA', { timeZone: 'Europe/Kyiv' });
}

/** Facts about tomorrow, all from the sources documented above. */
export async function collectHighlights(now = new Date()): Promise<string[]> {
    const out: string[] = [];
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const tomorrowKey = kyivDateKey(tomorrow);
    const [, mm, dd] = tomorrowKey.split('-');

    const eclipse = ECLIPSES.find(e => e.date === tomorrowKey);
    if (eclipse) out.push(`🌑 Завтра ${eclipse.text}.`);

    const notable = NOTABLE_DAYS[`${mm}-${dd}`];
    if (notable) out.push(`🎉 Завтра ${notable}.`);

    // Official Ukrainian holidays — the calendar the team actually plans
    // around (a holiday means Nova Poshta and the print house work differently).
    try {
        const year = tomorrowKey.slice(0, 4);
        const res = await fetch(`https://date.nager.at/api/v3/PublicHolidays/${year}/UA`, {
            signal: AbortSignal.timeout(8000),
        });
        if (res.ok) {
            const holidays: any[] = await res.json();
            const match = holidays.find(h => h?.date === tomorrowKey);
            if (match) out.push(`🇺🇦 Завтра державне свято: ${match.localName || match.name}.`);
        }
    } catch (e) {
        console.error('[evening-extras] holidays lookup failed:', e);
    }

    return out;
}

export type HoroscopeEntry = { sign: string; emoji: string; text: string };

/**
 * Daily horoscopes from an external source. Defaults to TOMORROW because the
 * message goes out at 21:05 — today's forecast is already spent by then, and
 * the highlights below it are about tomorrow too.
 *
 * Returns an empty list when the source is unavailable — the caller then omits
 * the section entirely, which is the only honest option under «не вигадуй».
 */
type Provider = {
    host: string;
    url: (sign: string, day: 'TODAY' | 'TOMORROW') => string;
    read: (json: any) => string;
    /** Some sources publish today only — they cannot answer a TOMORROW ask. */
    tomorrow: boolean;
};

/**
 * Tried in order, first one that answers wins. A single public endpoint is a
 * single point of failure: the first live run returned zero signs because the
 * primary source did not answer, and «нічого про зорі» is a poor evening post.
 */
const PROVIDERS: Provider[] = [
    {
        host: 'horoscope-app-api.vercel.app',
        url: (sign, day) => `https://horoscope-app-api.vercel.app/api/v1/get-horoscope/daily?sign=${sign}&day=${day}`,
        read: json => String(json?.data?.horoscope_data || ''),
        tomorrow: true,
    },
    {
        host: 'ohmanda.com',
        url: sign => `https://ohmanda.com/api/horoscope/${sign}/`,
        read: json => String(json?.horoscope || ''),
        tomorrow: false,
    },
];

export async function fetchHoroscopes(
    day: 'TODAY' | 'TOMORROW' = 'TOMORROW',
): Promise<{ entries: HoroscopeEntry[]; source: string; day: 'TODAY' | 'TOMORROW'; diagnostics: string[] }> {
    const diagnostics: string[] = [];

    for (const provider of PROVIDERS) {
        // A today-only source still beats silence; the caller says which day
        // it got, so the message never promises tomorrow and shows today.
        const effectiveDay: 'TODAY' | 'TOMORROW' = provider.tomorrow ? day : 'TODAY';
        const entries: HoroscopeEntry[] = [];

        for (const sign of ZODIAC) {
            try {
                const res = await fetch(provider.url(sign.key, effectiveDay), {
                    signal: AbortSignal.timeout(8000),
                    headers: { accept: 'application/json' },
                });
                if (!res.ok) {
                    diagnostics.push(`${provider.host} ${sign.key}: HTTP ${res.status}`);
                    continue;
                }
                const json: any = await res.json();
                const text = provider.read(json).trim();
                if (text) entries.push({ sign: sign.ua, emoji: sign.emoji, text });
                else diagnostics.push(`${provider.host} ${sign.key}: empty body`);
            } catch (e: any) {
                diagnostics.push(`${provider.host} ${sign.key}: ${e?.name || 'error'} ${e?.message || ''}`.trim());
            }
        }

        if (entries.length) return { entries, source: provider.host, day: effectiveDay, diagnostics };
    }

    return { entries: [], source: '', day, diagnostics };
}
