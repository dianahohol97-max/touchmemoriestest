import { describe, expect, it } from 'vitest';
import {
    withPromoCode,
    parseStoredPromoCode,
    serializePromoCode,
    isPromoCodeShaped,
    PROMO_TTL_MS,
} from '@/lib/referral/promo-code';

/**
 * Знижка з листа має доїхати до чекауту сама.
 *
 * Клієнтка: «бачила, що маю від вас -7% знижки, чи можливо якось це врахувати,
 * бо відразу перекидає на оплату моно». Лист показував код і обіцяв -7%, а
 * кнопка в ньому вела просто на каталог — без коду. Чекаут уміє підставляти
 * ?promo=КОД сам, цю механіку зробили для партнерських посилань, але доти,
 * доки коду в адресі немає, вона не робить нічого.
 *
 * Одного коду в адресі мало: параметр живе до першого переходу, а з каталогу
 * людина йде на товар. Тому код відкладається і читається на чекауті.
 */
describe('withPromoCode', () => {
    it('додає код до простого посилання', () => {
        expect(withPromoCode('https://touchmemories.com.ua/catalog', 'WELCOME7'))
            .toBe('https://touchmemories.com.ua/catalog?promo=WELCOME7');
    });

    it('не ламає наявні параметри', () => {
        expect(withPromoCode('https://touchmemories.com.ua/catalog?utm_source=email', 'WINBACK7'))
            .toBe('https://touchmemories.com.ua/catalog?utm_source=email&promo=WINBACK7');
    });

    it('не дублює код, який уже стоїть', () => {
        const url = 'https://touchmemories.com.ua/?promo=HAPPY';
        expect(withPromoCode(url, 'WELCOME7')).toBe(url);
    });

    it('кодує кирилицю — партнерські коди роблять із назв агенцій', () => {
        expect(withPromoCode('https://touchmemories.com.ua', 'ПОДОЛЯНКА'))
            .toBe(`https://touchmemories.com.ua?promo=${encodeURIComponent('ПОДОЛЯНКА')}`);
    });

    it('якір лишається в кінці, а не всередині параметрів', () => {
        expect(withPromoCode('https://touchmemories.com.ua/catalog#top', 'WELCOME7'))
            .toBe('https://touchmemories.com.ua/catalog?promo=WELCOME7#top');
    });

    it('без коду або з несхожим на код посилання не змінюється', () => {
        const url = 'https://touchmemories.com.ua/catalog';
        expect(withPromoCode(url, '')).toBe(url);
        expect(withPromoCode(url, null)).toBe(url);
        expect(withPromoCode(url, 'ABC')).toBe(url);                 // закоротко
        expect(withPromoCode(url, 'A'.repeat(17))).toBe(url);        // задовго
        expect(withPromoCode(url, 'WITH SPACE')).toBe(url);
    });
});

describe('parseStoredPromoCode', () => {
    const now = 1_700_000_000_000;

    it('читає щойно відкладений код', () => {
        expect(parseStoredPromoCode(serializePromoCode('welcome7', now), now)).toBe('WELCOME7');
    });

    it('код місячної давності ще живий, старший — ні', () => {
        const almost = now + PROMO_TTL_MS - 1000;
        const past = now + PROMO_TTL_MS + 1000;
        expect(parseStoredPromoCode(serializePromoCode('WELCOME7', now), almost)).toBe('WELCOME7');
        expect(parseStoredPromoCode(serializePromoCode('WELCOME7', now), past)).toBeNull();
    });

    it('голий рядок без часу вважається свіжим', () => {
        expect(parseStoredPromoCode('WINBACK7', now)).toBe('WINBACK7');
    });

    it('порожнє, зіпсоване й несхоже на код читається як нічого', () => {
        expect(parseStoredPromoCode(null, now)).toBeNull();
        expect(parseStoredPromoCode('', now)).toBeNull();
        expect(parseStoredPromoCode('{зіпсовано', now)).toBeNull();
        expect(parseStoredPromoCode('{}', now)).toBeNull();
        expect(parseStoredPromoCode(serializePromoCode('AB', now), now)).toBeNull();
    });
});

describe('isPromoCodeShaped', () => {
    it('та сама перевірка, що й у чекауті', () => {
        expect(isPromoCodeShaped('WELCOME7')).toBe(true);
        expect(isPromoCodeShaped('ПОДОЛЯНКА')).toBe(true);
        expect(isPromoCodeShaped('ABC')).toBe(false);
        expect(isPromoCodeShaped(undefined)).toBe(false);
    });
});
