import { describe, expect, it } from 'vitest';
import {
    blockBoxPct,
    containerSafeMarginsPct,
    describeViolation,
    describeViolations,
    findSafeZoneViolations,
    type MeasuredBox,
    type TextBlockLike,
} from '@/lib/editor/safe-zone';

/**
 * Перевірка тексту на лінію обрізу і безпечну зону.
 *
 * Ціна помилки тут несиметрична, але висока в обидва боки: пропущене
 * порушення — це журнал із заголовком на зрізі, який дизайнер потім
 * посуватиме вручну на кожному розвороті, а хибне спрацювання — це
 * попередження на правильному макеті, після кількох таких клієнт перестає
 * читати попередження взагалі. Саме друге сталося на TM-001352, тож більшість
 * тестів нижче стереже мовчання, а не крик.
 *
 * Найтонші місця два. Перше — перерахунок осей: відступи приходять як частки
 * РОЗВОРОТУ, а блок стоїть проти свого контейнера, тож у журналі горизонталь
 * треба подвоїти, а у фотокнизі ні. Друге — те, що коробка блока ЦЕНТРОВАНА на
 * якорі по обох осях, тобто вертикаль міряється від країв коробки, а не від
 * точки якоря.
 */
// 3 мм на A4-розвороті 420×297 — саме те, що віддає buildTrimGuides для журналу.
const A4_SPREAD = { top: 3 / 297, bottom: 3 / 297, left: 3 / 420, right: 3 / 420 };
/** Одна сторінка журналу в мм — контейнер, проти якого стоять його блоки. */
const A4_PAGE_MM = { w: 210, h: 297 };

/** Вимірювач-заглушка: коробка береться з самого блока, як її задав тест. */
const boxes = (map: Record<string, MeasuredBox>) =>
    (block: TextBlockLike) => map[block.id] ?? null;

const pageOpts = (map: Record<string, MeasuredBox>) => ({
    measure: boxes(map),
    containerMm: A4_PAGE_MM,
});

describe('containerSafeMarginsPct', () => {
    it('doubles the horizontal margin for a page container', () => {
        const m = containerSafeMarginsPct({ top: 0.02, bottom: 0.02, left: 0.01, right: 0.01 });
        expect(m.top).toBeCloseTo(2);
        expect(m.bottom).toBeCloseTo(2);
        expect(m.left).toBeCloseTo(2);
        expect(m.right).toBeCloseTo(2);
    });

    it('leaves the horizontal margin alone for a spread container', () => {
        const m = containerSafeMarginsPct({ top: 0.02, bottom: 0.02, left: 0.01, right: 0.01 }, { spreadContainer: true });
        expect(m.left).toBeCloseTo(1);
        expect(m.right).toBeCloseTo(1);
        expect(m.top).toBeCloseTo(2);
    });

    it('keeps the two axes apart when they differ', () => {
        const m = containerSafeMarginsPct(A4_SPREAD);
        expect(m.top).toBeCloseTo(1.010, 2);
        expect(m.left).toBeCloseTo(1.429, 2);
    });
});

describe('blockBoxPct', () => {
    it('centres the box on the anchor on BOTH axes', () => {
        const box = blockBoxPct({ id: 'a', x: 50, y: 50 }, { widthPct: 40, heightPct: 10 });
        expect(box).toEqual({ left: 30, right: 70, top: 45, bottom: 55 });
    });
});

