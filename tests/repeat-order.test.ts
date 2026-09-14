import { describe, it, expect } from 'vitest';
import { buildRepeatCartItem, repeatSourceNumbers, repeatSourceOf, unpaidRepeatWarning } from '@/lib/orders/repeat-order';

/**
 * TM-001314. Клієнтка за день зробила п'ять замовлень Travel Book із
 * дизайнером — із фото і брифом, — а ввечері натиснула в кабінеті «Повторити»
 * на трьох із них. Приїхало оплачене замовлення на три книги, яке каже
 * «самостійний макет» і не має жодного файлу для друку: копіювались лише
 * назва, ціна й опції, а макет, фото і сам факт роботи дизайнера лишились у
 * старих замовленнях.
 */
const DESIGNER_ORDER = {
    id: 'e7f355a4-0000-0000-0000-000000000001',
    order_number: 'TM-001305',
    with_designer: true,
};

const DESIGNER_ITEM = {
    price: 750,
    quantity: 1,
    product_name: 'Travel Book',
    product_slug: 'travelbook-20x30',
    options: { 'Терміновість': 'standard', 'Кількість сторінок': 14, 'Ламінація сторінок': 'none' },
};

describe('buildRepeatCartItem', () => {
    it('переносить те, що клієнт замовляв', () => {
        const line = buildRepeatCartItem(DESIGNER_ITEM, DESIGNER_ORDER, 'cart-1');
        expect(line.id).toBe('cart-1');
        expect(line.slug).toBe('travelbook-20x30');
        expect(line.name).toBe('Travel Book');
        expect(line.price).toBe(750);
        expect(line.qty).toBe(1);
        expect(line.options).toEqual(DESIGNER_ITEM.options);
    });

    it('памʼятає, чого це повтор', () => {
        const line = buildRepeatCartItem(DESIGNER_ITEM, DESIGNER_ORDER, 'cart-1');
        expect(line.metadata.repeat_of_order_number).toBe('TM-001305');
        expect(line.metadata.repeat_of_order_id).toBe(DESIGNER_ORDER.id);
        expect(line.personalization_note).toContain('TM-001305');
    });

    it('повтор дизайнерського замовлення лишається дизайнерським', () => {
        // checkout вмикає with_designer саме за metadata.designer_flow —
        // без цього прапорця замовлення читалось як самостійний макет.
        const line = buildRepeatCartItem(DESIGNER_ITEM, DESIGNER_ORDER, 'cart-1');
        expect(line.metadata.designer_flow).toBe(true);
    });

    it('повтор самостійного замовлення дизайнера не вигадує', () => {
        const line = buildRepeatCartItem(
            { ...DESIGNER_ITEM, unit_price: 675 },
            { id: 'x', order_number: 'TM-001200', with_designer: false },
            'cart-2',
        );
        expect(line.metadata.designer_flow).toBeUndefined();
        expect(line.price).toBe(675);
    });

    it('не затирає те, що позиція вже несла', () => {
        const line = buildRepeatCartItem(
            { ...DESIGNER_ITEM, personalization_note: 'Напис: Олег & Ірина', metadata: { wishbook: { size: '20x20' } } },
            DESIGNER_ORDER,
            'cart-3',
        );
        expect(line.metadata.wishbook).toEqual({ size: '20x20' });
        expect(line.personalization_note).toContain('Напис: Олег & Ірина');
    });
});

describe('repeatSourceOf', () => {
    it('звичайна позиція повтором не є', () => {
        expect(repeatSourceOf(DESIGNER_ITEM)).toBeNull();
        expect(repeatSourceOf({ metadata: { designer_flow: true } })).toBeNull();
        expect(repeatSourceOf(null)).toBeNull();
    });

    it('позиція-повтор називає своє джерело', () => {
        const line = buildRepeatCartItem(DESIGNER_ITEM, DESIGNER_ORDER, 'cart-1');
        expect(repeatSourceOf(line)).toEqual({ id: DESIGNER_ORDER.id, orderNumber: 'TM-001305' });
    });

    it('номери джерел не дублюються', () => {
        const a = buildRepeatCartItem(DESIGNER_ITEM, DESIGNER_ORDER, 'c1');
        const b = buildRepeatCartItem(DESIGNER_ITEM, DESIGNER_ORDER, 'c2');
        const c = buildRepeatCartItem(DESIGNER_ITEM, { id: 'y', order_number: 'TM-001307', with_designer: true }, 'c3');
        expect(repeatSourceNumbers([a, b, c, DESIGNER_ITEM])).toEqual(['TM-001305', 'TM-001307']);
    });
});

describe('unpaidRepeatWarning', () => {
    it('оплачене замовлення повторюється без питань', () => {
        expect(unpaidRepeatWarning({ id: 'a', order_number: 'TM-001200', payment_status: 'paid' })).toBe('');
    });

    it('скасоване теж не питає', () => {
        expect(unpaidRepeatWarning({ id: 'a', order_number: 'TM-001200', payment_status: 'pending', order_status: 'cancelled' })).toBe('');
    });

    it('неоплачене попереджає і називає номер', () => {
        // TM-001304 … TM-001313 висіли неоплаченими з усіма фотографіями, і
        // повтор трьох із них створив окреме замовлення на 1953 ₴ без жодного фото.
        const warn = unpaidRepeatWarning({ id: 'a', order_number: 'TM-001304', payment_status: 'pending', order_status: 'new' });
        expect(warn).toContain('TM-001304');
        expect(warn).toContain('не оплачене');
        expect(warn).toContain('Оплатити');
    });
});
