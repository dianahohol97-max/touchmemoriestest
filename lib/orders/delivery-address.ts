/**
 * Куди везти замовлення — одна відповідь на дві колонки.
 *
 * ЧОМУ ЦЕ ОКРЕМИЙ МОДУЛЬ. Адресу доставки пишуть два різні потоки оформлення,
 * і кожен у своє місце.
 *
 *   • кошик → чекаут пише `orders.delivery_address` як обʼєкт:
 *       { city, branch }                     — Нова Пошта
 *       { country, city, postal, address }   — міжнародна відправка
 *   • потік «з дизайнером» (/order) пише місто й відділення в
 *     `orders.custom_attributes` як { city, address }, а `delivery_address`
 *     лишає порожнім обʼєктом.
 *
 * Через це вивантаження в KeyCRM, яке читало ЛИШЕ `delivery_address`, везло в
 * CRM порожнє місто й порожнє відділення для кожного замовлення з дизайнером:
 * 47 зі 131 замовлень сайту за 90 днів приїхали до менеджерів без адреси, хоча
 * в базі вона була. TM-001313 — саме такий випадок, TM-001314 — сусідній, де
 * адреса лежала «правильно» і доїхала.
 *
 * Друга колонка не помилка, яку треба випрямити міграцією: обидва потоки
 * робочі, і кожен пише туди, звідки читає свій власний екран. Тому джерело
 * тут обирається ЯВНО і повертається разом із адресою — щоб наступний, хто
 * сюди зазирне, бачив, що колонок дві, і не викинув «зайву» гілку.
 */

export type DeliveryAddressSource = 'delivery_address' | 'custom_attributes' | 'none';

export interface DeliveryAddress {
    /** Місто або населений пункт. */
    city: string;
    /** Відділення, поштомат або вулиця — те, що в CRM зветься точкою отримання. */
    point: string;
    /** Країна та індекс — лише для міжнародних відправлень. */
    country: string;
    postal: string;
    /** Звідки взято адресу. Порожня адреса повертає 'none'. */
    source: DeliveryAddressSource;
}

const str = (v: any): string => String(v ?? '').trim();

const EMPTY: DeliveryAddress = { city: '', point: '', country: '', postal: '', source: 'none' };

/**
 * Адреса доставки замовлення.
 *
 * Порядок джерел: спочатку `delivery_address`, бо його заповнює чекаут і воно
 * структуроване; далі `custom_attributes`, куди пише потік з дизайнером.
 * Часткові дані НЕ змішуються між джерелами: якщо в першому є місто, адреса
 * береться з нього цілком, інакше менеджер отримає місто з одного замовлення
 * і відділення з іншого стану того ж замовлення.
 */
export function readDeliveryAddress(order: any): DeliveryAddress {
    const raw = order?.delivery_address;

    // Фотодрук зі своєї міні-форми надсилає адресу одним рядком, а не обʼєктом.
    // Для CRM це точка отримання: міста в такому рядку окремо немає.
    if (typeof raw === 'string' && str(raw)) {
        return { city: '', point: str(raw), country: '', postal: '', source: 'delivery_address' };
    }

    if (raw && typeof raw === 'object') {
        const city = str(raw.city);
        const point = str(raw.branch) || str(raw.address);
        if (city || point) {
            return {
                city,
                point,
                country: str(raw.country),
                postal: str(raw.postal),
                source: 'delivery_address',
            };
        }
    }

    const attrs = order?.custom_attributes;
    if (attrs && typeof attrs === 'object') {
        const city = str(attrs.city);
        const point = str(attrs.address) || str(attrs.branch);
        if (city || point) {
            return { city, point, country: '', postal: '', source: 'custom_attributes' };
        }
    }

    return { ...EMPTY };
}

/**
 * Адреса одним рядком для людини — для відповідей Софії й будь-якого іншого
 * місця, де адресу треба просто НАЗВАТИ.
 *
 * Існує через живий дефект: у фактах про замовлення стояло пряме
 * `${order.delivery_address}`, а ця колонка має тип jsonb і тримає то рядок
 * (830 замовлень, здебільшого дзеркалених з KeyCRM), то обʼєкт { city, branch }
 * (277 замовлень із чекауту). Для обʼєкта рядковий шаблон давав рівно
 * «[object Object]», і саме це бачила модель у фактах, коли колега питав, куди
 * везти замовлення.
 *
 * Повертає порожній рядок, коли адреси немає взагалі — відсутність адреси
 * лишається фактом, який називає той, хто викликає, а не підміняється
 * правдоподібним текстом.
 */
export function formatDeliveryAddress(order: any): string {
    const a = readDeliveryAddress(order);
    return [a.country, a.city, a.point, a.postal].map(s => String(s || '').trim()).filter(Boolean).join(', ');
}
