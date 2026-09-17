import { describe, expect, it } from 'vitest';
import { hasWhiteEdges, inspectWhiteEdges, measureWhiteEdges, NO_EDGES } from '@/lib/print/white-edge';

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

/**
 * Запобіжник проти вильоту: TM-001254 і розмір 20×30.
 *
 * Аркуш 420×305 мм проти готового розвороту 400×300, тобто виліт 10 мм з боку
 * по горизонталі — 2.38% ширини. Поки в вимірювачі стояло глухих 2%, смужка на
 * всю ширину вильоту не вкладалась у межу, і відповідь була така сама, як для
 * чистого файлу. Ці тести тримають різницю між «чисто» і «завелике», і те, що
 * на 20×30 виліт більше не випадає за межу.
 */
describe('bleed guard follows the real geometry', () => {
    /** 4961 пкс — це 420 мм при 300 dpi, справжня ширина аркуша 20×30. */
    const SHEET_W = 4961;
    const SHEET_H = 3602;
    /** 10 мм вильоту від 420 мм ширини. */
    const BLEED_X = Math.round(SHEET_W * (10 / 420));
    const strip = (n: number) => Array.from({ length: n }, (_, i) => i);

    it('used to go blind on 20×30: a full-bleed strip overflows the old flat 2 %', () => {
        const r = inspectWhiteEdges({
            width: SHEET_W, height: SHEET_H,
            lineIsWhite: white(strip(BLEED_X), []),
        });
        expect(r.verdict).toBe('wider-than-bleed');
        expect(r.edges).toEqual(NO_EDGES);
    });

    it('sees the same strip once the guard comes from the real bleed', () => {
        const r = inspectWhiteEdges({
            width: SHEET_W, height: SHEET_H,
            lineIsWhite: white(strip(BLEED_X), []),
            maxFractionX: (10 / 420) * 1.25,
            maxFractionY: (2.5 / 305) * 1.25,
        });
        expect(r.verdict).toBe('found');
        expect(r.edges.left).toBe(BLEED_X);
    });

    it('still refuses white that runs past the bleed, which is artwork', () => {
        const r = inspectWhiteEdges({
            width: SHEET_W, height: SHEET_H,
            lineIsWhite: white(strip(BLEED_X * 3), []),
            maxFractionX: (10 / 420) * 1.25,
            maxFractionY: (2.5 / 305) * 1.25,
        });
        expect(r.verdict).toBe('wider-than-bleed');
        expect(r.edges).toEqual(NO_EDGES);
    });

    it('keeps the axes apart — vertical bleed on 20×30 is four times tighter', () => {
        // 2.5 мм від 305 це 0.82%, тобто по вертикалі смужка ширини
        // горизонтального вильоту — це вже макет.
        const r = inspectWhiteEdges({
            width: SHEET_W, height: SHEET_H,
            lineIsWhite: white([], strip(BLEED_X)),
            maxFractionX: (10 / 420) * 1.25,
            maxFractionY: (2.5 / 305) * 1.25,
        });
        expect(r.verdict).toBe('wider-than-bleed');
    });

    it('separates "clean" from "too wide" instead of collapsing both to nothing', () => {
        const clean = inspectWhiteEdges({ width: 1000, height: 1000, lineIsWhite: () => false });
        const flooded = inspectWhiteEdges({ width: 1000, height: 1000, lineIsWhite: () => true });
        expect(clean.verdict).toBe('clean');
        expect(flooded.verdict).toBe('wider-than-bleed');
        // Обидва нічого не роблять, але причини різні — саме це й ховалось.
        expect(clean.edges).toEqual(NO_EDGES);
        expect(flooded.edges).toEqual(NO_EDGES);
    });

    it('reports a degenerate size as such rather than as a clean sheet', () => {
        expect(inspectWhiteEdges({ width: 0, height: 10, lineIsWhite: () => true }).verdict).toBe('degenerate');
    });

    it('leaves measureWhiteEdges answering exactly as before', () => {
        expect(measureWhiteEdges({ width: 200, height: 200, lineIsWhite: white([0, 1, 199], [0, 199, 198]) }))
            .toEqual({ left: 2, right: 1, top: 1, bottom: 2 });
        expect(hasWhiteEdges(measureWhiteEdges({ width: 100, height: 100, lineIsWhite: () => false }))).toBe(false);
    });
});
