import { describe, expect, it } from 'vitest';
import { pageSizeMm, sortPagesForPdf } from '@/lib/export/layout-pdf';

/**
 * Збірка макета в один PDF.
 *
 * Помилка тут не косметична: друкарня бере файл і друкує його як є. Сторінка
 * не на своєму місці означає брошуру не в тому порядку, а неправильний розмір
 * сторінки — білі поля навколо макета або обрізаний край.
 */
describe('pageSizeMm', () => {
    it('turns 300 DPI pixels into the millimetres that were ordered', () => {
        // A4 при 300 DPI — 2480×3508 px.
        const p = pageSizeMm(2480, 3508);
        expect(p.w).toBeCloseTo(210, 0);
        expect(p.h).toBeCloseTo(297, 0);
        expect(p.orientation).toBe('portrait');
    });

    it('calls a spread landscape, because jsPDF swaps the sides otherwise', () => {
        // Розворот A4 — удвічі ширший.
        const p = pageSizeMm(4961, 3508);
        expect(p.w).toBeGreaterThan(p.h);
        expect(p.orientation).toBe('landscape');
    });

    it('treats a square page as portrait rather than leaving it undecided', () => {
        expect(pageSizeMm(2953, 2953).orientation).toBe('portrait');
    });

    it('does not produce a zero-sized page from broken dimensions', () => {
        const p = pageSizeMm(0, -5);
        expect(p.w).toBeGreaterThan(0);
        expect(p.h).toBeGreaterThan(0);
    });
});

describe('sortPagesForPdf', () => {
    it('puts the cover first, then the pages in order', () => {
        const out = sortPagesForPdf([
            { name: '02_spread.jpg', page_number: 3 },
            { name: '00_cover.jpg', page_number: 1, isCover: true },
            { name: '01_spread.jpg', page_number: 2 },
        ]);
        expect(out.map(f => f.name)).toEqual(['00_cover.jpg', '01_spread.jpg', '02_spread.jpg']);
    });

    /** Саме тут ламається звичайне сортування рядків. */
    it('sorts unnumbered pages naturally, so 10 comes after 9', () => {
        const out = sortPagesForPdf([
            { name: '10.jpg' }, { name: '9.jpg' }, { name: '1.jpg' }, { name: '2.jpg' },
        ]);
        expect(out.map(f => f.name)).toEqual(['1.jpg', '2.jpg', '9.jpg', '10.jpg']);
    });

    it('keeps numbered pages ahead of ones with no number at all', () => {
        const out = sortPagesForPdf([
            { name: 'zzz.jpg' },
            { name: '05.jpg', page_number: 5 },
        ]);
        expect(out.map(f => f.name)).toEqual(['05.jpg', 'zzz.jpg']);
    });

    it('leaves the caller array untouched', () => {
        const input = [{ name: 'b.jpg' }, { name: 'a.jpg' }];
        sortPagesForPdf(input);
        expect(input.map(f => f.name)).toEqual(['b.jpg', 'a.jpg']);
    });

    it('survives an empty list', () => {
        expect(sortPagesForPdf([])).toEqual([]);
    });
});
