import { FULL_TOLERANCE_UAH } from '@/lib/orders/payment-state';
import { pluralUk as plural } from '@/lib/text/plural-uk';

/**
 * Замовлення, які зависли, і коли ми востаннє писали клієнту.
 *
 * Привід — фідбек менеджерки: за замовленням ніхто не закріплений, ніхто не
 * бачить, кому писали й коли, тож воно тихо зависає і його скасовують.
 *
 * Модуль чистий: жодних запитів і жодного React. Сам відбір робить SQL —
 * функція orders_needing_attention, бо список в адмінці фільтрує вже отриману
 * сторінку на 200 найновіших рядків, а зависле замовлення з неї давно випало.
 * Тут живуть константа порогу, форматування дати й TS-двійник правила, за яким
 * можна перевірити SQL тестом.
 */

/**
 * Скільки годин без листа означає «замовлення зависло».
 *
 * ОДНЕ місце на весь код. Поріг їде параметром у SQL-функцію
 * orders_needing_attention саме тому: щоб не зʼявилася друга копія числа в базі.
 */
export const ATTENTION_AFTER_HOURS = 48;

/**
 * Джерела, які фільтр не показує.
 *
 * Дзеркалені з KeyCRM прибрані не тому, що вони менш важливі, а тому, що сайт
 * цим клієнтам не пише взагалі: на 252 таких замовлення припадає рівно нуль
 * листів, тож із фільтра «немає контакту» вони б ніколи не вийшли. Список, який
 * неможливо розчистити, перестають відкривати.
 *
 * Це параметр, а не зашите правило: щойно почнемо писати клієнтам із CRM,
 * достатньо передати порожній масив, і міграція не потрібна.
 */
export const ATTENTION_EXCLUDED_SOURCES = ['keycrm'] as const;

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

/**
 * «3 дні тому» для колонки списку. Порожня дата дає «—».
 *
 * Тире означає «листів не було жодного», а не «давно». Це різні речі: перше —
 * замовлення, якого ніхто не торкався, друге — те, про яке забули. Обидва
 * потрапляють у фільтр, але менеджер має бачити, що саме перед ним.
 */
export function formatLastContact(value: string | Date | null | undefined, now: Date = new Date()): string {
    if (!value) return '—';
    const then = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(then.getTime())) return '—';

    const diff = now.getTime() - then.getTime();
    if (diff < 0) return 'щойно';
    if (diff < HOUR_MS) return 'менш як годину тому';

    if (diff < DAY_MS) {
        const hours = Math.floor(diff / HOUR_MS);
        return `${hours} ${plural(hours, 'година', 'години', 'годин')} тому`;
    }

    const days = Math.floor(diff / DAY_MS);
    return `${days} ${plural(days, 'день', 'дні', 'днів')} тому`;
}

export interface AttentionInput {
    total?: number | string | null;
    paid_amount?: number | string | null;
    order_status?: string | null;
    payment_status?: string | null;
    source?: string | null;
}

const num = (v: unknown): number => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
};

/**
 * Чи оплачене замовлення повністю.
 *
 * TS-двійник SQL-функції is_paid_in_full. Обидві копії мусять давати одну
 * відповідь; тест tests/order-attention.test.ts звіряє їх на реальних класах
 * замовлень із бази.
 */
export function isPaidInFull(order: AttentionInput): boolean {
    const total = num(order?.total);
    return total > 0 && num(order?.paid_amount) >= total - FULL_TOLERANCE_UAH;
}

/**
 * TS-двійник SQL-функції orders_needing_attention.
 *
 * У продакшні відбір робить база — цей варіант існує, щоб правило можна було
 * перевірити тестом і щоб дві реалізації не розійшлися мовчки.
 */
export function needsAttention(
    order: AttentionInput,
    lastContactAt: string | Date | null | undefined,
    now: Date = new Date(),
    hours: number = ATTENTION_AFTER_HOURS,
): boolean {
    const status = order?.order_status || '';
    // Скасоване вже нікого не чекає, а відправлене й доставлене — це задача
    // обліку, а не менеджера, який має написати, поки не скасували.
    if (status === 'cancelled' || status === 'shipped' || status === 'delivered') return false;
    if ((order?.payment_status || '') === 'cancelled') return false;
    if (isPaidInFull(order)) return false;
    if ((ATTENTION_EXCLUDED_SOURCES as readonly string[]).includes(order?.source || '')) return false;

    if (!lastContactAt) return true;
    const then = lastContactAt instanceof Date ? lastContactAt : new Date(lastContactAt);
    if (Number.isNaN(then.getTime())) return true;
    return now.getTime() - then.getTime() > hours * HOUR_MS;
}
