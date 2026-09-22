import { describe, it, expect } from 'vitest';
import {
    cartKeyOf,
    layoutsReplacedBy,
    newerThanDraft,
    type LayoutRow,
} from '@/lib/orders/layout-replacement';

/**
 * Кнопка «Поставити на замовлення» обіцяє ЗАМІНУ, а поки відбирала замінюване
 * за product_type — мовчки ДОДАВАЛА. Числа з TM-001352 нижче справжні: на
 * замовленні стояв макет із product_type «journal», у чернетці дизайнера лежав
 * «magazine», хоча це той самий глянцевий журнал під тим самим ключем позиції
 * pb-1790003355038-qgf40v. Збігу за типом не було, нічого не відчепилося, і
 * замовлення отримало другий виріб із нулем файлів.
 */

const KEY = 'pb-1790003355038-qgf40v';

const attached: LayoutRow = {
    id: '2655ac83',
    product_type: 'journal',
    cart_payload: { id: KEY },
    created_at: '2026-09-22T15:39:06Z',
};

const draft: LayoutRow = {
    id: 'e3d7c492',
    product_type: 'magazine',
    cart_payload: { id: KEY },
    created_at: '2026-09-22T11:36:28Z',
};

describe('ключ позиції кошика', () => {
    it('читається з cart_payload', () => {
        expect(cartKeyOf(draft)).toBe(KEY);
    });

    it('тонка позначка без id і порожнеча дають null', () => {
        expect(cartKeyOf({ cart_payload: {} })).toBe(null);
        expect(cartKeyOf({ cart_payload: { id: '   ' } })).toBe(null);
        expect(cartKeyOf({ cart_payload: null })).toBe(null);
        expect(cartKeyOf(undefined)).toBe(null);
    });
});

describe('що саме заміщає чернетка', () => {
    it('TM-001352: різні product_type, але один ключ — заміщає', () => {
        expect(layoutsReplacedBy(draft, [attached]).map(p => p.id)).toEqual(['2655ac83']);
    });

    it('чужа книга того самого замовлення лишається на місці', () => {
        // TM-001234: пʼять тревелбуків в одному замовленні. Заміна однієї не
        // має права відчіпляти решту — саме так двічі губився готовий макет.
        const other: LayoutRow = {
            id: 'інша-книга', product_type: 'magazine',
            cart_payload: { id: 'pb-інший' }, created_at: '2026-09-22T10:00:00Z',
        };
        expect(layoutsReplacedBy(draft, [attached, other]).map(p => p.id)).toEqual(['2655ac83']);
    });

    it('чернетка без ключа падає на старе порівняння за типом', () => {
        const noKey: LayoutRow = { id: 'стара', product_type: 'journal', created_at: '2026-01-01T00:00:00Z' };
        expect(layoutsReplacedBy(noKey, [attached]).map(p => p.id)).toEqual(['2655ac83']);
    });

    it('ключ є, але ні в кого не збігається — теж падаємо на тип', () => {
        const otherKey: LayoutRow = { ...draft, product_type: 'journal', cart_payload: { id: 'pb-чужий' } };
        expect(layoutsReplacedBy(otherKey, [attached]).map(p => p.id)).toEqual(['2655ac83']);
    });

    it('сама себе чернетка не заміщає', () => {
        expect(layoutsReplacedBy(draft, [draft])).toEqual([]);
    });

    it('без ключа і без типу не заміщає нічого — краще нічого, ніж навмання', () => {
        expect(layoutsReplacedBy({ id: 'х' }, [attached])).toEqual([]);
    });

    it('порожнє замовлення — порожня заміна', () => {
        expect(layoutsReplacedBy(draft, [])).toEqual([]);
    });
});

describe('чи ставимо старіше замість новішого', () => {
    it('TM-001352: на замовленні макет від 15:39, у чернетці від 11:36 — попередити', () => {
        const replaced = layoutsReplacedBy(draft, [attached]);
        expect(newerThanDraft(draft, replaced).map(p => p.id)).toEqual(['2655ac83']);
    });

    it('свіжіша чернетка попередження не дає', () => {
        const fresh: LayoutRow = { ...draft, created_at: '2026-09-22T19:00:00Z' };
        expect(newerThanDraft(fresh, [attached])).toEqual([]);
    });

    it('однаковий час — не «новіше», тож мовчимо', () => {
        const same: LayoutRow = { ...draft, created_at: attached.created_at };
        expect(newerThanDraft(same, [attached])).toEqual([]);
    });

    it('без дати не вигадуємо: мовчимо, а не лякаємо', () => {
        expect(newerThanDraft({ id: 'х' }, [attached])).toEqual([]);
        expect(newerThanDraft(draft, [{ id: 'без-дати' }])).toEqual([]);
        expect(newerThanDraft(draft, [{ id: 'сміття', created_at: 'не-дата' }])).toEqual([]);
    });
});
