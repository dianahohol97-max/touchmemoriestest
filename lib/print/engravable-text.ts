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

import { detectDecoType } from '@/lib/editor/utils';

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

/**
 * Написи позиції, які фізично підуть під лазер, і що в них не гравіюється.
 *
 * ЧОМУ ЦЕ ЧИТАЄ ЗАМОВЛЕННЯ, А НЕ ПОЛЕ ВВОДУ. Фільтр у полі прибирає емодзі
 * там, де він стоїть, — а стоїть він не всюди. Напис потрапляє в замовлення
 * шістьма різними шляхами: оздоблення в конструкторі, вільний напис на
 * обкладинці, персоналізований напис у картці товару, поле напису для
 * фотодруку, конфігуратор книги побажань і бриф дизайнерського сервісу. Чотири
 * замовлення з емодзі (TM-001165, TM-001203, TM-001204, TM-001209) прийшли
 * саме тими шляхами, де фільтра немає, і ніхто цього не побачив до друку.
 *
 * Тому правило дивиться на ГОТОВУ позицію: які б ключі не використав той чи
 * інший потік, тут вони в одному місці. Функція нічого не змінює — вона лише
 * називає проблему, щоб менеджер побачив її до запуску у виробництво.
 *
 * ЩО ВВАЖАЄМО ГРАВІЮВАННЯМ. Напис на самій обкладинці з м'якого матеріалу —
 * це завжди лазер або флекс: на велюр, шкірзамінник і тканину не друкують.
 * Друкована обкладинка кольорова, там емодзі проходить, тож її пропускаємо.
 * Напис на ВСТАВЦІ слухається типу вставки: акрил і фотовставка друковані,
 * метал гравіюється.
 */
export interface EngravedInscription {
    /** Ключ опції, під яким напис лежить у позиції. */
    key: string;
    /** Текст, як його ввів клієнт. */
    text: string;
    /** Символи, які на виріб не потраплять. */
    dropped: string[];
}

const norm = (s: unknown) => String(s ?? '').trim().toLowerCase();

/** Напис на вставці — його доля залежить від того, яка це вставка. */
const PLATE_INSCRIPTION_RE = /^напис\s*на\s*декорації$/i;
/** Написи на самій обкладинці, якими б словами їх не назвав той чи інший потік. */
const COVER_INSCRIPTION_RE = /^(текст\s*напису|напис\s*на\s*обкладин(ці|ку)|текст\s*на\s*обкладинці)$/i;

const MATERIAL_RE = /^(матеріал\s*обкладинки|обкладинка)$/i;
const DECO_RE = /^(декорація\s*обкладинки|оздоблення|тип\s*оздоблення)$/i;

export function engravedInscriptions(options: Record<string, any> | null | undefined): EngravedInscription[] {
    if (!options || typeof options !== 'object') return [];

    const valueOf = (re: RegExp): string => {
        for (const [k, v] of Object.entries(options)) {
            if (re.test(String(k).trim())) {
                const val = String(v ?? '').trim();
                if (val) return val;
            }
        }
        return '';
    };

    // Друкована обкладинка кольорова — на ній емодзі друкується як є.
    const printedCover = /друков|printed/.test(norm(valueOf(MATERIAL_RE)));
    const plateDeco = detectDecoType(valueOf(DECO_RE));

    const out: EngravedInscription[] = [];
    for (const [key, raw] of Object.entries(options)) {
        const text = String(raw ?? '').trim();
        if (!text) continue;
        const k = String(key).trim();

        const engraved = PLATE_INSCRIPTION_RE.test(k)
            ? isEngravedDeco(plateDeco)
            : COVER_INSCRIPTION_RE.test(k) && !printedCover;
        if (!engraved) continue;

        const { dropped } = stripEmoji(text);
        if (dropped.length > 0) out.push({ key: k, text, dropped });
    }
    return out;
}