describe('findSafeZoneViolations', () => {
    /**
     * Живий блок із TM-001352: «Ім'я: ІРЕН», кегль 21, без збереженої ширини.
     * Стара перевірка вважала його коробку 90 % сторінки і кричала «ліворуч»;
     * насправді вона 24,5 % і стоїть за 8 % від краю.
     */
    it('says nothing about an auto-width block that only LOOKS off-centre', () => {
        const found = findSafeZoneViolations(
            [{ textBlocks: [{ id: 'iren', text: "Ім'я: ІРЕН", x: 20.44, y: 14.55 }] }],
            A4_SPREAD,
            pageOpts({ iren: { widthPct: 24.5, heightPct: 5.2 } }),
        );
        expect(found).toEqual([]);
    });

    /** Саме цей випадок описаний у звіті TM-001257: верхній рядок на зрізі. */
    it('catches a heading whose box crosses the trim line', () => {
        const found = findSafeZoneViolations(
            [{ textBlocks: [{ id: 'h', text: 'КОЛИ КЛИЧУТЬ ГОРИ', x: 50, y: 1, w: 60 }] }],
            A4_SPREAD,
            pageOpts({ h: { widthPct: 60, heightPct: 6 } }),
        );
        expect(found).toHaveLength(1);
        expect(found[0].level).toBe('trim');
        expect(found[0].sides).toEqual([
            { side: 'top', level: 'trim', overshootMm: expect.closeTo(5.94, 2) },
        ]);
    });

    /**
     * Те, чого стара перевірка не бачила ВЗАГАЛІ: якір стоїть усередині, а
     * половина висоти коробки йде за нього.
     */
    it('catches a caption whose anchor is inside but whose box is not', () => {
        const found = findSafeZoneViolations(
            [{ textBlocks: [{ id: 'c', text: 'Доросле життя ще не зайшло в чат.', x: 50, y: 96 }] }],
            A4_SPREAD,
            pageOpts({ c: { widthPct: 80, heightPct: 12 } }),
        );
        expect(found).toHaveLength(1);
        expect(found[0].level).toBe('trim');
        expect(found[0].sides.map(s => s.side)).toEqual(['bottom']);
    });

    it('separates a graze of the safe zone from an actual cut', () => {
        const found = findSafeZoneViolations([
            // Правий край на 99.2 % — за безпечною лінією 98.57 %, але до ножа ще є.
            { textBlocks: [{ id: 'near', text: 'Майже край', x: 59.2, y: 50, w: 80 }] },
            // Правий край на 101 % — уже за периметром.
            { textBlocks: [{ id: 'past', text: 'За краєм', x: 61, y: 50, w: 80 }] },
        ], A4_SPREAD, pageOpts({
            near: { widthPct: 80, heightPct: 6 },
            past: { widthPct: 80, heightPct: 6 },
        }));
        expect(found.map(v => [v.blockId, v.level])).toEqual([['past', 'trim'], ['near', 'safety']]);
    });

    it('measures the overshoot in millimetres of the real container', () => {
        const found = findSafeZoneViolations(
            [{ textBlocks: [{ id: 'b', text: 'Підпис', x: 55, y: 50, w: 90 }] }],
            A4_SPREAD,
            pageOpts({ b: { widthPct: 90, heightPct: 6 } }),
        );
        // Правий край 100 %, периметр 100 % — за ніж не зайшов, але безпечну
        // лінію 1.43 % перетнув повністю: 1.43 % від 210 мм = 3 мм.
        expect(found[0].level).toBe('safety');
        expect(found[0].sides[0].overshootMm).toBeCloseTo(3, 2);
    });

    it('stays silent below the half-millimetre threshold', () => {
        // Правий край рівно на 98.4 % — 0.17 % за безпечну лінію, тобто 0.36 мм.
        const found = findSafeZoneViolations(
            [{ textBlocks: [{ id: 'b', text: 'Ледь-ледь', x: 53.4, y: 50, w: 90 }] }],
            A4_SPREAD,
            pageOpts({ b: { widthPct: 90, heightPct: 6 } }),
        );
        expect(found).toEqual([]);
    });

    it('does not double the horizontal margin for a spread-mode book', () => {
        const blocks = [{ id: 'b', text: 'Розворотний підпис', x: 51, y: 50, w: 90 }];
        const measured = { b: { widthPct: 90, heightPct: 6 } };
        // Права межа коробки — 96 %. Безпечна лінія розвороту 0.714 %, сторінки 1.43 %.
        const asSpread = findSafeZoneViolations([{ textBlocks: blocks }], A4_SPREAD, {
            measure: boxes(measured), containerMm: { w: 420, h: 297 }, spreadContainer: true,
        });
        expect(asSpread).toEqual([]);
    });

    it('skips the pages it is told to skip', () => {
        const found = findSafeZoneViolations([
            { textBlocks: [{ id: 'cover', text: 'Обкладинка', x: 50, y: 0, w: 60 }] },
            { textBlocks: [{ id: 'page', text: 'Сторінка', x: 50, y: 0, w: 60 }] },
        ], A4_SPREAD, { ...pageOpts({
            cover: { widthPct: 60, heightPct: 8 },
            page: { widthPct: 60, heightPct: 8 },
        }), skipPage: i => i === 0 });
        expect(found.map(v => v.blockId)).toEqual(['page']);
    });

    it('skips a block it cannot measure rather than guessing', () => {
        const found = findSafeZoneViolations(
            [{ textBlocks: [{ id: 'unmeasured', text: 'Невідомо', x: 0, y: 0 }] }],
            A4_SPREAD,
            pageOpts({}),
        );
        expect(found).toEqual([]);
    });

    it('ignores a block with no text at all', () => {
        const found = findSafeZoneViolations(
            [{ textBlocks: [{ id: 'empty', text: '   ', x: 0, y: 0, w: 30 }] }],
            A4_SPREAD,
            pageOpts({ empty: { widthPct: 30, heightPct: 3 } }),
        );
        expect(found).toEqual([]);
    });

    it('reports the array index of the page the block sits on', () => {
        const found = findSafeZoneViolations([
            { textBlocks: [] },
            { textBlocks: [] },
            { textBlocks: [{ id: 'x', text: 'Щастя', x: 50, y: 0, w: 50 }] },
        ], A4_SPREAD, pageOpts({ x: { widthPct: 50, heightPct: 8 } }));
        expect(found).toHaveLength(1);
        expect(found[0].pageIndex).toBe(2);
    });

    it('survives pages with no text at all', () => {
        expect(findSafeZoneViolations([{}, { textBlocks: null }], A4_SPREAD, pageOpts({}))).toEqual([]);
    });
});

