/**
 * Коли самовивіз брати не можна.
 *
 * ПРАВИЛО: терміновий глянцевий журнал самовивозом не віддається (Діана,
 * 08.09.2026). Терміновий журнал робиться під дедлайн і їде відразу; лишати
 * його чекати, доки клієнт колись під'їде, означає зайняти виробництво
 * терміновою роботою і покласти результат на полицю.
 *
 * ЩО ЦЕ ЛАМАЛО ДОСІ. Форма брифу журналу взагалі не питає про доставку, а
 * колонка delivery_method не приймає порожнього значення, тож туди писався
 * 'pickup' із коментарем «команда узгодить пізніше». Ніхто нічого не
 * узгоджував: значення так і лишалось. У базі ВСІ замовлення «Глянцевий
 * журнал про людину» стоять як самовивіз — девʼять із останніх пʼятнадцяти, —
 * і термінові в тому числі. Тобто правило порушувалось не тому, що клієнт
 * обрав самовивіз, а тому, що ми самі його проставляли.
 *
 * Тому тут дві різні речі, і плутати їх не можна: 'other' означає «спосіб
 * доставки ще не обрано», а 'pickup' — свідомий вибір клієнта. Значення
 * 'other' уже є в обмеженні таблиці і на ньому стоїть більшість замовлень,
 * тож міграція не потрібна.
 */

/** Значення delivery_method, яким позначаємо «ще не обрано». */
export const DELIVERY_NOT_CHOSEN = 'other';

export interface OrderItemLike {
    slug?: string | null;
    product_slug?: string | null;
    product_name?: string | null;
    name?: string | null;
    options?: Record<string, any> | null;
}

const text = (v: unknown) => String(v ?? '').trim().toLowerCase();

/** Глянцевий журнал — за артикулом або за назвою. */
export function isGlossyMagazine(item: OrderItemLike): boolean {
    const slug = text(item?.slug || item?.product_slug);
    if (slug.includes('glossy-magazine')) return true;
    const name = text(item?.product_name || item?.name);
    return name.includes('глянцев') && name.includes('журнал');
}

/**
 * Терміновість позиції.
 *
 * Значення в замовленнях записані трьома різними способами — 'urgent',
 * 'Термінова 1–3 дні (+30%)', 'Термінове виготовлення (+30%)', — тож
 * розпізнаємо за змістом, а не за точним рядком. 'standard' — це НЕ
 * терміновість, і саме тому просто шукати підрядок «термін» замало: у слові
 * «стандартна» його немає, але майбутнє «нетермінова» зламало б перевірку.
 */
export function isUrgentItem(item: OrderItemLike): boolean {
    const options = item?.options && typeof item.options === 'object' ? item.options : {};
    const raw = Object.entries(options)
        .filter(([k]) => /терміновість|urgency|терміновіст/i.test(k))
        .map(([, v]) => text(v))
        .join(' ');
    if (!raw) return false;
    if (/^\s*standard\s*$/.test(raw) || raw.includes('стандарт')) return false;
    return raw.includes('urgent') || /термінов/.test(raw);
}

/** Позиція, яку не можна віддавати самовивозом. */
export function blocksPickup(item: OrderItemLike): boolean {
    return isGlossyMagazine(item) && isUrgentItem(item);
}

/**
 * Чи можна для цього кошика обрати самовивіз.
 *
 * Достатньо однієї позиції, що забороняє: замовлення їде одним відправленням.
 */
export function pickupAllowed(items: OrderItemLike[] | null | undefined): boolean {
    if (!Array.isArray(items)) return true;
    return !items.some(blocksPickup);
}

/** Чому самовивіз недоступний — текст для клієнта. */
export const PICKUP_BLOCKED_REASON =
    'Терміновий глянцевий журнал ми відправляємо перевізником, щоб він потрапив до вас у строк. Самовивіз для нього недоступний.';
