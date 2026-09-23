import { describe, expect, it } from 'vitest';
import { coverArtworkFit, frontCoverCropFractions, frontCoverCropPx } from '@/lib/print/cover-fold';
import { mmToPx } from '@/lib/print/geometry';

/**
 * Вирізання передньої обкладинки з готового cover.jpg.
 *
 * Файл обкладинки тревелбука — це весь аркуш 470×328 мм у 300 DPI, тобто
 * 5551×3874 пікселі: зліва задня обкладинка, справа передня. Рендер-сервіс
 * робить його одним знімком, і саме з нього адмінка ріже передню половину —
 * окремий рендер дав би файл лише новим замовленням і міг би розійтися з тим,
 * що поїхало в друк.
 */
const SHEET_W = mmToPx(470); // 5551
const SHEET_H = mmToPx(328); // 3874

describe('frontCoverCropFractions', () => {
    it('з полями — рівно права половина аркуша', () => {
        const f = frontCoverCropFractions('travelbook', 'bleed');
        expect(f).toEqual({ left: 0.5, top: 0, width: 0.5, height: 1 });
    });

    it('без полів — видима площина 210×288 мм', () => {
        const f = frontCoverCropFractions('travelbook', 'trimmed');
        expect(f.width * 470).toBeCloseTo(210, 6);
        expect(f.height * 328).toBeCloseTo(288, 6);
        // Ліва межа: середина аркуша плюс половина корінця (5 мм).
        expect(f.left * 470).toBeCloseTo(235 + 5, 6);
        expect(f.top * 328).toBeCloseTo(20, 6);
    });
});

describe('frontCoverCropPx', () => {
    it('з полями дає половину файлу і не вилазить за його межі', () => {
        const c = frontCoverCropPx('travelbook', 'bleed', SHEET_W, SHEET_H)!;
        expect(c.left + c.width).toBeLessThanOrEqual(SHEET_W);
        expect(c.top + c.height).toBe(SHEET_H);
        // Непарна ширина аркуша (5551) не має губити піксель на краю.
        expect(c.left + c.width).toBe(SHEET_W);
    });

    it('без полів дає приблизно 2480×3402 пікселі — сторінка і видима висота', () => {
        const c = frontCoverCropPx('travelbook', 'trimmed', SHEET_W, SHEET_H)!;
        expect(Math.abs(c.width - mmToPx(210))).toBeLessThanOrEqual(2);
        expect(Math.abs(c.height - mmToPx(288))).toBeLessThanOrEqual(2);
        expect(c.left + c.width).toBeLessThanOrEqual(SHEET_W);
        expect(c.top + c.height).toBeLessThanOrEqual(SHEET_H);
    });

    it('порожній файл не ріжеться, а чесно повертає null', () => {
        expect(frontCoverCropPx('travelbook', 'bleed', 0, 0)).toBeNull();
    });
});

/**
 * Перевірка файлу обкладинки перед завантаженням у каталог.
 *
 * Числа тревелбука: аркуш 470×328 мм, з нього передня половина 235×328 мм, у
 * 300 DPI це 2776×3874 пікселі. Видима після загину площина — 210×288 мм,
 * тобто 2480×3402 пікселі.
 */
describe('coverArtworkFit', () => {
    it('нинішні файли каталогу 1333×2000 дають 144 DPI і смугу з боків', () => {
        const f = coverArtworkFit('travelbook', 1333, 2000)!;
        expect(f.sheetPx).toEqual({ w: 2776, h: 3874 });
        expect(f.facePx.w).toBe(2480);
        expect(f.facePx.h).toBe(3402);
        // Вписування обмежене висотою: 3402/2000 менше за 2480/1333.
        expect(f.dpi).toBe(176);
        expect(f.band?.axis).toBe('x');
        expect(f.band!.mm).toBeGreaterThan(8);
        expect(f.band!.mm).toBeLessThan(10);
        expect(f.matchesSheet).toBe(false);
        expect(f.coversSheet).toBe(false);
    });

    it('файл рівно під аркуш нічого не втрачає і дає 300 DPI на аркуші', () => {
        const f = coverArtworkFit('travelbook', 2776, 3874)!;
        expect(f.matchesSheet).toBe(true);
        expect(f.coversSheet).toBe(true);
        // Заповнюючи аркуш, такий файл не ріже нічого.
        expect(f.legacyCrop).toBeNull();
    });

    it('файл під видиму площину вписується без смуг', () => {
        const f = coverArtworkFit('travelbook', 2480, 3402)!;
        expect(f.band).toBeNull();
        expect(f.dpi).toBe(300);
    });

    it('надто широкий файл лишає смугу згори і знизу, а не з боків', () => {
        const f = coverArtworkFit('travelbook', 4000, 2000)!;
        expect(f.band?.axis).toBe('y');
        expect(f.legacyCrop?.axis).toBe('x');
    });

    it('порожній файл не рахується', () => {
        expect(coverArtworkFit('travelbook', 0, 0)).toBeNull();
    });
});
