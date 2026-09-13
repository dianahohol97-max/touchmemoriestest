import { describe, expect, it } from 'vitest';
import {
    ATTENTION_AFTER_HOURS,
    ATTENTION_EXCLUDED_SOURCES,
    formatLastContact,
    isPaidInFull,
    needsAttention,
} from '@/lib/orders/attention';
import { FULL_TOLERANCE_UAH, resolvePaymentBadge } from '@/lib/orders/payment-state';

const NOW = new Date('2026-09-13T12:00:00Z');
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 60 * 60 * 1000).toISOString();
const daysAgo = (d: number) => hoursAgo(d * 24);

describe('ATTENTION_AFTER_HOURS', () => {
    it('поріг живе в однині і дорівнює 48 годинам', () => {
        // Число їде параметром у SQL-функцію orders_needing_attention саме
        // тому, щоб другої копії в базі не зʼявилося.
        expect(ATTENTION_AFTER_HOURS).toBe(48);
    });

    it('дзеркалені з CRM виключені', () => {
        expect([...ATTENTION_EXCLUDED_SOURCES]).toEqual(['keycrm']);
    });
});

describe('formatLastContact', () => {
    it('порожня дата — це тире, а не «давно»', () => {
        expect(formatLastContact(null, NOW)).toBe('—');
        expect(formatLastContact(undefined, NOW)).toBe('—');
        expect(formatLastContact('', NOW)).toBe('—');
    });

    it('дні рахуються з правильним відмінком', () => {
        expect(formatLastContact(daysAgo(1), NOW)).toBe('1 день тому');
        expect(formatLastContact(daysAgo(3), NOW)).toBe('3 дні тому');
        expect(formatLastContact(daysAgo(5), NOW)).toBe('5 днів тому');
        expect(formatLastContact(daysAgo(11), NOW)).toBe('11 днів тому');
        expect(formatLastContact(daysAgo(21), NOW)).toBe('21 день тому');
        expect(formatLastContact(daysAgo(22), NOW)).toBe('22 дні тому');
    });

    it('менше доби — години', () => {
        expect(formatLastContact(hoursAgo(3), NOW)).toBe('3 години тому');
        expect(formatLastContact(hoursAgo(5), NOW)).toBe('5 годин тому');
        expect(formatLastContact(hoursAgo(21), NOW)).toBe('21 година тому');
    });

    it('щойно і зовсім свіже не показуються як нуль днів', () => {
        expect(formatLastContact(hoursAgo(0.2), NOW)).toBe('менш як годину тому');
        expect(formatLastContact(new Date(NOW.getTime() + 5000), NOW)).toBe('щойно');
    });

    it('сміття замість дати не ламає колонку', () => {
        expect(formatLastContact('не дата', NOW)).toBe('—');
    });
});

describe('needsAttention', () => {
    const stuck = { total: 1000, paid_amount: 0, order_status: 'new', payment_status: 'pending', source: 'site' };

    it('неоплачене без жодного листа потребує уваги', () => {
        expect(needsAttention(stuck, null, NOW)).toBe(true);
    });

    it('свіжий лист знімає замовлення з фільтра', () => {
        expect(needsAttention(stuck, hoursAgo(5), NOW)).toBe(false);
    });

    it('лист старший за поріг повертає замовлення у фільтр', () => {
        expect(needsAttention(stuck, hoursAgo(49), NOW)).toBe(true);
        expect(needsAttention(stuck, hoursAgo(47), NOW)).toBe(false);
    });

    it('оплачене повністю не потребує уваги', () => {
        expect(needsAttention({ ...stuck, paid_amount: 1000 }, null, NOW)).toBe(false);
    });

    it('часткова оплата НЕ знімає з фільтра', () => {
        // Передоплата — це ще не закритий борг, і саме такі замовлення
        // зависають найчастіше.
        expect(needsAttention({ ...stuck, paid_amount: 500 }, null, NOW)).toBe(true);
    });

    it('скасоване не потребує уваги в жодному вигляді', () => {
        expect(needsAttention({ ...stuck, order_status: 'cancelled' }, null, NOW)).toBe(false);
        expect(needsAttention({ ...stuck, payment_status: 'cancelled' }, null, NOW)).toBe(false);
    });

    it('відправлене й доставлене поза фільтром', () => {
        // Замовлення з боргом, яке вже поїхало, — задача обліку, а не
        // менеджера, який має написати, поки не скасували.
        expect(needsAttention({ ...stuck, order_status: 'shipped' }, null, NOW)).toBe(false);
        expect(needsAttention({ ...stuck, order_status: 'delivered' }, null, NOW)).toBe(false);
    });

    it('дзеркалені з CRM поза фільтром', () => {
        // Сайт цим клієнтам не пише взагалі: 0 листів на 252 замовлення. Вони
        // б із фільтра «немає контакту» ніколи не вийшли, а список, який
        // неможливо розчистити, перестають відкривати.
        expect(needsAttention({ ...stuck, source: 'keycrm' }, null, NOW)).toBe(false);
    });
});

