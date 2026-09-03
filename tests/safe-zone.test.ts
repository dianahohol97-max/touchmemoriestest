import { describe, expect, it } from 'vitest';
import {
    blockHorizontalSpan,
    describeViolations,
    findSafeZoneViolations,
    pageSafeMarginsPct,
} from '@/lib/editor/safe-zone';

/**
 * Перевірка тексту на безпечну зону.
 *
 * Ціна помилки тут несиметрична, але висока в обидва боки: пропущене
 * порушення — це журнал із заголовком на зрізі, який дизайнер потім
 * посуватиме вручну на кожному розвороті, а хибне спрацювання — це
 * попередження на правильному макеті, після кількох таких клієнт перестає
 * читати попередження взагалі.
 *
 * Найтонше місце — перерахунок осей. Відступи приходять як частки РОЗВОРОТУ,
 * а блок живе на СТОРІНЦІ, тож горизонталь треба подвоїти, а вертикаль ні.
 */
// 5 мм на A4-розвороті 420×297: по горизонталі 5/420, по вертикалі 5/297.
const A4_SPREAD = { top: 5 / 297, bottom: 5 / 297, left: 5 / 420, right: 5 / 420 };

describe('pageSafeMarginsPct', () => {
    it('doubles the horizontal margin and leaves the vertical alone', () => {
        const m = pageSafeMarginsPct({ top: 0.02, bottom: 0.02, left: 0.01, right: 0.01 });
        expect(m.top).toBeCloseTo(2);
        expect(m.bottom).toBeCloseTo(2);
        expect(m.left).toBeCloseTo(2);
        expect(m.right).toBeCloseTo(2);
    });

    it('keeps the two axes apart when they differ', () => {
        const m = pageSafeMarginsPct(A4_SPREAD);
        expect(m.top).toBeCloseTo(1.684, 2);
        expect(m.left).toBeCloseTo(2.381, 2);
    });
});

describe('blockHorizontalSpan', () => {
    it('centres the box on the anchor', () => {
        expect(blockHorizontalSpan({ id: 'a', x: 50, y: 50, w: 40 })).toEqual({ left: 30, right: 70 });
    });

    it('treats a block with no width as the widest it may become', () => {
        // Без збереженої ширини блок тягнеться до TEXT_BOX_MAX_PCT = 90.
        expect(blockHorizontalSpan({ id: 'a', x: 50, y: 50 })).toEqual({ left: 5, right: 95 });
    });
});

describe('findSafeZoneViolations', () => {
    const safeBlock = { id: 'ok', text: 'Все гаразд', x: 50, y: 50, w: 60 };

    it('says nothing about a layout that stays inside', () => {
        expect(findSafeZoneViolations([{ textBlocks: [safeBlock] }], A4_SPREAD)).toEqual([]);
    });

    /** Саме цей випадок описаний у звіті: верхній рядок заголовка на зрізі. */
    it('catches a heading pinned to the top edge', () => {
        const found = findSafeZoneViolations(
            [{ textBlocks: [{ id: 'h', text: 'КОЛИ КЛИЧУТЬ ГОРИ', x: 50, y: 1, w: 60 }] }],
            A4_SPREAD,
        );
        expect(found).toHaveLength(1);
        expect(found[0].sides).toEqual(['top']);
        expect(found[0].excerpt).toBe('КОЛИ КЛИЧУТЬ ГОРИ');
    });

    /**
     * Широкий блок по центру горизонталь НЕ порушує: ширина обмежена 90 %,
     * тож він спиняється за 5 % від краю сторінки, а безпечна зона тут 2.38 %.
     * Щоб виїхати вбік, блок треба зсунути з центру — і саме так у макеті
     * зʼявляється підпис, притиснутий до лівого поля.
     */
    it('catches the bottom edge together with a block pushed off to the side', () => {
        const found = findSafeZoneViolations(
            [{ textBlocks: [{ id: 'b', text: 'DENYS, INNA & KOSTYA', x: 3, y: 99.5, w: 8 }] }],
            A4_SPREAD,
        );
        expect(found[0].sides).toEqual(['bottom', 'left']);
    });

    it('leaves a full-width centred block alone', () => {
        expect(findSafeZoneViolations(
            [{ textBlocks: [{ id: 'wide', text: 'На всю ширину', x: 50, y: 50, w: 90 }] }],
            A4_SPREAD,
        )).toEqual([]);
    });

    it('reports the page a block sits on, not the spread', () => {
        const found = findSafeZoneViolations([
            { textBlocks: [safeBlock] },
            { textBlocks: [] },
            { textBlocks: [{ id: 'x', text: 'Щастя', x: 50, y: 0.5, w: 50 }] },
        ], A4_SPREAD);
        expect(found).toHaveLength(1);
        expect(found[0].pageIndex).toBe(2);
    });

    it('survives pages with no text at all', () => {
        expect(findSafeZoneViolations([{}, { textBlocks: null }], A4_SPREAD)).toEqual([]);
    });
});

describe('describeViolations', () => {
    it('returns an empty string when there is nothing to say', () => {
        expect(describeViolations([])).toBe('');
    });

    it('lists pages one per line, numbered from one', () => {
        const text = describeViolations([
            { pageIndex: 2, blockId: 'a', excerpt: 'КОЛИ КЛИЧУТЬ ГОРИ', sides: ['top'] },
        ]);
        expect(text).toBe('Сторінка 3: «КОЛИ КЛИЧУТЬ ГОРИ» виходить за межу верх.');
    });

    it('folds a long list into a count instead of a wall of text', () => {
        const many = Array.from({ length: 8 }, (_, i) => ({
            pageIndex: i, blockId: `b${i}`, excerpt: 'текст', sides: ['top' as const],
        }));
        const lines = describeViolations(many).split('\n');
        expect(lines).toHaveLength(6);
        expect(lines[5]).toBe('Ще таких блоків: 3.');
    });
});
