import { describe, expect, it } from 'vitest';
import { variantKey, sizeKey, mapKey } from '@/lib/automation/keycrm-catalogue';

/**
 * Ключ варіанта в keycrm_product_map.
 *
 * Дефект, заради якого цей файл існує: у saveMappings стояв sizeKey на вже
 * готовому складеному ключі. З «20x20-6» він віддавав «20x20», тож усі
 * двадцять три кількості розворотів однієї сторони ставали одним ключем, і
 * Postgres відмовляв цілому запиту (21000). Наслідок — звʼязування каталогу
 * мертве з 11.08.2026, 460 рядків фотокниг незвʼязані, а самі фотокниги
 * їхали в CRM без offer_id: 173 замовлення за 60 днів на 517 698 ₴.
 */
describe('variantKey', () => {
    it('зберігає кількість розворотів у складеному ключі', () => {
        expect(variantKey('20x20-6')).toBe('20x20-6');
        expect(variantKey('20x20-8')).toBe('20x20-8');
        expect(variantKey('30x20-50')).toBe('30x20-50');
    });

    it('розводить те, що раніше злипалося в один ключ', () => {
        const keys = ['20x20-6', '20x20-8', '20x20-10'].map(v => mapKey('photobook-printed', variantKey(v)));
        expect(new Set(keys).size).toBe(3);

        // Як це виглядало до виправлення — усі три в один.
        const collapsed = ['20x20-6', '20x20-8', '20x20-10'].map(v => mapKey('photobook-printed', sizeKey(v)));
        expect(new Set(collapsed).size).toBe(1);
    });

    it('голий розмір лишається голим — це ключ товарів без сторінок', () => {
        expect(variantKey('20x20')).toBe('20x20');
        expect(variantKey('6x9')).toBe('6x9');
    });

    it('нормалізує сирий підпис так само, як і раніше', () => {
        expect(variantKey('30×20 см (горизонтальна)')).toBe('30x20');
        expect(variantKey('20х30')).toBe('20x30');
    });

    /**
     * Найважливіша межа: суфікс відрізається ЛИШЕ коли голова — розмір.
     * Інакше колірний варіант утратив би свою частину так само тихо.
     */
    it('не чіпає варіанти, які не є розміром', () => {
        expect(variantKey('в-01')).toBe('в-01');
        expect(variantKey('bilyi-2')).toBe('bilyi-2');
        expect(variantKey('Міні')).toBe('міні');
    });

    it('порожнє лишається порожнім', () => {
        expect(variantKey('')).toBe('');
        expect(variantKey(null as any)).toBe('');
    });
});
