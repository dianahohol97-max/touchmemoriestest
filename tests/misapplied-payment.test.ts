import { describe, it, expect } from 'vitest';
import { classifyIncomingPayment, formatUah } from '@/lib/payment/misapplied-payment';

/** Пробіл-роздільник тисяч може бути нерозривним — порівнюємо по суті. */
const norm = (s: string) => s.replace(/[\s\u00a0\u202f]+/g, ' ');

/**
 * Гроші, які прийшли «не так», мають лишити слід.
 *
 * До 14.09.2026 вебхук відповідав на розбіжність суми кодом 400: банк списував
 * гроші, ми відмовлялися їх записати, Monobank повторював вебхук і щоразу
 * отримував ту саму відмову. У базі не лишалося нічого, менеджер бачив
 * неоплачене замовлення, клієнт — списання.
 */
describe('classifyIncomingPayment', () => {
    it('сума збіглася — звичайний платіж', () => {
        expect(classifyIncomingPayment({
            invoiceId: 'inv-1', currentInvoiceId: 'inv-1', paidKopecks: 67500, expectedUah: 675,
        })).toEqual({ kind: 'match' });
    });

    it('копійка заокруглення не робить платіж підозрілим', () => {
        expect(classifyIncomingPayment({
            invoiceId: 'inv-1', currentInvoiceId: 'inv-1', paidKopecks: 67501, expectedUah: 675,
        }).kind).toBe('match');
    });

    it('перевиставлений рахунок на ту саму суму — теж звичайний платіж', () => {
        // Номер рахунку інший, бо менеджер перевиставив, але сума та сама.
        expect(classifyIncomingPayment({
            invoiceId: 'inv-2', currentInvoiceId: 'inv-1', paidKopecks: 67500, expectedUah: 675,
        }).kind).toBe('match');
    });

    it('оплата за старим посиланням називає себе саме так', () => {
        const v = classifyIncomingPayment({
            invoiceId: 'inv-old', currentInvoiceId: 'inv-new', paidKopecks: 67500, expectedUah: 1953,
        });
        if (v.kind !== 'misapplied') throw new Error('очікували misapplied');
        expect(v.reason).toBe('stale-invoice');
        expect(v.paidUah).toBe(675);
        expect(v.expectedUah).toBe(1953);
        expect(v.diffUah).toBe(1278);
        expect(v.note).toContain('Оплата за старим посиланням');
        expect(v.note).toContain('675 ₴');
        expect(norm(v.note)).toContain('1 953 ₴');
        expect(v.note).toContain('доплата');
    });

    it('той самий рахунок, але інша сума — це розбіжність, а не старе посилання', () => {
        const v = classifyIncomingPayment({
            invoiceId: 'inv-1', currentInvoiceId: 'inv-1', paidKopecks: 50000, expectedUah: 675,
        });
        if (v.kind !== 'misapplied') throw new Error('очікували misapplied');
        expect(v.reason).toBe('amount-mismatch');
        expect(v.note).toContain('не збігається з сумою замовлення');
    });

    it('переплату називаємо переплатою', () => {
        const v = classifyIncomingPayment({
            invoiceId: 'inv-1', currentInvoiceId: 'inv-1', paidKopecks: 200000, expectedUah: 675,
        });
        if (v.kind !== 'misapplied') throw new Error('очікували misapplied');
        expect(v.diffUah).toBe(-1325);
        expect(v.note).toContain('переплата');
    });

    it('замовлення без відомого рахунку теж дає розбіжність, а не помилку', () => {
        const v = classifyIncomingPayment({
            invoiceId: 'inv-1', currentInvoiceId: null, paidKopecks: 100, expectedUah: 675,
        });
        expect(v.kind).toBe('misapplied');
    });
});

describe('formatUah', () => {
    it('тисячі відділяються, копійки показуються лише коли вони є', () => {
        expect(formatUah(675)).toBe('675 ₴');
        expect(norm(formatUah(1953))).toBe('1 953 ₴');
        expect(norm(formatUah(72796))).toBe('72 796 ₴');
        expect(formatUah(675.5)).toBe('675,50 ₴');
    });
});
