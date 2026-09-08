import { describe, expect, it } from 'vitest';
import { hasWhiteEdges, measureWhiteEdges, NO_EDGES } from '@/lib/print/white-edge';

/**
 * Пошук білої смужки по краю аркуша.
 *
 * Ціна помилки несиметрична, але висока в обидва боки. Пропустити смужку —
 * це біла риска на готовій сторінці після обрізки. Знайти її там, де її немає
 * — це затертий край справжнього макета, і клієнт отримає книжку, у якій
 * білу сторінку замазали сусіднім пікселем.
 */
const white = (cols: number[], rows: number[]) =>
    (axis: 'col' | 'row', i: number) => (axis === 'col' ? cols : rows).includes(i);

describe('measureWhiteEdges', () => {
    /** Саме форма TM-001254: тонка смужка ліворуч і праворуч, згори й знизу чисто. */
    it('finds a thin strip on the left and right only', () => {
        const e = measureWhiteEdges({
            width: 1280, height: 915,
            lineIsWhite: white([0, 1274, 1275, 1276, 1277, 1278, 1279], []),
        });
        expect(e).toEqual({ left: 1, right: 6, top: 0, bottom: 0 });
        expect(hasWhiteEdges(e)).toBe(true);
    });

    it('says nothing to do on a clean sheet', () => {
        const e = measureWhiteEdges({ width: 100, height: 100, lineIsWhite: () => false });
        expect(e).toEqual(NO_EDGES);
        expect(hasWhiteEdges(e)).toBe(false);
    });

    /**
     * Біла сторінка макета біла наскрізь. «Полагодити» її означало б
     * розтягнути по всій сторінці випадковий піксель, тому не чіпаємо.
     */
    it('refuses a fully white image instead of smearing a pixel over it', () => {
        expect(measureWhiteEdges({ width: 100, height: 100, lineIsWhite: () => true })).toEqual(NO_EDGES);
    });

    it('refuses a strip wider than the guard allows', () => {
        // 2 % від 1000 це 20; смужка на 40 — це вже елемент макета.
        const cols = Array.from({ length: 40 }, (_, i) => i);
        expect(measureWhiteEdges({ width: 1000, height: 1000, lineIsWhite: white(cols, []) })).toEqual(NO_EDGES);
    });

    it('keeps a strip that sits exactly on the guard', () => {
        const cols = Array.from({ length: 20 }, (_, i) => i);
        expect(measureWhiteEdges({ width: 1000, height: 1000, lineIsWhite: white(cols, []) }).left).toBe(20);
    });

    it('measures each side independently', () => {
        const e = measureWhiteEdges({
            width: 200, height: 200,
            lineIsWhite: white([0, 1, 199], [0, 199, 198]),
        });
        expect(e).toEqual({ left: 2, right: 1, top: 1, bottom: 2 });
    });

    it('is unmoved by white lines in the middle of the sheet', () => {
        // Біла смуга посеред розвороту — це задум, а не виліт.
        expect(measureWhiteEdges({ width: 200, height: 200, lineIsWhite: white([100, 101], []) })).toEqual(NO_EDGES);
    });

    it('returns nothing for a degenerate size rather than throwing', () => {
        expect(measureWhiteEdges({ width: 0, height: 10, lineIsWhite: () => true })).toEqual(NO_EDGES);
    });
});
