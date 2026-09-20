import { describe, expect, it } from 'vitest';
import { clientIp, createRateLimiter } from '@/lib/security/guess-rate-limit';

/**
 * Обмежувач перебору коду.
 *
 * Ціна помилки в обидва боки конкретна. Зависока межа — і код сертифіката на
 * пред'явника простукується перебором: п'ять цифр це сто тисяч комбінацій.
 * Занизька — і жива людина з папірцем у руках отримує відмову на другій спробі
 * та йде писати в дирекг.
 */

const headers = (h: Record<string, string>) => ({
    headers: { get: (n: string) => h[n.toLowerCase()] ?? null },
});

describe('createRateLimiter', () => {
    it('lets exactly `limit` requests through, then blocks', () => {
        const rl = createRateLimiter({ limit: 3, windowMs: 1000, now: () => 0 });
        expect(rl.over('ip')).toBe(false);
        expect(rl.over('ip')).toBe(false);
        expect(rl.over('ip')).toBe(false);
        expect(rl.over('ip')).toBe(true);
    });

    it('counts each IP separately, so one abuser cannot lock everyone out', () => {
        const rl = createRateLimiter({ limit: 1, windowMs: 1000, now: () => 0 });
        expect(rl.over('abuser')).toBe(false);
        expect(rl.over('abuser')).toBe(true);
        // Сусід по вікну лишається чистим.
        expect(rl.over('someone-else')).toBe(false);
    });

    it('reopens the window on the exact boundary, not a tick later', () => {
        let now = 0;
        const rl = createRateLimiter({ limit: 1, windowMs: 100, now: () => now });
        expect(rl.over('ip')).toBe(false);
        expect(rl.over('ip')).toBe(true);
        now = 99;
        expect(rl.over('ip')).toBe(true);
        // Рівно на межі вікно вже нове: інакше запит у цю мілісекунду
        // зарахувався б у старе вікно і дав зайву відмову.
        now = 100;
        expect(rl.over('ip')).toBe(false);
    });

    it('starts the next window from the request that reopened it', () => {
        let now = 0;
        const rl = createRateLimiter({ limit: 2, windowMs: 100, now: () => now });
        rl.over('ip'); rl.over('ip');
        expect(rl.over('ip')).toBe(true);
        now = 100;
        expect(rl.over('ip')).toBe(false);  // перший у новому вікні
        expect(rl.over('ip')).toBe(false);  // другий
        expect(rl.over('ip')).toBe(true);   // третій уже зайвий
    });

    it('forgets everything on reset', () => {
        const rl = createRateLimiter({ limit: 1, windowMs: 1000, now: () => 0 });
        rl.over('ip');
        expect(rl.over('ip')).toBe(true);
        rl.reset();
        expect(rl.over('ip')).toBe(false);
    });
});

describe('clientIp', () => {
    /**
     * Саме та помилка, що жила в усіх чотирьох копіях: заголовок брався цілим
     * рядком. Для клієнта 1.2.3.4 ключ «1.2.3.4» і ключ «1.2.3.4, 9.9.9.9» —
     * різні лічильники, тож зайвий проксі на шляху обнуляв обмеження.
     */
    it('takes the client, not the whole proxy chain', () => {
        expect(clientIp(headers({ 'x-forwarded-for': '1.2.3.4, 9.9.9.9, 7.7.7.7' }))).toBe('1.2.3.4');
        expect(clientIp(headers({ 'x-forwarded-for': '1.2.3.4' }))).toBe('1.2.3.4');
    });

    it('gives one key whether or not a hop was added', () => {
        const direct = clientIp(headers({ 'x-forwarded-for': '1.2.3.4' }));
        const proxied = clientIp(headers({ 'x-forwarded-for': '1.2.3.4, 9.9.9.9' }));
        expect(direct).toBe(proxied);
    });

    it('trims the spaces the header is written with', () => {
        expect(clientIp(headers({ 'x-forwarded-for': '  1.2.3.4  , 9.9.9.9' }))).toBe('1.2.3.4');
    });

    it('falls back to x-real-ip, then to a constant, rather than to empty', () => {
        expect(clientIp(headers({ 'x-real-ip': '5.6.7.8' }))).toBe('5.6.7.8');
        expect(clientIp(headers({ 'x-forwarded-for': '' , 'x-real-ip': '5.6.7.8' }))).toBe('5.6.7.8');
        // Порожній ключ звалив би всіх безголових клієнтів в один лічильник,
        // тому замість '' має бути щось конкретне.
        expect(clientIp(headers({}))).toBe('127.0.0.1');
    });
});
