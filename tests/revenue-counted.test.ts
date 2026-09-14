import { describe, expect, it } from 'vitest';
import {
    countedRevenue,
    countsTowardsRevenue,
    outstandingAmount,
    receivedAmount,
} from '@/lib/orders/payment-state';

/**
 * Виручка у звітності.
 *
 * Числа в коментарях зміряні 14.09.2026 по бойовій базі: за тридцять днів
 * сума замовлень 935 370 ₴ проти 744 136 ₴ отриманих, і розрив розкладається
 * рівно на дві частини — 8 388 ₴ скасованого і 182 847 ₴ ще не сплаченого.
 */

describe('countedRevenue', () => {
    it('віддає те, що надійшло, а не суму замовлення', () => {
        expect(countedRevenue({ total: 2000, paid_amount: 1000 })).toBe(1000);
        expect(countedRevenue({ total: 2000, paid_amount: 2000 })).toBe(2000);
    });

    /** Передоплата 50% — найчастіший випадок у дзеркалених із KeyCRM. */
    it('на передоплаті рахує саме передоплату', () => {
        expect(countedRevenue({ total: 1500, paid_amount: 750, payment_status: 'pending' })).toBe(750);
    });

    it('статус оплати сам по собі нічого не змінює', () => {
        expect(countedRevenue({ total: 1000, paid_amount: 1000, payment_status: 'pending' })).toBe(1000);
        expect(countedRevenue({ total: 1000, paid_amount: 0, payment_status: 'paid' })).toBe(0);
    });

    /** 80 184 ₴ скасованого лежало у «виручці» за липень–вересень. */
    it('скасоване не дохід, за жодним зі статусів', () => {
        expect(countedRevenue({ total: 5000, paid_amount: 5000, order_status: 'cancelled' })).toBe(0);
        expect(countedRevenue({ total: 5000, paid_amount: 5000, payment_status: 'cancelled' })).toBe(0);
    });

    it('порожнє замовлення дає нуль, а не помилку', () => {
        expect(countedRevenue({})).toBe(0);
        expect(countedRevenue({ total: 1000 })).toBe(0);
    });
});

describe('countsTowardsRevenue', () => {
    it('скасовані не рахуються, решта рахується', () => {
        expect(countsTowardsRevenue({ order_status: 'cancelled' })).toBe(false);
        expect(countsTowardsRevenue({ payment_status: 'cancelled' })).toBe(false);
        expect(countsTowardsRevenue({ order_status: 'in_progress' })).toBe(true);
    });
});

describe('«очікують оплати» — це залишок', () => {
    /** Плашка показувала 607 739 ₴ там, де чекають 328 567 ₴. */
    it('на передоплаті чекають другу половину, а не всю суму', () => {
        expect(outstandingAmount({ total: 1500, paid_amount: 750 })).toBe(750);
    });

    it('повністю несплачене чекає повну суму', () => {
        expect(outstandingAmount({ total: 1200, paid_amount: 0 })).toBe(1200);
    });

    it('скасоване не чекає нічого', () => {
        expect(outstandingAmount({ total: 1200, paid_amount: 0, order_status: 'cancelled' })).toBe(0);
    });

    it('переплата не стає боргом магазину', () => {
        expect(outstandingAmount({ total: 1000, paid_amount: 1200 })).toBe(0);
        expect(receivedAmount({ total: 1000, paid_amount: 1200 })).toBe(1200);
    });
});
