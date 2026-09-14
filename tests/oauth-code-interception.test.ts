import { describe, expect, it } from 'vitest';
import {
    CODE_INTERCEPTION_EXCLUSIONS,
    buildInterceptTarget,
    matchedExclusion,
    shouldInterceptAuthCode,
    stripLocale,
} from '@/lib/auth/oauth-code-interception';

/**
 * Перехоплення ?code= у middleware.
 *
 * Кожне виключення тут має власний тест, названий наслідком його втрати. Це
 * навмисно: список виключень виглядає зайвим доти, доки хтось його не
 * скоротить, а ціна кожного рядка — тихо зламаний шлях для частини людей.
 */

const intercept = (pathname: string) => shouldInterceptAuthCode({ pathname, hasCode: true });

describe('stripLocale', () => {
    it('знімає локаль, коли вона є', () => {
        expect(stripLocale('/uk/reset-password')).toBe('/reset-password');
        expect(stripLocale('/de/auth/callback')).toBe('/auth/callback');
        expect(stripLocale('/pl')).toBe('/');
    });

    it('лишає шлях як є, коли локалі немає', () => {
        expect(stripLocale('/admin/login')).toBe('/admin/login');
        expect(stripLocale('/')).toBe('/');
        expect(stripLocale('/catalog')).toBe('/catalog');
    });

    /** «fr» не наша локаль, і різати її не можна. */
    it('чужу мову за локаль не вважає', () => {
        expect(stripLocale('/fr/reset-password')).toBe('/fr/reset-password');
    });
});

describe('перехоплення там, де воно потрібне', () => {
    it('звичайні сторінки перехоплюються в усіх локалях', () => {
        for (const locale of ['uk', 'en', 'ro', 'pl', 'de']) {
            expect(intercept(`/${locale}`)).toBe(true);
            expect(intercept(`/${locale}/catalog/photobook`)).toBe(true);
            expect(intercept(`/${locale}/order/book`)).toBe(true);
            expect(intercept(`/${locale}/account`)).toBe(true);
        }
    });

    it('сторінка без локалі теж', () => {
        expect(intercept('/')).toBe(true);
        expect(intercept('/catalog')).toBe(true);
    });

    it('без коду не перехоплюється нічого', () => {
        expect(shouldInterceptAuthCode({ pathname: '/uk/catalog', hasCode: false })).toBe(false);
    });
});

describe('виключення — кожне окремо', () => {
    /** Втрата цього рядка: адміністратора авторизує як клієнта і веде в /account. */
    it('адмінка лишається зі своїм обміном коду', () => {
        expect(intercept('/admin/login')).toBe(false);
        expect(intercept('/admin')).toBe(false);
        expect(intercept('/admin/orders')).toBe(false);
        expect(matchedExclusion('/admin/login')).toBe('/admin');
    });

    /** Втрата цього рядка: реферальний код і код кампанії читалися б як код входу. */
    it('маршрути API не чіпаються', () => {
        expect(intercept('/api/referral/check')).toBe(false);
        expect(intercept('/api/admin/campaign/test-send')).toBe(false);
    });

    /** Втрата цього рядка: нескінченний цикл редиректів на самого себе. */
    it('сам маршрут зворотного виклику не перенаправляє себе', () => {
        for (const locale of ['uk', 'en', 'ro', 'pl', 'de']) {
            expect(intercept(`/${locale}/auth/callback`)).toBe(false);
        }
        expect(matchedExclusion('/uk/auth/callback')).toBe('/auth/');
    });

    /** Втрата цього рядка: скинути пароль не може ніхто. */
    it('сторінка нового пароля лишає код собі', () => {
        for (const locale of ['uk', 'en', 'ro', 'pl', 'de']) {
            expect(intercept(`/${locale}/reset-password`)).toBe(false);
        }
        expect(matchedExclusion('/uk/reset-password')).toBe('/reset-password');
    });

    it('окремі інструменти проходять повз', () => {
        expect(intercept('/tools/calc.html')).toBe(false);
        expect(intercept('/uk/tools/calc.html')).toBe(false);
    });

    it('у кожного виключення є пояснення, а не лише префікс', () => {
        for (const rule of CODE_INTERCEPTION_EXCLUSIONS) {
            expect(rule.why.length).toBeGreaterThan(40);
        }
    });
});

describe('buildInterceptTarget', () => {
    it('веде в маршрут тієї самої локалі й несе сторінку повернення', () => {
        const target = buildInterceptTarget('/uk/catalog/photobook', '?code=abc123');
        const url = new URL(target, 'https://touchmemories.com.ua');
        expect(url.pathname).toBe('/uk/auth/callback');
        expect(url.searchParams.get('code')).toBe('abc123');
        expect(url.searchParams.get('next')).toBe('/uk/catalog/photobook');
    });

    /** Інакше код поїхав би назад разом зі сторінкою і все почалося б спочатку. */
    it('код у сторінці повернення не лишається', () => {
        const target = buildInterceptTarget('/uk/order/book', '?code=abc123&tab=cover');
        const next = new URL(target, 'https://touchmemories.com.ua').searchParams.get('next');
        expect(next).toBe('/uk/order/book?tab=cover');
        expect(next).not.toContain('code');
    });

    it('решта параметрів доживає до сторінки', () => {
        const target = buildInterceptTarget('/uk/catalog', '?code=x&ref=PROMO7&size=20x20');
        const next = new URL(target, 'https://touchmemories.com.ua').searchParams.get('next');
        expect(next).toBe('/uk/catalog?ref=PROMO7&size=20x20');
    });

    it('без локалі веде в українську', () => {
        const url = new URL(buildInterceptTarget('/', '?code=abc'), 'https://touchmemories.com.ua');
        expect(url.pathname).toBe('/uk/auth/callback');
        expect(url.searchParams.get('next')).toBe('/');
    });
});
