import { describe, expect, it } from 'vitest';
import { DPI_BAD, DPI_WARN, dpiFor, dpiLevel } from '@/lib/print/dpi';
import {
    checkPhotoForPage,
    describePhoto,
    neededPixels,
    orderedPageMm,
    summarisePhotos,
} from '@/lib/orders/photo-resolution';

/**
 * TM-001336: фотокнига 30×30 за 3285 ₴, і сорок чотири фото, викачані з
 * Фейсбука — імена виду 783897896_1396318221861607_…_n.jpg, вага від
 * дев'ятнадцяти кілобайтів. У тому ж замовленні сім знімків зі звичайними
 * іменами важать усемеро більше, тож стискали не ми.
 *
 * Біда була в тому, що на кроці завантаження ми не сказали ні слова, і
 * дізналися про це аж тоді, коли дизайнер сів верстати.
 */

// 30×30 см сторінка.
const page30 = { w: 300, h: 300 };

describe('розмір замовленого виробу з конфігурації', () => {
    it('різні конструктори називають розмір по-різному — знаємо всі', () => {
        expect(orderedPageMm({ 'Розмір книги': '20×20' })).toEqual({ w: 200, h: 200 });
        expect(orderedPageMm({ 'Розмір': '30х30' })).toEqual({ w: 300, h: 300 });
        expect(orderedPageMm({ 'Формат': 'A4' })).toEqual({ w: 210, h: 297 });
        expect(orderedPageMm({ 'Розмір': '20x30 см' })).toEqual({ w: 200, h: 300 });
    });

    it('без розміру нічого не вигадуємо', () => {
        expect(orderedPageMm(null)).toBeNull();
        expect(orderedPageMm({})).toBeNull();
        expect(orderedPageMm({ 'Розмір': 'велика' })).toBeNull();
        expect(orderedPageMm({ 'Ламінація': 'Матова' })).toBeNull();
    });
});

describe('чи вистачить фото на цілу сторінку', () => {
    it('фейсбукова копія на 30×30 — саме той випадок', () => {
        // Фейсбук віддає щонайбільше 2048 пікселів по довгій стороні.
        expect(checkPhotoForPage({ width: 2048, height: 2048 }, page30))
            .toEqual({ level: 'ok', dpi: 173 });
        // А часто 1080 — і це рівно межа, яку обрала Діана.
        expect(checkPhotoForPage({ width: 1080, height: 1080 }, page30))
            .toEqual({ level: 'ok', dpi: 91 });
        // Трохи менше — і вже попередження.
        expect(checkPhotoForPage({ width: 1000, height: 1000 }, page30)?.level).toBe('warn');
        expect(checkPhotoForPage({ width: 700, height: 700 }, page30)?.level).toBe('bad');
    });

    it('оригінал з телефона проходить спокійно', () => {
        expect(checkPhotoForPage({ width: 4032, height: 3024 }, page30)?.level).toBe('ok');
    });

    it('горизонтальне фото на вертикальній сторінці не лається на рівному місці', () => {
        // Кадр можна покласти боком, тож беремо кращу з двох орієнтацій.
        const portraitPage = { w: 200, h: 300 };
        const landscape = { width: 3000, height: 2000 };
        expect(checkPhotoForPage(landscape, portraitPage)?.level).toBe('ok');
    });

    it('без розмірів мовчимо, а не лякаємо навмання', () => {
        expect(checkPhotoForPage({ width: 0, height: 0 }, page30)).toBeNull();
        expect(checkPhotoForPage(undefined, page30)).toBeNull();
        expect(checkPhotoForPage({ width: 1000, height: 1000 }, null)).toBeNull();
    });
});

describe('скільки пікселів треба', () => {
    it('для 30×30 при межі 91 DPI', () => {
        expect(neededPixels(page30)).toEqual({ w: 1075, h: 1075 });
    });
});

describe('що саме бачить клієнтка', () => {
    it('підпис каже про сторінку й колаж окремо, бо це різні речі', () => {
        expect(describePhoto({ level: 'warn', dpi: 85 })).toContain('у колажі нормально');
        expect(describePhoto({ level: 'bad', dpi: 50 })).toContain('розмито');
        expect(describePhoto({ level: 'ok', dpi: 300 })).toBe('');
        expect(describePhoto(null)).toBe('');
    });

    it('підсумок називає число і причину, а не просто «щось не так»', () => {
        const checks = [
            { level: 'bad' as const, dpi: 50 },
            { level: 'warn' as const, dpi: 85 },
            { level: 'ok' as const, dpi: 300 },
        ];
        const line = summarisePhotos(checks, page30);
        expect(line).toContain('2 фото з 3');
        expect(line).toContain('1075×1075');
        expect(line).toContain('Фейсбука');
        expect(line).toContain('оригінали');
    });

    it('коли всі фото добрі — жодного слова', () => {
        expect(summarisePhotos([{ level: 'ok', dpi: 300 }], page30)).toBe('');
        expect(summarisePhotos([], page30)).toBe('');
        expect(summarisePhotos([null, null], page30)).toBe('');
    });
});

describe('спільний поріг', () => {
    it('91 і 70 — числа Діани, не круглі навмисно', () => {
        expect(DPI_WARN).toBe(91);
        expect(DPI_BAD).toBe(70);
    });

    it('рівень рахується від них, і сміття не проходить', () => {
        expect(dpiLevel(91)).toBe('ok');
        expect(dpiLevel(90)).toBe('warn');
        expect(dpiLevel(70)).toBe('warn');
        expect(dpiLevel(69)).toBe('bad');
        expect(dpiLevel(0)).toBeNull();
        expect(dpiLevel(NaN)).toBeNull();
    });

    it('dpiFor рахує пікселі на дюйм із міліметрів', () => {
        expect(Math.round(dpiFor(300, 25.4))).toBe(300);
        expect(dpiFor(0, 100)).toBe(0);
        expect(dpiFor(100, 0)).toBe(0);
    });
});
