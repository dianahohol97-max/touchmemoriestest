/**
 * Стан оплати замовлення — одне правило на весь адмін.
 *
 * Рахується з orders.paid_amount, тобто з реально отриманих грошей, а не з
 * ручного прапорця. payment_status для цього не годиться: він знає лише
 * 'paid' і 'pending', а на замовленні з передоплатою 'paid' означає «зайшла
 * передоплата», і ніяк не «замовлення оплачене» — типовий рядок на 1449 ₴ із
 * 743 ₴ передоплати і 706 ₴ післяплати носить 'paid', поки кур'єр ще не
 * розрахувався.
 *
 * До появи paid_amount цю різницю в адмінці показати було нічим, і список
 * замовлень мав двостанний значок із єдиним винятком для дзеркалених із CRM.
 *
 * Модуль навмисно чистий: жодних запитів і жодного React, щоб той самий
 * висновок малювався однаково в списку, у картці й у будь-чому, що з'явиться
 * потім.
 */

export type PaymentState = 'cancelled' | 'unpaid' | 'partial' | 'paid';

export interface PaymentBadge {
    state: PaymentState;
    /** Готовий підпис українською. */
    label: string;
    /** Отримано, грн. */
    paid: number;
    /** Вартість замовлення, грн. */
    total: number;
    /** Скільки ще винні. Нуль, коли нічого. */
    outstanding: number;
    /** Колір тла і тексту значка. */
    bg: string;
    fg: string;
}

/** Поля, які правило читає. Ширший об'єкт (рядок замовлення) теж підходить. */
export interface PaymentStateInput {
    total?: number | string | null;
    paid_amount?: number | string | null;
    order_status?: string | null;
    payment_status?: string | null;
}

/**
 * Допуск на «оплачено повністю», у гривнях.
 *
 * Копійчані розбіжності між сумою замовлення і тим, що дійшло від банку, —
 * це норма, і замовлення, якому бракує сімдесяти копійок, не є частково
 * оплаченим у жодному корисному сенсі. Гривня — те саме число, яким уже
 * користується дзеркало KeyCRM, коли вирішує, чи вважати замовлення оплаченим.
 */
const FULL_TOLERANCE_UAH = 1;

const money = (value: unknown): number => {
    const n = Number(value);
    return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
};

const fmt = (value: number): string => Math.round(value).toLocaleString('uk-UA');

export function resolvePaymentBadge(order: PaymentStateInput): PaymentBadge {
    const total = money(order?.total);
    const paid = money(order?.paid_amount);
    const outstanding = money(Math.max(0, total - paid));

    // Скасування головніше за гроші. Замовлення, яке не відбулося, лишається
    // скасованим незалежно від того, скільки за ним колись надійшло, а сама
    // сума при скасуванні не обнуляється — гроші, що прийшли, є фактом, і
    // повернення їх обнулить окремо.
    if (order?.order_status === 'cancelled' || order?.payment_status === 'cancelled') {
        return { state: 'cancelled', label: 'Скасовано', paid, total, outstanding, bg: '#f1f5f9', fg: '#64748b' };
    }

    // Нуль перевіряється ПЕРЕД сумою замовлення навмисно. У базі є рядки з
    // total = 0, і на них будь-яке порівняння «сплачено ≥ вартості» вірне
    // тривіально — замовлення без ціни і без грошей показувалося б зеленим.
    if (paid <= 0) {
        return { state: 'unpaid', label: 'Не оплачено', paid, total, outstanding, bg: '#fef2f2', fg: '#dc2626' };
    }

    if (total <= 0 || paid >= total - FULL_TOLERANCE_UAH) {
        return { state: 'paid', label: 'Оплачено', paid, total, outstanding, bg: '#f0fdf4', fg: '#16a34a' };
    }

    return {
        state: 'partial',
        label: `Передоплата — ${fmt(paid)} з ${fmt(total)} ₴`,
        paid,
        total,
        outstanding,
        bg: '#fffbeb',
        fg: '#b45309',
    };
}
