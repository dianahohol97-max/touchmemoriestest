/**
 * Промокод, із яким відвідувачка прийшла за посиланням із листа.
 *
 * Навіщо. Листи вітальної серії, повернення й привітання з днем народження
 * показують код і обіцяють -7%, а посилання в них веде просто на каталог, без
 * коду. Чекаут уміє застосовувати ?promo=КОД сам — цю механіку зробили для
 * партнерських посилань — але доти, доки код у ньому не зʼявиться, вона нічого
 * не робить. Клієнтка бачила знижку в листі, а на сайті мусила згадати код і
 * ввести його вручну: «бачила, що маю від вас -7% знижки, чи можливо якось це
 * врахувати, бо відразу перекидає на оплату моно».
 *
 * Самого коду в адресі мало. Параметр живе рівно до першого переходу: з
 * каталогу на товар він уже не потрапляє, а до чекауту тим паче. Тому код
 * відкладається так само, як реферальний, і читається звідти.
 *
 * Термін. Реферальний код лежить без обмежень, бо звʼязок «друг → запросив»
 * не старіє. Промокод — акційний, тож через місяць він перестає читатися. Це
 * не заміна перевірці на боці сервера (вона лишається головною і знає про
 * одноразовість та строк дії), а запобіжник від того, щоб давній код тихо
 * підставлявся в кожне наступне замовлення.
 */

export const PROMO_STORAGE_KEY = 'tm_promo_code';

/** Скільки відкладений промокод лишається чинним, у мілісекундах. */
export const PROMO_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/** Партнерські коди бувають кирилицею — їх генерують з назв агенцій. */
const CODE_RE = /^[A-Za-z0-9А-ЯІЇЄҐа-яіїєґ]{4,16}$/;

/** Чи годиться рядок на промокод. Та сама перевірка, що й у чекауті. */
export function isPromoCodeShaped(code: string | null | undefined): boolean {
    const c = String(code ?? '').trim();
    return CODE_RE.test(c);
}

/** Що саме кладеться в сховище. Час потрібен, щоб код не жив вічно. */
export function serializePromoCode(code: string, now: number = Date.now()): string {
    return JSON.stringify({ code: code.trim().toUpperCase(), ts: now });
}

/**
 * Читання відкладеного коду: null, якщо його немає, він зіпсований,
 * не схожий на код або вже застарів.
 *
 * Розуміє і голий рядок без часу — на випадок, якщо десь колись запишуть
 * простіше; такий запис вважається свіжим, бо іншої інформації немає.
 */
export function parseStoredPromoCode(
    raw: string | null | undefined,
    now: number = Date.now(),
    ttlMs: number = PROMO_TTL_MS,
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
    if (!isPromoCodeShaped(code)) return null;
    if (ts !== null && now - ts > ttlMs) return null;
    return code.trim().toUpperCase();
}

/** Відкласти код, із якого прийшли. Мовчить, якщо сховище недоступне. */
export function storePromoCode(code: string, now: number = Date.now()): void {
    if (typeof window === 'undefined' || !isPromoCodeShaped(code)) return;
    try {
        window.localStorage.setItem(PROMO_STORAGE_KEY, serializePromoCode(code, now));
    } catch {
        /* приватний режим або заблоковане сховище — не привід ламати сторінку */
    }
}

/** Відкладений код, готовий до підстановки, або null. */
export function readStoredPromoCode(now: number = Date.now()): string | null {
    if (typeof window === 'undefined') return null;
    try {
        return parseStoredPromoCode(window.localStorage.getItem(PROMO_STORAGE_KEY), now);
    } catch {
        return null;
    }
}

/**
 * Посилання з листа, яке несе промокод.
 *
 * Зберігає те, що вже є в адресі, не дублює параметр і кодує сам код —
 * кирилиця в партнерських кодах інакше поїхала б.
 */
export function withPromoCode(url: string, code?: string | null): string {
    const base = String(url ?? '').trim();
    if (!base || !isPromoCodeShaped(code)) return base;
    const value = String(code).trim().toUpperCase();
    const [withoutHash, hash] = base.split('#');
    if (/[?&]promo=/i.test(withoutHash)) return base;
    const sep = withoutHash.includes('?') ? '&' : '?';
    const next = `${withoutHash}${sep}promo=${encodeURIComponent(value)}`;
    return hash ? `${next}#${hash}` : next;
}
