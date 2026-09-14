import type { ConsentCategory } from '@/lib/consent/types';

/**
 * Дія людини на сайті, розкладена на рядки журналу згод.
 *
 * Чому це окремий модуль. Таблиця consent_log приймає НЕ довільний текст:
 * на consent_type і на source стоять CHECK-обмеження, яких немає ніде в
 * репозиторії — таблицю створили руками в дашборді Supabase. Код писав у неї
 * назви ДІЙ ('cookies_accepted', 'terms_accepted', 'account_deleted'), а база
 * чекає назви КАТЕГОРІЙ, і кожна вставка відхилялася. На 14.09.2026 в таблиці
 * було рівно нуль рядків при 366 підписниках, хоча чотири маршрути «писали» в
 * неї і всі чотири відповідали успіхом.
 *
 * Тому переклад із мови інтерфейсу в мову таблиці живе тут, в одному місці й
 * без запитів, і покритий тестом. Дозволений словник бази продубльовано
 * константою: якщо хтось додасть дію з новою категорією, тест упаде тут, а не
 * мовчазна вставка в проді.
 */

/** Рівно те, що дозволяє CHECK на consent_log.consent_type. */
export const ALLOWED_CONSENT_TYPES = ['essential', 'analytics', 'marketing', 'functional', 'terms', 'privacy'] as const;
export type ConsentType = (typeof ALLOWED_CONSENT_TYPES)[number];

/** Рівно те, що дозволяє CHECK на consent_log.source. */
export const ALLOWED_SOURCES = ['web', 'mobile', 'api', 'admin'] as const;

/** Дії, які вміє записати маршрут /api/consent/log. */
export type ConsentAction =
    | 'cookies_accepted'
    | 'cookies_rejected'
    | 'cookies_partial'
    | 'terms_accepted'
    | 'marketing_accepted'
    | 'marketing_withdrawn';

export interface ConsentRow {
    consent_type: ConsentType;
    granted: boolean;
}

/** Категорії банера. essential завжди true — без нього сайт не працює. */
const COOKIE_CATEGORIES: ConsentCategory[] = ['essential', 'functional', 'analytics', 'marketing'];

const truthy = (value: unknown): boolean => value === true;

/**
 * Розкладає дію на рядки журналу — по одному на категорію.
 *
 * Один клік по банеру дає ЧОТИРИ рядки, а не один із JSON-блобом. Так
 * побудована таблиця, і так корисніше: питання «скільки людей дозволили
 * маркетинг» стає звичайним count по consent_type, а не розбором jsonb.
 *
 * Незнайома дія дає порожній масив. Маршрут на це відповідає помилкою, і це
 * навмисно: мовчки не записати нічого — саме той дефект, від якого лікуємося.
 */
export function buildConsentRows(action: string, categories?: Record<string, unknown> | null): ConsentRow[] {
    const cats = (categories && typeof categories === 'object') ? categories : {};

    switch (action) {
        case 'cookies_accepted':
        case 'cookies_rejected':
        case 'cookies_partial':
            return COOKIE_CATEGORIES.map(category => ({
                consent_type: category as ConsentType,
                // essential не питають — його не можна вимкнути, і банер шле
                // його true в усіх трьох варіантах. Решта береться як є.
                granted: category === 'essential' ? true : truthy(cats[category]),
            }));

        // Один чекбокс у реєстрації покриває два документи: «Політика
        // конфіденційності» ТА «Умови використання». Тож і рядків два — інакше
        // з журналу не видно, під чим саме людина підписалася.
        case 'terms_accepted':
            return [
                { consent_type: 'terms', granted: true },
                { consent_type: 'privacy', granted: true },
            ];

        case 'marketing_accepted':
            return [{ consent_type: 'marketing', granted: true }];

        case 'marketing_withdrawn':
            return [{ consent_type: 'marketing', granted: false }];

        default:
            return [];
    }
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Пошта, яку прислав браузер, зведена до придатного вигляду.
 *
 * Маршрут публічний, тож прислати сюди можна будь-що. Підписка з футера й
 * попапа відбувається без входу в акаунт, і без пошти рядок згоди не має
 * субʼєкта — тобто марний. Тому пошту приймаємо, але тільки схожу на пошту і
 * обрізану; коли людина залогінена, адреса з сесії головніша за прислану.
 */
export function readConsentEmail(value: unknown): string | null {
    if (typeof value !== 'string') return null;
    const email = value.trim().toLowerCase();
    return email.length <= 320 && EMAIL_RE.test(email) ? email : null;
}
