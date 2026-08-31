import { describe, expect, it } from 'vitest';
import { maxPageCountFor, findPriceRow, type PriceTable } from '@/lib/editor/pricing';

/**
 * Стеля сторінок фотокниги.
 *
 * TM-001254: клієнтка зібрала фотокнигу 20×30 з друкованою обкладинкою на 54
 * сторінки й заплатила 2690 ₴. Прайс для цієї пари закінчується на 50
 * сторінках: 2390 ₴ + 300 ₴ за кальку — рівно ті самі 2690 ₴. Два зайві
 * розвороти вийшли безкоштовними, а у виробництво пішла книга, якої в прайсі
 * не існує.
 *
 * Причин було дві, і обидві потрібні одна одній:
 *   1. addSpread у редакторі мав межу лише для тревелбуків і журналів, а для
 *      фотокниг стояла Infinity — додавати можна було нескінченно;
 *   2. findPriceRow при промаху бере НАЙБЛИЖЧУ наявну кількість, тож промах
 *      угору тихо оцінюється за останнім рядком прайсу.
 *
 * Пункт 2 лишається навмисно — саме він рятує ціну при непарних і проміжних
 * значеннях. Тому захист стоїть на пункті 1, і ось його межа.
 *
 * Числа тут — з photobook_prices станом на 2026-08-31. «Випускна» справді
 * коротша за решту (30 проти 50), і це не помилка даних: якщо цей тест впаде,
 * значить прайс змінили, і межу в редакторі треба перечитати разом із ним.
 */

const table: PriceTable = {
    fetched_at: '2026-08-31',
    rows: [
        // Друкована 20×30 — та сама пара, що в TM-001254.
        { cover_type: 'Друкована', size: '20×30', page_count: 46, base_price: 2240, kalka_surcharge: 300 },
        { cover_type: 'Друкована', size: '20×30', page_count: 48, base_price: 2315, kalka_surcharge: 300 },
        { cover_type: 'Друкована', size: '20×30', page_count: 50, base_price: 2390, kalka_surcharge: 300 },
        // Випускна — прайс коротший, до 30.
        { cover_type: 'Випускна', size: '20×30', page_count: 28, base_price: 1500, kalka_surcharge: 300 },
        { cover_type: 'Випускна', size: '20×30', page_count: 30, base_price: 1600, kalka_surcharge: 300 },
    ],
};

describe('стеля сторінок фотокниги', () => {
    it('віддає останній рядок прайсу для обкладинки й розміру', () => {
        expect(maxPageCountFor(table, 'Друкована', '20x30')).toBe(50);
    });

    it('знає, що «Випускна» коротша за решту', () => {
        expect(maxPageCountFor(table, 'Випускна', '20x30')).toBe(30);
    });

    // normalizeSizeKey зводить до латинської x лише знак множення × та
    // кириличну х — саме ті два, що реально приходять із картки товару
    // (SizeVisualizer пише кириличну, БД зберігає ×). Зірочка не
    // підтримується, хоч коментар колись і обіцяв інше.
    it('розуміє написання розміру і через ×, і через кириличну х', () => {
        expect(maxPageCountFor(table, 'Друкована', '20×30')).toBe(50);
        expect(maxPageCountFor(table, 'Друкована', '20x30')).toBe(50);
        expect(maxPageCountFor(table, 'Друкована', '20х30')).toBe(50);
        expect(maxPageCountFor(table, 'Друкована', '20×30 см')).toBe(50);
    });

    it('повертає null, коли таблиці ще немає — редактор не має блокуватись', () => {
        expect(maxPageCountFor(null, 'Друкована', '20x30')).toBeNull();
        expect(maxPageCountFor({ fetched_at: '', rows: [] }, 'Друкована', '20x30')).toBeNull();
    });

    it('повертає null для пари, якої немає в прайсі', () => {
        expect(maxPageCountFor(table, 'Друкована', '99x99')).toBeNull();
    });

    it('54 сторінки справді оцінювались би як 50 — причина TM-001254', () => {
        const row = findPriceRow(table, 'Друкована', '20x30', 54);
        expect(row?.page_count).toBe(50);
        expect(row!.base_price + row!.kalka_surcharge).toBe(2690);

        // Тобто дві зайві сторінки коштували б рівно стільки ж, скільки нуль
        // зайвих. Саме тому межу тепер тримає addSpread, а не прайс.
        const atMax = findPriceRow(table, 'Друкована', '20x30', 50);
        expect(atMax!.base_price + atMax!.kalka_surcharge).toBe(2690);
    });
});
