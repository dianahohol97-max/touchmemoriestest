import { describe, expect, it } from 'vitest';
import {
    FALLBACK_ALERT_KEY,
    checkMagazineBriefFallback,
    decideFallbackAlert,
    formatFallbackAlert,
} from '@/lib/alerts/magazine-brief-fallback';

/**
 * Сторож відкату брифа: сигнал у робочий чат на ПЕРШЕ замовлення, що пішло
 * старим шляхом після вмикання серверного оформлення.
 *
 * Сторож помиляється двома способами, і обидва погані: мовчить, коли маршрут
 * ліг, або дзвонить кожні пʼятнадцять хвилин про те саме. Тут закріплені
 * обидві межі.
 */
describe('рішення сторожа', () => {
    const order = { order_number: 'TM-001331', created_at: '2026-09-17T09:00:00.000Z', custom_attributes: { price_declared: 1728 } };

    it('вимикач вимкнено — старий шлях це норма, сигналу немає', () => {
        expect(decideFallbackAlert({ flagOn: false, alreadyAlerted: false, order })).toEqual({ send: false, reason: 'flag_off' });
    });

    it('сигнал уже надсилали — другого разу не буде', () => {
        expect(decideFallbackAlert({ flagOn: true, alreadyAlerted: true, order })).toEqual({ send: false, reason: 'already_alerted' });
    });

    it('відкату не було — мовчимо', () => {
        expect(decideFallbackAlert({ flagOn: true, alreadyAlerted: false, order: null })).toEqual({ send: false, reason: 'no_fallback' });
    });

    it('перше замовлення старим шляхом при ввімкненому вимикачі — сигнал', () => {
        expect(decideFallbackAlert({ flagOn: true, alreadyAlerted: false, order })).toEqual({ send: true, order });
    });
});

describe('текст сигналу', () => {
    it('називає номер замовлення, шлях і те, де шукати причину', () => {
        const text = formatFallbackAlert({
            order_number: 'TM-001331',
            created_at: '2026-09-17T09:00:00.000Z',
            custom_attributes: { price_declared: 1728 },
        });
        expect(text).toContain('TM-001331');
        expect(text).toContain('order_path = client');
        expect(text).toContain('/api/orders/magazine-text-brief');
        expect(text).toContain('1728');
        expect(text).toContain(FALLBACK_ALERT_KEY);
    });

    it('замовлення без номера не ламає текст', () => {
        const text = formatFallbackAlert({ order_number: null, created_at: null });
        expect(text).toContain('без номера');
        expect(text).not.toContain('undefined');
    });
});

/**
 * Підробка Supabase: запамʼятовує, за якими ключами ходили і що записали.
 */
function fakeSupabase(opts: {
    flag?: { value: unknown; updated_at: string } | null;
    alerted?: unknown;
    orders?: any[];
}) {
    const upserts: any[] = [];
    const filters: Record<string, string> = {};
    let ordersGt: string | null = null;
    const client: any = {
        from(table: string) {
            if (table === 'settings') {
                return {
                    select: () => ({
                        eq: (_c: string, key: string) => ({
                            maybeSingle: async () => ({
                                data: key === 'server_order_magazine_brief_enabled'
                                    ? (opts.flag ?? null)
                                    : (opts.alerted !== undefined ? { value: opts.alerted } : null),
                            }),
                        }),
                    }),
                    upsert: async (row: any) => { upserts.push(row); return { error: null }; },
                };
            }
            const q: any = {
                select: () => q,
                eq: (col: string, value: string) => { filters[col] = value; return q; },
                gt: (_col: string, value: string) => { ordersGt = value; return q; },
                order: () => q,
                limit: async () => ({ data: opts.orders ?? [] }),
            };
            return q;
        },
    };
    return { client, upserts, filters, get ordersGt() { return ordersGt; } };
}

describe('прохід сторожа', () => {
    const order = { order_number: 'TM-001331', created_at: '2026-09-17T09:00:00.000Z', custom_attributes: {} };

    it('надсилає один раз і запамʼятовує це в settings', async () => {
        const fake = fakeSupabase({ flag: { value: true, updated_at: '2026-09-16T13:57:20Z' }, orders: [order] });
        const sentTexts: string[] = [];
        const result = await checkMagazineBriefFallback(fake.client, {
            send: async (t) => { sentTexts.push(t); return true; },
        });
        expect(result.sent).toBe(true);
        expect(sentTexts).toHaveLength(1);
        expect(fake.upserts[0].key).toBe(FALLBACK_ALERT_KEY);
        expect(fake.upserts[0].value.order_number).toBe('TM-001331');
    });

    /**
     * Замовлення старим шляхом ДО вмикання вимикача — це не поломка, а
     * історія. Межа береться з часу перемикання самого вимикача.
     */
    it('шукає замовлення тільки після останнього перемикання вимикача', async () => {
        const fake = fakeSupabase({ flag: { value: true, updated_at: '2026-09-16T13:57:20Z' }, orders: [] });
        await checkMagazineBriefFallback(fake.client, { send: async () => true });
        expect(fake.ordersGt).toBe('2026-09-16T13:57:20Z');
        expect(fake.filters['custom_attributes->>order_flow']).toBe('magazine-text-brief');
        expect(fake.filters['custom_attributes->>order_path']).toBe('client');
    });

    it('невдале надсилання не зараховується — наступний прохід спробує знову', async () => {
        const fake = fakeSupabase({ flag: { value: true, updated_at: '2026-09-16T13:57:20Z' }, orders: [order] });
        const result = await checkMagazineBriefFallback(fake.client, { send: async () => false });
        expect(result.sent).toBe(false);
        expect(fake.upserts).toHaveLength(0);
    });

    it('перегляд нічого не надсилає і нічого не запамʼятовує', async () => {
        const fake = fakeSupabase({ flag: { value: true, updated_at: '2026-09-16T13:57:20Z' }, orders: [order] });
        let sends = 0;
        const result = await checkMagazineBriefFallback(fake.client, { preview: true, send: async () => { sends++; return true; } });
        expect(sends).toBe(0);
        expect(fake.upserts).toHaveLength(0);
        expect(result.message).toContain('TM-001331');
    });

    it('вимкнений вимикач — замовлення навіть не шукаються', async () => {
        const fake = fakeSupabase({ flag: { value: false, updated_at: '2026-09-16T13:57:20Z' }, orders: [order] });
        const result = await checkMagazineBriefFallback(fake.client, { send: async () => true });
        expect(result.sent).toBe(false);
        expect((result.decision as any).reason).toBe('flag_off');
        expect(fake.ordersGt).toBeNull();
    });
});