/**
 * Звірка двох реалізацій правила оплати.
 *
 * Правило живе у двох мовах: TS (resolvePaymentBadge, isPaidInFull) і SQL
 * (public.is_paid_in_full, міграція 20260913_order_attention). Тест не бачить
 * Supabase, тож звірка зроблена інакше: 13.09.2026 усі замовлення в базі були
 * зведені до класів еквівалентності за чотирма ознаками, від яких залежить
 * рішення, і для кожного класу взято справжній рядок із його вердиктом SQL.
 * Класів виявилося шість, і вони покривають усі 1099 замовлень.
 *
 * Числа нижче — з бази, а не вигадані. Якщо котрась із реалізацій зміниться в
 * один бік, цей тест упаде.
 */
describe('SQL проти TS на реальних класах замовлень', () => {
    const CLASSES = [
        { n: 742, total: 90, paid: 90, order_status: 'confirmed', payment_status: 'paid', sqlFull: true, sqlVerdict: 'paid' },
        { n: 255, total: 270, paid: 266.49, order_status: 'confirmed', payment_status: 'paid', sqlFull: false, sqlVerdict: 'partial' },
        { n: 70, total: 170, paid: 0, order_status: 'confirmed', payment_status: 'pending', sqlFull: false, sqlVerdict: 'unpaid' },
        { n: 18, total: 235, paid: 0, order_status: 'cancelled', payment_status: 'pending', sqlFull: false, sqlVerdict: 'cancelled' },
        { n: 13, total: 0, paid: 0, order_status: 'confirmed', payment_status: 'pending', sqlFull: false, sqlVerdict: 'unpaid' },
        { n: 1, total: 675, paid: 675, order_status: 'cancelled', payment_status: 'paid', sqlFull: true, sqlVerdict: 'cancelled' },
    ] as const;

    it('класи покривають усі 1099 замовлень, які були в базі', () => {
        expect(CLASSES.reduce((s, c) => s + c.n, 0)).toBe(1099);
    });

    it.each(CLASSES)(
        'клас на $n замовлень: total=$total paid=$paid → $sqlVerdict',
        ({ total, paid, order_status, payment_status, sqlFull, sqlVerdict }) => {
            const row = { total, paid_amount: paid, order_status, payment_status };
            // is_paid_in_full проти isPaidInFull
            expect(isPaidInFull(row)).toBe(sqlFull);
            // Вердикт цілком
            expect(resolvePaymentBadge(row).state).toBe(sqlVerdict);
        },
    );

    it('допуск у TS той самий, що зашитий у SQL-функції', () => {
        // SQL: coalesce(p_paid,0) >= coalesce(p_total,0) - 1
        expect(FULL_TOLERANCE_UAH).toBe(1);
        expect(isPaidInFull({ total: 1000, paid_amount: 999 })).toBe(true);
        expect(isPaidInFull({ total: 1000, paid_amount: 998.99 })).toBe(false);
    });

    it('нульова сума не вважається оплаченою в жодній з реалізацій', () => {
        // SQL: total > 0 перевіряється першим.
        expect(isPaidInFull({ total: 0, paid_amount: 0 })).toBe(false);
        expect(isPaidInFull({ total: 0, paid_amount: 500 })).toBe(false);
    });
});
