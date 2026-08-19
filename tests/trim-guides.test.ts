import { describe, expect, it } from 'vitest';
import { buildTrimGuides, buildCoverGuides, coverArtworkInset, cutsAtGutter, SAFETY_MIN_MM } from '@/lib/print/trim-guides';
import { deriveGeometry } from '@/lib/print/geometry';

/**
 * Лінії обрізки в адмінському перегляді макета.
 *
 * Геометрія тут не вигадана: deriveGeometry — той самий модуль, з якого
 * рендер-сервіс бере аркуші для друку, тож коли лінії на екрані і ніж у
 * друкарні розійдуться, ці тести впадуть першими.
 */

describe('чий розворот ріжеться по корінцю', () => {
    // Та сама умова, якою рендер-сервіс вмикає посторінковий друк.
    it.each([
        'travelbook-20x30',
        'personalized-glossy-magazine',
        'fotozhurnal-tverd-obkladynka',
    ])('%s друкується окремими сторінками', (slug) => {
        expect(cutsAtGutter(slug, 'photobook')).toBe(true);
    });

    it.each(['photobook-printed', 'photobook-velour', 'wishbook'])(
        '%s їде в друк цілим розворотом', (slug) => {
            expect(cutsAtGutter(slug, 'photobook')).toBe(false);
        });

    // Старі чернетки редактора зберігали product_type='photobook' для всього,
    // тож правду несе слаг; але коли слага нема — рятує product_type.
    it('коли слаг порожній, вистачає product_type', () => {
        expect(cutsAtGutter('', 'travelbook')).toBe(true);
        expect(cutsAtGutter(null, 'magazine')).toBe(true);
        expect(cutsAtGutter(null, 'photobook')).toBe(false);
    });
});

describe('Travel Book / журнали — сторінка 210×297, аркуш без виступу', () => {
    const g = deriveGeometry('travelbook')!;

    it('геометрія існує і аркуш дорівнює фінішному розвороту', () => {
        expect(g).not.toBeNull();
        expect(g.finished).toEqual({ w: 420, h: 297 });
        expect(g.overhang).toEqual({ x: 0, y: 0 });
    });

    it('безпечна зона підперта мінімумом 3 мм, бо в базі рядка нема', () => {
        const spec = buildTrimGuides(g, { productSlug: 'travelbook-20x30' });
        expect(spec.safetyMm).toEqual({ top: 3, bottom: 3, left: 3, right: 3 });
        expect(spec.cutsAtGutter).toBe(true);
    });

    it('відсотки рахуються від фінішного розвороту', () => {
        const spec = buildTrimGuides(g, { productSlug: 'travelbook-20x30' });
        expect(spec.safetyPct.left).toBeCloseTo((3 / 420) * 100, 5);
        expect(spec.safetyPct.top).toBeCloseTo((3 / 297) * 100, 5);
    });

    it('легенда каже про різ по корінцю', () => {
        const spec = buildTrimGuides(g, { productSlug: 'fotozhurnal-tverd-obkladynka' });
        expect(spec.notes.join(' ')).toContain('по корінцю');
        expect(spec.notes.join(' ')).toContain('210×297');
    });
});

describe('фотокнига 20×30 — аркуш виступає за фінішний розворот', () => {
    const g = deriveGeometry('20x30')!;

    it('виступ аркуша: 10 мм по горизонталі, 2.5 по вертикалі', () => {
        expect(g.finished).toEqual({ w: 400, h: 300 });
        expect(g.overhang).toEqual({ x: 10, y: 2.5 });
    });

    it('розворот цілий, по корінцю не ріжеться', () => {
        const spec = buildTrimGuides(g, { productSlug: 'photobook-printed' });
        expect(spec.cutsAtGutter).toBe(false);
        expect(spec.notes.join(' ')).toContain('цілим аркушем');
    });

    it('видима безпечна зона не менша за мінімум навіть при великому виступі', () => {
        // safety без БД-рядка = overhang (10 / 2.5 мм від краю АРКУША); на
        // видимому фінішному розвороті від цього лишається 0 — а нуль від
        // різу безпечним не буває, тож мінімум 3 мм тримає лінію на місці.
        const spec = buildTrimGuides(g, { productSlug: 'photobook-printed' });
        expect(spec.safetyPct.left).toBeCloseTo((SAFETY_MIN_MM / 400) * 100, 5);
        expect(spec.safetyPct.top).toBeCloseTo((SAFETY_MIN_MM / 300) * 100, 5);
    });

    it('рядок photobook_sizes з більшим запасом розширює зону', () => {
        const gDb = deriveGeometry('20x30', {
            width_cm: 20, height_cm: 30,
            spread_width_mm: 420, spread_height_mm: 305,
            bleed_top_mm: 8, bleed_bottom_mm: 8, bleed_left_mm: 14, bleed_right_mm: 14,
        })!;
        const spec = buildTrimGuides(gDb, { productSlug: 'photobook-printed' });
        // 14 мм від краю аркуша − 10 мм виступу = 4 мм від видимого різу.
        expect(spec.safetyMm.left).toBe(14);
        expect(spec.safetyPct.left).toBeCloseTo((4 / 400) * 100, 5);
        // 8 − 2.5 = 5.5 мм по вертикалі.
        expect(spec.safetyPct.top).toBeCloseTo((5.5 / 300) * 100, 5);
    });
});