describe('describeViolation', () => {
    const cut = {
        pageIndex: 6, blockId: 'a', excerpt: 'КОЛИ КЛИЧУТЬ ГОРИ', level: 'trim' as const,
        sides: [{ side: 'top' as const, level: 'trim' as const, overshootMm: 2.4 }],
        box: { left: 20, right: 80, top: -0.8, bottom: 5 },
    };

    it('names the trim line and the millimetres for a real cut', () => {
        expect(describeViolation(cut)).toBe(
            'Сторінка 7: «КОЛИ КЛИЧУТЬ ГОРИ» виходить за лінію обрізу згори на 2,4 мм — на друці цю частину зріже.',
        );
    });

    it('uses the label the editor shows instead of the array index', () => {
        expect(describeViolation(cut, i => `Сторінка ${i - 1}`)).toContain('Сторінка 5:');
    });

    it('says «безпечна зона», not «лінія обрізу», when nothing is actually cut', () => {
        const near = { ...cut, level: 'safety' as const, sides: [{ side: 'right' as const, level: 'safety' as const, overshootMm: 1.2 }] };
        expect(describeViolation(near)).toBe(
            'Сторінка 7: «КОЛИ КЛИЧУТЬ ГОРИ» заходить у безпечну зону праворуч на 1,2 мм — різак може зачепити.',
        );
    });
});

describe('describeViolations', () => {
    it('returns an empty string when there is nothing to say', () => {
        expect(describeViolations([])).toBe('');
    });

    it('folds a long list into a count instead of a wall of text', () => {
        const many = Array.from({ length: 8 }, (_, i) => ({
            pageIndex: i, blockId: `b${i}`, excerpt: 'текст', level: 'trim' as const,
            sides: [{ side: 'top' as const, level: 'trim' as const, overshootMm: 1 }],
            box: { left: 0, right: 10, top: -1, bottom: 5 },
        }));
        const lines = describeViolations(many).split('\n');
        expect(lines).toHaveLength(6);
        expect(lines[5]).toBe('Ще таких блоків: 3.');
    });
});
