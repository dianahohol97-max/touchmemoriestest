/**
 * Коли слати фотографу листи про галереї — чиста логіка, без бази й пошти,
 * щоб її можна було перевірити тестами (tests/photographer-notices.test.ts).
 * Хто кличе ці функції і як ставить позначки — lib/photographers/notices.ts.
 *
 * Кожен лист іде рівно один раз на подію (гоча 15): сторож, який кричить
 * «вовк», вчить фотографа не читати наших листів.
 */

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

/** Скільки днів попередження обіцяємо фотографу. */
export const EXPIRY_LEAD_DAYS = 3;

/**
 * Як часто біжить крон, що шле попередження (cleanup-galleries, щоночі).
 *
 * Чому це входить у правило. Галерея спливає о будь-якій годині, а крон
 * заглядає раз на добу. Якби лист ішов лише тоді, коли лишилося «3 дні або
 * менше», то між двома прогонами фотограф отримував би від двох до трьох діб
 * замість трьох: галерея Ірини Владової спливає 06.10 о 15:31 UTC, прогін
 * 03.10 о 03:30 бачить 3,5 доби і мовчить, а наступний, 04.10, приносить лист
 * за 2,5 доби. Тому лист іде на ОСТАННЬОМУ прогоні, після якого до терміну
 * лишилося б уже менше трьох діб: фотограф завжди має щонайменше три повні
 * доби, а найбільше — чотири.
 */
export const EXPIRY_CRON_PERIOD_MS = DAY;

export interface ExpiryNoticeSubject {
    expires_at: string;
    files_purged_at: string | null;
    /** expires_at, про який уже пішов лист; див. міграцію 20260925. */
    expiry_notice_for: string | null;
}

const sameInstant = (a: string | null, b: string | null) =>
    !!a && !!b && new Date(a).getTime() === new Date(b).getTime();

/** Слати «галерея скоро згасне» саме зараз? */
export function shouldSendExpiryNotice(g: ExpiryNoticeSubject, now: Date): boolean {
    if (g.files_purged_at) return false;
    const left = new Date(g.expires_at).getTime() - now.getTime();
    if (!Number.isFinite(left) || left <= 0) return false;
    if (left >= EXPIRY_LEAD_DAYS * DAY + EXPIRY_CRON_PERIOD_MS) return false;
    // Позначка про ІНШИЙ термін — це лист до продовження, він уже не рахується.
    return !sameInstant(g.expiry_notice_for, g.expires_at);
}

/** Верхня межа вікна для запиту кандидатів (усе, що спливає раніше). */
export function expiryNoticeHorizon(now: Date): Date {
    return new Date(now.getTime() + EXPIRY_LEAD_DAYS * DAY + EXPIRY_CRON_PERIOD_MS);
}

/**
 * Поріг листа «місце закінчується» і поріг, нижче якого лист знову стає
 * можливим.
 *
 * Чому скидання на 80%, а не на 90%. Із порогом скидання, рівним порогу листа,
 * фотограф на 91%, який стер кілька кадрів і дозавантажив їх, отримував би лист
 * щоразу. Десять пунктів — це 410 МБ на безкоштовному тарифі (приблизно одна
 * невелика зйомка) і 50 ГБ на «Студії»: щоб опуститися так низько, треба
 * справді прибрати галерею, а не кілька файлів. Нижче за 80% не беремо, бо
 * тоді людина, яка прибрала одну зйомку і наповнила місце новою, лишилася б
 * без попередження.
 */
export const STORAGE_NOTICE_RATIO = 0.9;
export const STORAGE_REARM_RATIO = 0.8;

export type StorageNoticeAction = 'send' | 'rearm' | 'none';

/**
 * Що робити з листом про місце.
 *
 * `ratioBefore` — частка до цього аплоаду. Звільнити місце можна багатьма
 * шляхами (видалити фото, дочекатися очищення, змінити тариф), і жоден із них
 * не проходить через аплоад. Але наступне перетинання 90% — завжди аплоад, і
 * він знає, скільки було до нього. Тож якщо до файлу було менше 80%, фотограф
 * устиг звільнити місце, і лист можна слати знову, навіть коли один великий
 * файл підняв його одразу вище 90%.
 */
export function storageNoticeAction(input: {
    ratioBefore: number;
    ratioAfter: number;
    sentAt: string | null;
}): StorageNoticeAction {
    const armed = !input.sentAt || input.ratioBefore < STORAGE_REARM_RATIO;
    if (input.ratioAfter >= STORAGE_NOTICE_RATIO) return armed ? 'send' : 'none';
    const dippedBelow = input.ratioBefore < STORAGE_REARM_RATIO || input.ratioAfter < STORAGE_REARM_RATIO;
    return input.sentAt && dippedBelow ? 'rearm' : 'none';
}

/**
 * Скільки часу після очищення лист «файли видалено» ще можна дослати, якщо
 * перша спроба не вдалася. Вікно ж захищає від ретроактивних листів: галереї,
 * очищені до появи цього листа (останнє — 04.09.2026), у нього не потрапляють.
 */
export const PURGE_NOTICE_WINDOW_MS = 3 * DAY;

export interface PurgeNoticeSubject {
    files_purged_at: string | null;
    purge_notice_sent_at: string | null;
}

export function shouldSendPurgeNotice(g: PurgeNoticeSubject, now: Date): boolean {
    if (!g.files_purged_at || g.purge_notice_sent_at) return false;
    const since = now.getTime() - new Date(g.files_purged_at).getTime();
    return since >= 0 && since <= PURGE_NOTICE_WINDOW_MS;
}

/**
 * Демо-кабінет для сторінки «галереї для фотографів» (demo-seed). Скриньки за
 * цією адресою немає, лист туди повертався б відмовою.
 */
export const DEMO_PHOTOGRAPHER_EMAIL = 'demo-gallery@touchmemories.com.ua';

export function canEmailPhotographer(p: { email?: string | null; is_active?: boolean | null } | null | undefined): boolean {
    if (!p || p.is_active === false) return false;
    const email = (p.email || '').trim().toLowerCase();
    if (!email || !email.includes('@')) return false;
    return email !== DEMO_PHOTOGRAPHER_EMAIL;
}

/** «6 жовтня 2026» і «18:31» за Києвом — у листі дата й час окремо. */
export function kyivDateParts(iso: string): { date: string; time: string } {
    const d = new Date(iso);
    const date = new Intl.DateTimeFormat('uk-UA', {
        day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Kyiv',
    }).format(d).replace(/\s*р\.$/, '');
    const time = new Intl.DateTimeFormat('uk-UA', {
        hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: 'Europe/Kyiv',
    }).format(d);
    return { date, time };
}
