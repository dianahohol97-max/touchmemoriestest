import { describe, expect, it } from 'vitest';
import { resolvePaymentBadge } from '@/lib/orders/payment-state';

/**
 * Стан оплати, записаний як факти.
 *
 * Правило рахує гроші, і кожна гілка нижче колись була справжнім рядком у базі
 * 13.09.2026 — числа не вигадані, а зняті з живих замовлень. Класифікація всіх
 * 1082 замовлень тим самим правилом на боці SQL дала 727 оплачених, 257
 * часткових, 79 неоплачених і 19 скасованих, і жодне замовлення не потрапило
 * у дві категорії водночас.
 *
 * Тест тримає саме ті випадки, на яких попередня двостанна версія помилялася.
 */
describe('resolvePaymentBadge', () => {
    it('нуль отриманого — це «Не оплачено», хай навіть рахунок уже виставлено', () => {
        // Сайтове замовлення з виставленим рахунком Monobank: prepaid_amount
        // дорівнює повній сумі ще до того, як клієнт відкрив сторінку оплати.
        // Саме на цьому попереднє правило показувало б оплату.
        const badge = resolvePaymentBadge({ total: 2838, paid_amount: 0, payment_status: 'pending' });
        expect(badge.state).toBe('unpaid');
        expect(badge.label).toBe('Не оплачено');
        expect(badge.outstanding).toBe(2838);
    });

    it('передоплата 50/50 — це «Передоплата», а не «Оплачено»', () => {
        // payment_status на таких рядках справді 'paid', і означає воно лише
        // те, що зайшла передоплата: 706 ₴ ще в кур'єра.
        const badge = resolvePaymentBadge({ total: 1449, paid_amount: 743, payment_status: 'paid' });
        expect(badge.state).toBe('partial');
        // Роздільник тисяч у uk-UA — нерозривний пробіл, не звичайний.
        expect(badge.label).toBe('Передоплата — 743 з 1\u00A0449 ₴');
        expect(badge.outstanding).toBe(706);
    });

    it('часткова оплата дзеркаленого замовлення з CRM видно попри статус pending', () => {
        const badge = resolvePaymentBadge({ total: 3200, paid_amount: 1000, payment_status: 'pending' });
        expect(badge.state).toBe('partial');
        expect(badge.outstanding).toBe(2200);
    });

    it('повна оплата — це «Оплачено»', () => {
        const badge = resolvePaymentBadge({ total: 1449, paid_amount: 1449, payment_status: 'paid' });
        expect(badge.state).toBe('paid');
        expect(badge.label).toBe('Оплачено');
        expect(badge.outstanding).toBe(0);
    });

    it('копійчана нестача все одно рахується повною оплатою', () => {
        // Гривневий допуск. Замовлення, якому бракує сімдесяти копійок, не є
        // частково оплаченим у жодному корисному сенсі.
        expect(resolvePaymentBadge({ total: 1000, paid_amount: 999.3 }).state).toBe('paid');
        // А ось десятка нестачі — це вже справжня часткова оплата.
        expect(resolvePaymentBadge({ total: 1000, paid_amount: 990 }).state).toBe('partial');
    });

    it('переплата лишається «Оплачено», а не стає мінусовим залишком', () => {
        // У базі є 33 дзеркалених замовлення, де отримана сума більша за
        // вартість замовлення.
        const badge = resolvePaymentBadge({ total: 1000, paid_amount: 1200 });
        expect(badge.state).toBe('paid');
        expect(badge.outstanding).toBe(0);
    });

    it('замовлення без ціни і без грошей не стає зеленим', () => {
        // 13 рядків мають total = 0, і на них будь-яке «сплачено ≥ вартості»
        // вірне тривіально. Нуль отриманого перевіряється раніше саме тому.
        expect(resolvePaymentBadge({ total: 0, paid_amount: 0 }).state).toBe('unpaid');
    });

    it('скасування головніше за гроші й не обнуляє отриману суму', () => {
        const badge = resolvePaymentBadge({ total: 1449, paid_amount: 743, order_status: 'cancelled' });
        expect(badge.state).toBe('cancelled');
        expect(badge.label).toBe('Скасовано');
        expect(badge.paid).toBe(743);
    });

    it('скасування через payment_status теж рахується', () => {
        // Так робить крон несплачених замовлень.
        expect(resolvePaymentBadge({ total: 500, paid_amount: 0, payment_status: 'cancelled' }).state)
            .toBe('cancelled');
    });

    it('порожні й сміттєві значення не ламають правило', () => {
        expect(resolvePaymentBadge({}).state).toBe('unpaid');
        expect(resolvePaymentBadge({ total: null, paid_amount: undefined }).state).toBe('unpaid');
        // Supabase віддає numeric рядком.
        expect(resolvePaymentBadge({ total: '1449', paid_amount: '743' }).state).toBe('partial');
    });
});
