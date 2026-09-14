import { describe, expect, it } from 'vitest';
import {
    localeFromPath,
    oauthCallbackUrl,
    resetPasswordUrl,
    safeNextPath,
} from '@/lib/auth/oauth-callback-url';

/**
 * Адреса повернення після входу.
 *
 * Найважливіше тут — не збірка рядка, а safeNextPath: він стоїть між чужим
 * посиланням і людиною, яка щойно ввела пароль. Відкритий редирект із
 * власного домену означає фішинг, якому браузер довіряє.
 */

const ORIGIN = 'https://touchmemories.com.ua';

describe('localeFromPath', () => {
    it('бере локаль із першого сегмента', () => {
        expect(localeFromPath('/uk/login')).toBe('uk');
        expect(localeFromPath('/pl/catalog/photobook')).toBe('pl');
        expect(localeFromPath('/de')).toBe('de');
    });

    it('невідоме і порожнє означає українську', () => {
        expect(localeFromPath('/fr/login')).toBe('uk');
        expect(localeFromPath('/')).toBe('uk');
        expect(localeFromPath('')).toBe('uk');
        expect(localeFromPath(null)).toBe('uk');
    });
});

describe('safeNextPath', () => {
    it('пропускає відносний шлях свого сайту', () => {
        expect(safeNextPath('/account')).toBe('/account');
        expect(safeNextPath('/uk/catalog/photobook?size=20x20')).toBe('/uk/catalog/photobook?size=20x20');
    });

    /** Рівно те, заради чого функція існує. */
    it('відкидає все, що веде на чужий сайт', () => {
        expect(safeNextPath('//evil.com')).toBeNull();
        expect(safeNextPath('https://evil.com')).toBeNull();
        expect(safeNextPath('http://evil.com')).toBeNull();
        expect(safeNextPath('///evil.com')).toBeNull();
        expect(safeNextPath('evil.com')).toBeNull();
    });

    it('відкидає порожнє і нерядкове', () => {
        expect(safeNextPath('')).toBeNull();
        expect(safeNextPath('   ')).toBeNull();
        expect(safeNextPath(null)).toBeNull();
        expect(safeNextPath(undefined)).toBeNull();
        expect(safeNextPath(42 as any)).toBeNull();
    });
});

/**
 * Лист про скидання пароля має вести на сторінку, яка існує.
 *
 * Модалка входу до 14.09.2026 слала на /auth/reset — маршруту за цією адресою
 * немає, тож людина з листа впиралася в 404 і пароль не змінювала.
 */
describe('resetPasswordUrl', () => {
    it('веде на сторінку нового пароля в локалі сторінки', () => {
        expect(resetPasswordUrl(ORIGIN, '/uk/catalog')).toBe(`${ORIGIN}/uk/reset-password`);
        expect(resetPasswordUrl(ORIGIN, '/pl/order/book')).toBe(`${ORIGIN}/pl/reset-password`);
    });

    it('без локалі веде в українську', () => {
        expect(resetPasswordUrl(ORIGIN, '/')).toBe(`${ORIGIN}/uk/reset-password`);
    });

    /** Саме та адреса, через яку все зламалося. */
    it('ніколи не веде на /auth/reset', () => {
        for (const path of ['/', '/uk', '/en/catalog', '/de/order/book']) {
            expect(resetPasswordUrl(ORIGIN, path)).not.toContain('/auth/reset');
        }
    });

    it('зайвий слеш у домені не дає подвійного', () => {
        expect(resetPasswordUrl(`${ORIGIN}/`, '/uk')).toBe(`${ORIGIN}/uk/reset-password`);
    });
});

describe('oauthCallbackUrl', () => {
    it('веде на маршрут у локалі поточної сторінки', () => {
        expect(oauthCallbackUrl(ORIGIN, '/uk/login')).toBe(`${ORIGIN}/uk/auth/callback`);
        expect(oauthCallbackUrl(ORIGIN, '/pl/register')).toBe(`${ORIGIN}/pl/auth/callback`);
    });

    it('несе сторінку повернення, коли вона є', () => {
        expect(oauthCallbackUrl(ORIGIN, '/uk/catalog/photobook', '/uk/catalog/photobook'))
            .toBe(`${ORIGIN}/uk/auth/callback?next=%2Fuk%2Fcatalog%2Fphotobook`);
    });

    it('ворожий next просто зникає, адреса лишається робочою', () => {
        expect(oauthCallbackUrl(ORIGIN, '/uk/login', '//evil.com')).toBe(`${ORIGIN}/uk/auth/callback`);
        expect(oauthCallbackUrl(ORIGIN, '/uk/login', 'https://evil.com')).toBe(`${ORIGIN}/uk/auth/callback`);
    });

    it('зайвий слеш у домені не дає подвійного', () => {
        expect(oauthCallbackUrl(`${ORIGIN}/`, '/uk/login')).toBe(`${ORIGIN}/uk/auth/callback`);
    });

    it('запит у шляху повернення переживає кодування', () => {
        const url = oauthCallbackUrl(ORIGIN, '/uk/catalog/book', '/uk/catalog/book?tab=cover&size=20x20');
        expect(url).toBe(`${ORIGIN}/uk/auth/callback?next=%2Fuk%2Fcatalog%2Fbook%3Ftab%3Dcover%26size%3D20x20`);
        expect(new URL(url).searchParams.get('next')).toBe('/uk/catalog/book?tab=cover&size=20x20');
    });
});
