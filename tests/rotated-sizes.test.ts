import { describe, expect, it } from 'vitest';
import {
    auditRotatedSizes,
    describeRotatedSizes,
    normalizeSize,
    type PhotobookPriceRow,
} from '@/lib/pricing/rotated-sizes';

/**
 * 20×30 і 30×20 — одна книга боком, і коштувати вона мусить однаково.
 *
 * Розійшлися вони тихо. Обидві шкали друкованої обкладинки починалися з 890 ₴
 * на десяти сторінках і закінчувалися 2390 ₴ на пʼятдесяти, але 20×30 ішов
 * кроком 75 ₴ на кожні дві сторінки, а 30×20 — кроком 70 ₴. Опорні точки
 * збігалися, тож на око все виглядало правильно, а всередині недобір ріс від
 * 5 ₴ до 95 ₴. На 24 сторінках сайт просив 1380 ₴ замість 1415 ₴.
 *
 * Ціни фотокниг лежать у Supabase, а тести бази не бачать — тому тут
 * перевіряється сама функція, а вже вона стоїть у /api/admin/pricing/audit.
 */
const row = (size: string, cover: string, pages: number, price: number): PhotobookPriceRow =>
    ({ size, cover, page_count: pages, base_price: price });

describe('auditRotatedSizes', () => {
    it('однакові ціни — жодної розбіжності', () => {
        const rows = [
            row('20×30', 'Друкована', 24, 1415),
            row('30×20', 'Друкована', 24, 1415),
            row('20×30', 'Велюр', 24, 2230),
            row('30×20', 'Велюр', 24, 2230),
        ];
        expect(auditRotatedSizes(rows)).toEqual([]);
    });

    it('ловить саме той випадок, з якого все почалося', () => {
        const found = auditRotatedSizes([
            row('20×30', 'Друкована', 24, 1415),
            row('30×20', 'Друкована', 24, 1380),
        ]);
        expect(found).toHaveLength(1);
        expect(found[0]).toMatchObject({ cover: 'Друкована', pages: 24, priceA: 1415, priceB: 1380, diff: 35 });
        expect(describeRotatedSizes(found)[0]).toContain('1380');
    });

    it('найбільша розбіжність іде першою', () => {
        const found = auditRotatedSizes([
            row('20×30', 'Друкована', 24, 1415), row('30×20', 'Друкована', 24, 1380),
            row('20×30', 'Друкована', 48, 2315), row('30×20', 'Друкована', 48, 2220),
            row('20×30', 'Друкована', 12, 965),  row('30×20', 'Друкована', 12, 960),
        ]);
        expect(found.map(f => f.pages)).toEqual([48, 24, 12]);
        expect(found.map(f => f.diff)).toEqual([95, 35, 5]);
    });

    it('дорожчий бік теж є розбіжністю, зі знаком мінус', () => {
        const found = auditRotatedSizes([
            row('20×30', 'Друкована', 24, 1380),
            row('30×20', 'Друкована', 24, 1415),
        ]);
        expect(found[0].diff).toBe(-35);
    });

    it('кирилична × і латинська x — той самий розмір', () => {
        expect(normalizeSize('20×30')).toBe('20x30');
        expect(normalizeSize('20x30 см')).toBe('20x30');
        const found = auditRotatedSizes([
            row('20x30 см', 'Друкована', 24, 1415),
            row('30×20', 'Друкована', 24, 1380),
        ]);
        expect(found).toHaveLength(1);
    });

    it('тариф, якого немає з одного боку, мовчить — це інша хвороба', () => {
        expect(auditRotatedSizes([row('20×30', 'Друкована', 6, 890)])).toEqual([]);
        expect(auditRotatedSizes([row('30×20', 'Друкована', 6, 890)])).toEqual([]);
    });

    it('обкладинки не плутаються між собою', () => {
        const found = auditRotatedSizes([
            row('20×30', 'Друкована', 24, 1415),
            row('30×20', 'Друкована', 24, 1415),
            row('20×30', 'Велюр', 24, 2230),
            row('30×20', 'Велюр', 24, 2100),
        ]);
        expect(found).toHaveLength(1);
        expect(found[0].cover).toBe('Велюр');
    });

    it('порожні й зіпсовані рядки не валять перевірку', () => {
        expect(auditRotatedSizes([])).toEqual([]);
        expect(auditRotatedSizes([
            row('20×30', 'Друкована', 24, NaN as unknown as number),
            row('30×20', 'Друкована', 24, 1380),
        ])).toEqual([]);
    });

    it('ціни рядками з бази читаються як числа', () => {
        const found = auditRotatedSizes([
            { size: '20×30', cover: 'Друкована', page_count: '24', base_price: '1415.00' },
            { size: '30×20', cover: 'Друкована', page_count: '24', base_price: '1380.00' },
        ]);
        expect(found).toHaveLength(1);
        expect(found[0].diff).toBe(35);
    });
});
