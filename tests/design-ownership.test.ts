import { describe, expect, it } from 'vitest';
import { checkDesignOwnership, designOwnerId } from '@/lib/orders/design-ownership';

/**
 * TM-001342: дві різні тревелбуки в одному замовленні, і макет другої ліг під
 * ключ першої. Обидві книги мали б поїхати в друк, а поїхала б одна двічі.
 *
 * Ціна помилки тут несиметрична в обидва боки, тому тестів більше, ніж
 * здається потрібним. Пропустити чужий макет означає надрукувати не те.
 * Відмовити СВОЄМУ макету означає замовлення без макета там, де все було
 * гаразд, а це та сама тиша, від якої ми лікуємося.
 */
describe('checkDesignOwnership', () => {
    it('свій макет проходить', () => {
        expect(checkDesignOwnership({ cartItemId: 'pb-1' }, 'pb-1')).toBe('ok');
    });

    it('чужий макет не проходить', () => {
        expect(checkDesignOwnership({ cartItemId: 'pb-2' }, 'pb-1')).toBe('foreign');
    });

    it('макет без позначки проходить як раніше', () => {
        expect(checkDesignOwnership({ pages: [] }, 'pb-1')).toBe('unstamped');
        expect(checkDesignOwnership({ cartItemId: '' }, 'pb-1')).toBe('unstamped');
        expect(checkDesignOwnership({ cartItemId: '   ' }, 'pb-1')).toBe('unstamped');
    });

    it('без ключа позиції відмовляти нема на підставі чого', () => {
        expect(checkDesignOwnership({ cartItemId: 'pb-1' }, null)).toBe('unstamped');
        expect(checkDesignOwnership({ cartItemId: 'pb-1' }, '')).toBe('unstamped');
    });

    it('переживає сміття замість макета', () => {
        expect(checkDesignOwnership(null, 'pb-1')).toBe('unstamped');
        expect(checkDesignOwnership('рядок', 'pb-1')).toBe('unstamped');
        expect(checkDesignOwnership({ cartItemId: 7 }, 'pb-1')).toBe('unstamped');
    });

    /** Пробіли по краях ключа не роблять макет чужим. */
    it('не зважає на пробіли навколо ключа', () => {
        expect(checkDesignOwnership({ cartItemId: ' pb-1 ' }, 'pb-1')).toBe('ok');
        expect(checkDesignOwnership({ cartItemId: 'pb-1' }, ' pb-1 ')).toBe('ok');
    });
});

describe('designOwnerId', () => {
    it('віддає позначку або нічого', () => {
        expect(designOwnerId({ cartItemId: 'pb-9' })).toBe('pb-9');
        expect(designOwnerId({})).toBeNull();
        expect(designOwnerId(undefined)).toBeNull();
    });
});
