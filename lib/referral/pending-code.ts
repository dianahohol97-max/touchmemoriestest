/**
 * Browser-side access to the referral code a visitor arrived with.
 *
 * ReferralCapture stashes ?ref=CODE here on landing; the signup forms read it
 * back so the code can travel into Supabase auth user_metadata as well. Two
 * independent carriers on purpose: localStorage dies if the friend confirms
 * their email on a different device (phone vs desktop), and the metadata copy
 * is what lets /api/referral/capture still link them there.
 *
 * Kept in one module so the register page and AuthModal cannot drift apart.
 *
 * ДВА ЧИТАЧІ, І ЦЕ НАВМИСНО (Діана, 16.09.2026). Один і той самий ключ несе дві
 * різні речі, і строк придатності в них різний:
 *
 *  · `readPendingReferralCode()` — для звʼязку «друг запросив друга». Він
 *    створюється при реєстрації, тобто за лічені хвилини після переходу, і сам
 *    звʼязок не старіє. Строку тут немає.
 *
 *  · `readAttributableReferralCode()` — для партнерської атрибуції на чекауті.
 *    Ось вона старіє: партнерське посилання означає комісію з замовлення, і
 *    платити її за перехід дворічної давнини немає за що. Вікно — девʼяносто
 *    днів під тревел-цикл: подорож, повернення, розбір фотографій. Замовлення
 *    справді визріває повільно, але не роками.
 *
 * Формат запису — той самий JSON із часом, що й у промокоді з розсилки
 * (lib/referral/promo-code.ts). Голий рядок без часу теж читається: так
 * виглядають записи, зроблені до цієї зміни, і вважати їх простроченими
 * означало б забрати комісію в партнера за перехід, який стався вчора. Такий
 * запис лічиться свіжим, поки ReferralCapture не перепише його з часом при
 * наступному переході.
 */
export const REF_STORAGE_KEY = 'tm_ref_code';

/** Скільки живе партнерська атрибуція, у мілісекундах. */
export const REF_ATTRIBUTION_TTL_MS = 90 * 24 * 60 * 60 * 1000;

/** Партнерські коди бувають кирилицею — їх генерують з назв агенцій. */
const CODE_RE = /^[A-Za-z0-9А-ЯІЇЄҐа-яіїєґ]{4,16}$/;

/** Що саме кладеться в сховище. Час потрібен для строку атрибуції. */
export function serializeReferralCode(code: string, now: number = Date.now()): string {
    return JSON.stringify({ code: code.trim().toUpperCase(), ts: now });
}

/**
 * Розібрати те, що лежить у сховищі.
 *
 * `ttlMs = null` означає «без строку» — саме так читає реферальний звʼязок.
 * Чисте, без доступу до window, щоб його можна було перевірити тестом.
 */
export function parseStoredReferralCode(
    raw: string | null | undefined,
    now: number = Date.now(),
    ttlMs: number | null = null,
): string | null {
    if (!raw) return null;
    let code = '';
    let ts: number | null = null;
    const text = String(raw).trim();
    if (text.startsWith('{')) {
        try {
            const parsed = JSON.parse(text);
            code = String(parsed?.code ?? '');
            ts = Number.isFinite(Number(parsed?.ts)) ? Number(parsed.ts) : null;
        } catch {
            return null;
        }
    } else {
        code = text;
    }
    const normalised = code.trim().toUpperCase();
    if (!CODE_RE.test(normalised)) return null;
    if (ttlMs !== null && ts !== null && now - ts > ttlMs) return null;
    return normalised;
}

/** Відкласти код, із яким прийшли. Мовчить, якщо сховище недоступне. */
export function storeReferralCode(code: string, now: number = Date.now()): void {
    if (typeof window === 'undefined') return;
    const normalised = String(code ?? '').trim().toUpperCase();
    if (!CODE_RE.test(normalised)) return;
    try {
        window.localStorage.setItem(REF_STORAGE_KEY, serializeReferralCode(normalised, now));
    } catch {
        /* приватний режим або заблоковане сховище — не привід ламати сторінку */
    }
}

/** The stored code, normalised, or null outside the browser / when unset. */
export function readPendingReferralCode(): string | null {
    if (typeof window === 'undefined') return null;
    try {
        return parseStoredReferralCode(window.localStorage.getItem(REF_STORAGE_KEY));
    } catch {
        return null;
    }
}

/**
 * Код, за яким ще можна нарахувати комісію партнеру: той самий запис, але зі
 * строком. Після девʼяноста днів повертає null, і чекаут просто не підставляє
 * нічого.
 */
export function readAttributableReferralCode(now: number = Date.now()): string | null {
    if (typeof window === 'undefined') return null;
    try {
        return parseStoredReferralCode(
            window.localStorage.getItem(REF_STORAGE_KEY),
            now,
            REF_ATTRIBUTION_TTL_MS,
        );
    } catch {
        return null;
    }
}
