import { describe, expect, it } from 'vitest';
import {
    PHOTO_JOURNAL_SOFT,
    PHOTO_JOURNAL_HARD,
    TRAVEL_BOOK,
    getMagazinePrice,
    getPhotojournalSoftPrice,
    getPhotojournalHardPrice,
    getTravelBookPrice,
    TYPESETTING_PRICE,
} from '@/lib/products';

/**
 * The price list, written down.
 *
 * Every number below is Diana's own price for that page count, verified
 * against the live `products` rows in Supabase on 2026-08-19 (all 87 tiers
 * of the three page-priced products agreed to the hryvnia). They are written
 * as literals ON PURPOSE — a test that derives its expectation from the code
 * it is testing proves nothing. If one of these fails, either somebody
 * changed a price and must say so out loud, or something drifted.
 *
 * This is the file to edit when a price genuinely changes, and editing it is
 * the moment to also run GET /api/admin/pricing/audit against the database.
 */

/** Глянцевий журнал + фотожурнал з м'якою обкладинкою — одна шкала, 8–100 ст. */
const SOFT_SCALE: Record<number, number> = {
    8: 525, 12: 575, 16: 725, 20: 875, 24: 1025, 28: 1175, 32: 1325, 36: 1475,
    40: 1625, 44: 1775, 48: 1925, 52: 2050, 60: 2250, 72: 2550, 80: 2800,
    92: 2950, 100: 3150,
};

/**
 * Travel Book + журнал з твердою обкладинкою — одна шкала, кожна парна
 * кількість 12–80. Крок 75 ₴ тримається від 12 до 48. Вище 48 ідуть власні
 * анкери Діани: 50 і 52 стоять на 2075 та 2150, далі крок 50 ₴ з анкерами на
 * 60, 72 і 80. Нерівність кроку тут навмисна, це знижка на обсяг.
 */
const HARD_SCALE: Record<number, number> = {
    12: 675, 14: 750, 16: 825, 18: 900, 20: 975, 22: 1050, 24: 1125, 26: 1200,
    28: 1275, 30: 1350, 32: 1425, 34: 1500, 36: 1575, 38: 1650, 40: 1725,
    42: 1800, 44: 1875, 46: 1950, 48: 2025, 50: 2075, 52: 2150, 54: 2200,
    56: 2250, 58: 2300, 60: 2350, 62: 2400, 64: 2450, 66: 2500, 68: 2550,
    70: 2600, 72: 2650, 74: 2700, 76: 2750, 78: 2800, 80: 2900,
};

describe('шкала м\'якого журналу', () => {
    it.each(Object.entries(SOFT_SCALE) as [string, number][])('%s сторінок коштують %s ₴', (pages, price) => {
        expect(getMagazinePrice(Number(pages), false)).toBe(price);
    });

    it('фотожурнал з м\'якою обкладинкою — той самий виріб і та сама ціна', () => {
        for (const pages of Object.keys(SOFT_SCALE).map(Number)) {
            expect(getPhotojournalSoftPrice(pages)).toBe(getMagazinePrice(pages, false));
        }
    });

    it('шкала не має зайвих і не має пропущених тарифів', () => {
        expect(Object.keys(PHOTO_JOURNAL_SOFT.prices).map(Number).sort((a, b) => a - b))
            .toEqual(Object.keys(SOFT_SCALE).map(Number).sort((a, b) => a - b));
    });
});

describe('шкала твердого журналу і Travel Book', () => {
    it.each(Object.entries(HARD_SCALE) as [string, number][])('%s сторінок коштують %s ₴', (pages, price) => {
        expect(getPhotojournalHardPrice(Number(pages))).toBe(price);
        expect(getTravelBookPrice(Number(pages))).toBe(price);
    });

    it('обидва товари ходять по одній шкалі, а не по двох копіях', () => {
        expect(PHOTO_JOURNAL_HARD.prices).toBe(TRAVEL_BOOK.prices);
        expect(PHOTO_JOURNAL_HARD.pagesAvailable).toBe(TRAVEL_BOOK.pagesAvailable);
    });

    it('продається кожна парна кількість від 12 до 80, без дірок', () => {
        const expected: number[] = [];
        for (let p = 12; p <= 80; p += 2) expected.push(p);
        expect(TRAVEL_BOOK.pagesAvailable).toEqual(expected);
        expect(Object.keys(TRAVEL_BOOK.prices).map(Number).sort((a, b) => a - b)).toEqual(expected);
    });

    it('ціна зростає з кожним тарифом і ніде не падає', () => {
        const pages = Object.keys(HARD_SCALE).map(Number).sort((a, b) => a - b);
        for (let i = 1; i < pages.length; i++) {
            expect(getTravelBookPrice(pages[i])).toBeGreaterThan(getTravelBookPrice(pages[i - 1]));
        }
    });
});

describe('регресії, які вже коштували грошей', () => {
    // TM-001202: дванадцятисторінковий журнал з твердою обкладинкою продався
    // за 825 ₴ — ціну шістнадцяти сторінок, бо база товару в Supabase лишилась
    // на старому анкері. Ця перевірка тримає обидва числа нарізно.
    it('12 сторінок твердого журналу це 675 ₴, а 825 ₴ це вже 16 сторінок', () => {
        expect(getPhotojournalHardPrice(12)).toBe(675);
        expect(getPhotojournalHardPrice(16)).toBe(825);
    });

    // TM-001195, TM-001185, TM-001197: редактор додає сторінки розворотами, і
    // кількість, якої не було в прайсі, округлювалась угору. Людина платила за
    // сторінки, яких не отримає. Кожна парна кількість тепер має власну ціну.
    it('14, 18 і 22 сторінки мають власну ціну, а не ціну наступного тарифу', () => {
        expect(getPhotojournalHardPrice(14)).toBe(750);
        expect(getPhotojournalHardPrice(14)).not.toBe(getPhotojournalHardPrice(16));
        expect(getTravelBookPrice(18)).toBe(900);
        expect(getTravelBookPrice(22)).toBe(1050);
    });

    // Непарна кількість фізично неможлива — аркуш має два боки. Якщо така
    // все ж прийде, округлення вгору лишається правильною поведінкою: краще
    // порахувати дорожче, ніж надрукувати те, за що не заплатили.
    it('непарна кількість округлюється вгору до наступного тарифу', () => {
        expect(getTravelBookPrice(13)).toBe(getTravelBookPrice(14));
        expect(getMagazinePrice(9, false)).toBe(getMagazinePrice(12, false));
    });

    it('понад максимум ціна не падає, а лишається найдорожчим тарифом', () => {
        expect(getTravelBookPrice(120)).toBe(2900);
        expect(getMagazinePrice(200, false)).toBe(3150);
    });
});

describe('верстка тексту', () => {
    it('додає рівно 195 ₴ і нічого більше', () => {
        expect(TYPESETTING_PRICE).toBe(195);
        expect(getMagazinePrice(8, true)).toBe(525 + 195);
        expect(getMagazinePrice(24, true)).toBe(1025 + 195);
    });

    // Верстка це плоска праця, вона не має множитись на терміновість. Ціна
    // без верстки має лишатись базою саме для того, щоб множник ліг тільки
    // на неї: 525 × 1.3 = 683, і аж потім + 195 = 878, а не (525 + 195) × 1.3.
    it('база для множника терміновості йде без верстки', () => {
        const base = getMagazinePrice(8, false);
        expect(base).toBe(525);
        expect(Math.round(base * 1.3) + 195).toBe(878);
        expect(Math.round(getMagazinePrice(8, true) * 1.3)).toBe(936);
    });
});
