import { describe, expect, it } from 'vitest';
import {
    coverScaleForRotation,
    fitBoxForRotation,
    isQuarterTurn,
    normalizeRotation,
} from '@/lib/print/photo-rotation';

/**
 * Геометрія повороту у друкованій рамці.
 *
 * Помилка тут не помітна ні на екрані, ні в картці замовлення — вона видно
 * тільки на папері, коли замовлення вже надруковане й оплачене (14217: чорні
 * поля на кожному повернутому фото, нормальними лишилися 24 знімки). Тому
 * покриття рамки перевіряється числом, а не оком.
 */
describe('normalizeRotation', () => {
    it('keeps a plain angle', () => {
        expect(normalizeRotation(90)).toBe(90);
    });

    it('folds negatives and full turns back into 0…359', () => {
        expect(normalizeRotation(-90)).toBe(270);
        expect(normalizeRotation(450)).toBe(90);
        expect(normalizeRotation(360)).toBe(0);
    });

    it('treats missing or broken values as no rotation', () => {
        expect(normalizeRotation(undefined)).toBe(0);
        expect(normalizeRotation(null)).toBe(0);
        expect(normalizeRotation(NaN)).toBe(0);
    });
});

describe('isQuarterTurn', () => {
    it('is true only where the axes actually swap', () => {
        expect(isQuarterTurn(90)).toBe(true);
        expect(isQuarterTurn(270)).toBe(true);
        expect(isQuarterTurn(-90)).toBe(true);
        expect(isQuarterTurn(0)).toBe(false);
        expect(isQuarterTurn(180)).toBe(false);
    });
});

describe('fitBoxForRotation', () => {
    it('swaps the frame for a quarter turn', () => {
        expect(fitBoxForRotation(1181, 1772, 90)).toEqual({ w: 1772, h: 1181 });
        expect(fitBoxForRotation(1181, 1772, 270)).toEqual({ w: 1772, h: 1181 });
    });

    it('leaves the frame alone for 0 and 180', () => {
        expect(fitBoxForRotation(1181, 1772, 0)).toEqual({ w: 1181, h: 1772 });
        expect(fitBoxForRotation(1181, 1772, 180)).toEqual({ w: 1181, h: 1772 });
    });
});

describe('coverScaleForRotation', () => {
    /**
     * Перевіряємо не формулу, а наслідок: після масштабу й повороту габарит
     * зображення накриває рамку з обох боків. Саме це й не виконувалось.
     */
    const covers = (frameW: number, frameH: number, imgAR: number, rotation: number) => {
        const scale = coverScaleForRotation(frameW, frameH, imgAR, rotation);
        const frameAR = frameW / frameH;
        const containW = imgAR > frameAR ? frameW : frameH * imgAR;
        const containH = imgAR > frameAR ? frameW / imgAR : frameH;
        const w = containW * scale, h = containH * scale;
        // Чверть обороту міняє габарит місцями.
        const boxW = isQuarterTurn(rotation) ? h : w;
        const boxH = isQuarterTurn(rotation) ? w : h;
        return boxW >= frameW - 1e-6 && boxH >= frameH - 1e-6;
    };

    it('matches the old formula when nothing is rotated', () => {
        // 10×15 портрет, горизонтальне фото 3:2.
        expect(coverScaleForRotation(1181, 1772, 1.5, 0)).toBeCloseTo(1.5 / (1181 / 1772), 6);
        // Вужче за рамку фото 1:2 — тут працює вже інша гілка contain.
        expect(coverScaleForRotation(1181, 1772, 0.5, 0)).toBeCloseTo((1181 / 1772) / 0.5, 6);
        // 2:3 у рамці 10×15 майже збігається з нею, тож масштаб близький до 1
        // — це і є межа між двома гілками, тримаємо її під тестом.
        expect(coverScaleForRotation(1181, 1772, 2 / 3, 0)).toBeCloseTo(1, 3);
    });

    it('covers the frame at every quarter turn, both orientations', () => {
        for (const rot of [0, 90, 180, 270]) {
            for (const ar of [1.5, 2 / 3, 1, 0.5, 2.4]) {
                expect(covers(1181, 1772, ar, rot)).toBe(true);
                expect(covers(1772, 1181, ar, rot)).toBe(true);
            }
        }
    });

    /**
     * Саме цей випадок і давав чорні поля: горизонтальне фото повернули на 90°
     * у вертикальному відбитку. Без урахування повороту множник лишався 2.25 і
     * габарит виходив вужчим за рамку.
     */
    it('grows the scale when a quarter turn makes the old one too small', () => {
        const straight = coverScaleForRotation(1181, 1772, 1.5, 0);
        const turned = coverScaleForRotation(1181, 1772, 1.5, 90);
        expect(turned).toBeGreaterThan(1);
        expect(covers(1181, 1772, 1.5, 90)).toBe(true);
        // Стара формула не залежала від кута — ось із чим порівнюємо.
        expect(turned).not.toBeCloseTo(straight, 6);
    });

    it('is the same for 90 and 270, and unchanged for 180', () => {
        expect(coverScaleForRotation(1181, 1772, 1.5, 90))
            .toBeCloseTo(coverScaleForRotation(1181, 1772, 1.5, 270), 6);
        expect(coverScaleForRotation(1181, 1772, 1.5, 180))
            .toBeCloseTo(coverScaleForRotation(1181, 1772, 1.5, 0), 6);
    });

    it('a square photo in a square frame needs no scaling at all', () => {
        for (const rot of [0, 90, 180, 270]) {
            expect(coverScaleForRotation(1000, 1000, 1, rot)).toBeCloseTo(1, 6);
        }
    });

    it('returns 1 rather than NaN while the photo size is still unknown', () => {
        expect(coverScaleForRotation(1181, 1772, NaN, 90)).toBe(1);
        expect(coverScaleForRotation(1181, 1772, 0, 90)).toBe(1);
        expect(coverScaleForRotation(0, 1772, 1.5, 90)).toBe(1);
    });
});
