/**
 * Що можна віддавати на гравіювання, а що ні.
 *
 * ПРАВИЛО: емодзі на гравіювання не йдуть (Діана, 2026-09-07). Це не технічне
 * обмеження, яке колись обійдуть, а правило майстерні, тож воно діє скрізь, де
 * напис їде під лазер.
 *
 * Чому. Лазер вигравіює одну глибину на одному матеріалі: у нього немає ні
 * кольору, ні півтонів. Кольорове емодзі перетворюється на суцільну чорну
 * пляму, а якщо гліфа немає у шрифті — на порожній квадрат. TM-001288 замовив
 * металеву пластину з написом «Із тисячі доріг — одна привела нас одне до
 * одного 🤍 11.07.2026 🤍», і обидва сердечка поїхали б у майстерню саме так.
 *
 * ЩО САМЕ ВВАЖАЄМО ЕМОДЗІ, І ЧОМУ НЕ ВСЕ ПІДРЯД. Прибираємо символи з
 * властивістю Emoji_Presentation, тобто ті, які за замовчуванням малюються
 * кольоровою картинкою. Знаки, що за замовчуванням лишаються текстовими —
 * ♡ ♥ ☀ ✓ ★ — це звичайна типографіка, її на обкладинках використовують
 * свідомо (див. lib/print/font-coverage: заради роздільника «─── ♡ ───» туди
 * окремо доклали шрифти). Забрати їх разом з емодзі означало б виправити одну
 * помилку, створивши іншу.
 *
 * Окремо прибираємо селектор варіації U+FE0F разом із його основою: ❤️ — це
 * текстове ❤ плюс прохання намалювати його кольоровим, тобто емодзі за
 * задумом автора. Так само йдуть зʼєднувач ZWJ, модифікатори тону шкіри,
 * прапори й основа клавішного емодзі.
 */

/** Типи оздоблення, які фізично гравіюються лазером. */
export const ENGRAVED_DECO_TYPES = ['metal', 'graviruvannya', 'flex'] as const;

export type EngravedDecoType = (typeof ENGRAVED_DECO_TYPES)[number];

/** Чи піде напис цього оздоблення під лазер. */
export function isEngravedDeco(decoType: string | null | undefined): boolean {
    return (ENGRAVED_DECO_TYPES as readonly string[]).includes(String(decoType ?? ''));
}

const VARIATION_SELECTOR_16 = 0xfe0f;
const ZERO_WIDTH_JOINER = 0x200d;
const KEYCAP = 0x20e3;
const SKIN_TONE_FIRST = 0x1f3fb;
const SKIN_TONE_LAST = 0x1f3ff;
const REGIONAL_FIRST = 0x1f1e6;
const REGIONAL_LAST = 0x1f1ff;

const isEmojiPresentation = (ch: string) => /\p{Emoji_Presentation}/u.test(ch);
const isEmojiBase = (ch: string) => /\p{Emoji}/u.test(ch);

function isJoiner(cp: number): boolean {
    return cp === VARIATION_SELECTOR_16
        || cp === ZERO_WIDTH_JOINER
        || cp === KEYCAP
        || (cp >= SKIN_TONE_FIRST && cp <= SKIN_TONE_LAST)
        || (cp >= REGIONAL_FIRST && cp <= REGIONAL_LAST);
}

export interface EngravableText {
    /** Напис без емодзі, з прибраними подвійними пробілами. */
    text: string;
    /** Що саме прибрали — щоб сказати про це вголос, а не мовчки з'їсти. */
    dropped: string[];
}

/**
 * Прибирає з напису емодзі.
 *
 * Пробіли після прибраного склеюються, бо «одного 🤍 11.07» без склеювання
 * лишило б подвійний пробіл посеред гравіювання. Крайні пробіли зрізаються з
 * тієї ж причини.
 */
export function stripEmoji(text: string | null | undefined): EngravableText {
    const chars = Array.from(String(text ?? ''));
    const dropped: string[] = [];
    let out = '';

    for (let i = 0; i < chars.length; i++) {
        const ch = chars[i];
        const cp = ch.codePointAt(0) ?? 0;

        if (isJoiner(cp)) { dropped.push(ch); continue; }

        // Основа, за якою стоїть селектор варіації, — це емодзі за задумом
        // автора, навіть якщо сама по собі вона текстова (❤ + FE0F).
        const nextCp = chars[i + 1]?.codePointAt(0) ?? 0;
        if (isEmojiPresentation(ch) || (isEmojiBase(ch) && nextCp === VARIATION_SELECTOR_16)) {
            dropped.push(ch);
            continue;
        }

        out += ch;
    }

    return {
        text: out.replace(/[^\S\n]{2,}/g, ' ').replace(/[^\S\n]+$/gm, '').replace(/^[^\S\n]+/gm, '').trim(),
        dropped: Array.from(new Set(dropped)),
    };
}

/** Чи є в написі те, що ми не гравіюємо. */
export function hasEmoji(text: string | null | undefined): boolean {
    return stripEmoji(text).dropped.length > 0;
}
