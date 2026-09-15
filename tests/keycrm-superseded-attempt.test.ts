import { describe, expect, it } from 'vitest';
import { isSupersededAttempt } from '@/lib/automation/keycrm-push';

/**
 * Покинута спроба оплати не має їхати в CRM окремою карткою.
 *
 * Живий випадок, на якому цей файл написано: Анастасія Скрипка оформила
 * замовлення двічі за одинадцять хвилин на ту саму суму 1533 ₴. Друге,
 * TM-001291, поїхало в CRM карткою 14375 і пішло в друк. Перше, TM-001290,
 * лишилося покинутим — і 14.09.2026 о 19:30 таки створило картку 14515, яку
 * менеджерка вранці скасувала руками.
 *
 * Чому це сталося: умова «ще немає картки» переїхала в сам запит, і з вибірки
 * зникли саме ті замовлення, серед яких шукається близнюк. Відтоді пул
 * близнюків читається окремо, без цієї умови.
 */
const abandoned = {
    id: 'a', order_number: 'TM-001290', customer_phone: '380631675188',
    total: 1533, payment_status: 'pending',
    created_at: '2026-09-07T23:42:57.455Z', custom_attributes: {},
};

const realSale = {
    id: 'b', order_number: 'TM-001291', customer_phone: '380631675188',
    total: 1533, payment_status: 'pending',
    created_at: '2026-09-07T23:53:31.498Z',
    custom_attributes: { keycrm: { order_id: 14375 } },
};

describe('isSupersededAttempt', () => {
    it('упізнає покинуту спробу, коли близнюк уже має картку', () => {
        expect(isSupersededAttempt(abandoned, [abandoned, realSale])).toBe(true);
    });

    /**
     * Саме та регресія: якщо пул складається лише з кандидатів на перенесення,
     * близнюка з карткою в ньому немає, і дубль їде в CRM.
     */
    it('без близнюка в пулі покинута спроба виглядає як звичайне замовлення', () => {
        expect(isSupersededAttempt(abandoned, [abandoned])).toBe(false);
    });

    it('замовлення без телефону близнюків не шукає', () => {
        const noPhone = { ...abandoned, customer_phone: '' };
        expect(isSupersededAttempt(noPhone, [noPhone, realSale])).toBe(false);
    });

    it('різна сума — не близнюк', () => {
        const other = { ...realSale, total: 675 };
        expect(isSupersededAttempt(abandoned, [abandoned, other])).toBe(false);
    });

    it('поза вікном у двадцять хвилин — не близнюк', () => {
        const late = { ...realSale, created_at: '2026-09-08T01:00:00.000Z' };
        expect(isSupersededAttempt(abandoned, [abandoned, late])).toBe(false);
    });

    it('дві оплачені спроби без карток не чіпаються — дубль дешевше скасувати, ніж загубити продаж', () => {
        const paidA = { ...abandoned, payment_status: 'paid' };
        const paidB = { ...realSale, payment_status: 'paid', custom_attributes: {} };
        expect(isSupersededAttempt(paidA, [paidA, paidB])).toBe(false);
    });
});