describe('квадратна фотокнига 20×20', () => {
    it('має власну геометрію, а не тревелову', () => {
        const g = deriveGeometry('20x20')!;
        const spec = buildTrimGuides(g, { productSlug: 'photobook-velour' });
        expect(spec.finished).toEqual({ w: 400, h: 200 });
        expect(spec.cutsAtGutter).toBe(false);
        expect(spec.notes.join(' ')).toContain('200×200');
    });
});

describe('лінії загину обкладинки', () => {
    // Значення — специфікація друкарні (травень 2026). Конструктор малює
    // клієнтові ту саму лінію з COVER_BLEED_MARGINS у BookLayoutEditor;
    // числа тут звірені з нею вручну і зафіксовані літералами, щоб адмінка
    // ніколи не показувала іншу лінію, ніж бачив клієнт.
    it('20×30: аркуш 470×328, загин 18 мм по вертикалі і 20 по горизонталі', () => {
        const g = deriveGeometry('20x30')!;
        const spec = buildCoverGuides(g)!;
        expect(spec.cover).toEqual({ w: 470, h: 328 });
        expect(spec.foldMm).toEqual({ tb: 18, lr: 20 });
        expect(spec.foldPct.top).toBeCloseTo((18 / 328) * 100, 5);
        expect(spec.foldPct.left).toBeCloseTo((20 / 470) * 100, 5);
    });

    it('travelbook і журнали: 20 мм з кожного боку аркуша 470×328', () => {
        const spec = buildCoverGuides(deriveGeometry('travelbook')!)!;
        expect(spec.foldMm).toEqual({ tb: 20, lr: 20 });
        expect(spec.foldPct.top).toBeCloseTo((20 / 328) * 100, 5);
        expect(spec.notes.join(' ')).toContain('20 мм з кожного боку');
    });

    it('20×20: 18 мм звідусіль на аркуші 457×243', () => {
        const spec = buildCoverGuides(deriveGeometry('20x20')!)!;
        expect(spec.foldMm).toEqual({ tb: 18, lr: 18 });
        expect(spec.foldPct.left).toBeCloseTo((18 / 457) * 100, 5);
    });

    it('23×23 не має міліметрів у специфікації — чесні 6% аркуша, як у конструкторі', () => {
        const spec = buildCoverGuides(deriveGeometry('23x23')!)!;
        expect(spec.foldMm).toBeNull();
        expect(spec.foldPct).toEqual({ top: 6, bottom: 6, left: 6, right: 6 });
        expect(spec.notes.join(' ')).toContain('6%');
    });

    it('без розмірів аркуша ліній нема — краще нічого, ніж вигадане', () => {
        const g = { ...deriveGeometry('20x30')!, cover: { w: 0, h: 0 } };
        expect(buildCoverGuides(g)).toBeNull();
    });

    // Відсоткова лінія має сенс лише якщо рендер обкладинки йде в пропорції
    // аркуша: /print у guides-режимі передає їй printPageW/printPageH тим
    // самим шляхом, яким ходить рендер-сервіс. Ця перевірка тримає пропорцію.
    it('висота guides-рендера обкладинки виводиться з її ж міліметрів', () => {
        const g = deriveGeometry('travelbook')!;
        const w = 520;                                   // екранна ширина половини
        const h = Math.round(w * 2 * (g.cover.h / g.cover.w));
        expect(h).toBe(Math.round(1040 * 328 / 470));    // 726 — пропорція аркуша
    });
});

describe('укладання готової обкладинки до лінії загину', () => {
    it('travelbook: 20 мм від висоти аркуша і від половини його ширини', () => {
        const inset = coverArtworkInset(deriveGeometry('travelbook'))!;
        expect(inset.topPct).toBeCloseTo((20 / 328) * 100, 5);
        expect(inset.bottomPct).toBeCloseTo((20 / 328) * 100, 5);
        expect(inset.outerPct).toBeCloseTo((20 / 235) * 100, 5);
    });

    it('фотокнижковий розмір теж має відсотки — рішення «чи застосовувати» приймає викликач', () => {
        const inset = coverArtworkInset(deriveGeometry('20x30'))!;
        expect(inset.topPct).toBeCloseTo((18 / 328) * 100, 5);
        expect(inset.outerPct).toBeCloseTo((20 / 235) * 100, 5);
    });

    it('без геометрії або без специфікації загину — null, малюємо по-старому', () => {
        expect(coverArtworkInset(null)).toBeNull();
        expect(coverArtworkInset(deriveGeometry('23x23'))).toBeNull();
    });
});
