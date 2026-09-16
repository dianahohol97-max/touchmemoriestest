import { describe, it, expect } from 'vitest';
import { pickReviewTargets, REVIEW_REQUEST_RULES } from '@/lib/email/review-request-targets';

const NOW = new Date('2026-09-16T12:00:00Z');
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86400000).toISOString();

const order = (over: Partial<any> = {}) => ({
    id: over.id || 'o1',
    customer_email: 'client@example.com',
    delivered_at: daysAgo(10),
    created_at: daysAgo(14),
    ...over,
});

const pick = (over: Partial<any> = {}) => pickReviewTargets({
    orders: over.orders ?? [order()],
    requestLog: over.requestLog ?? [],
    reviewedOrderIds: over.reviewedOrderIds ?? [],
    now: NOW,
});

describe('pickReviewTargets', () => {
    it('бере доставлене десять днів тому', () => {
        expect(pick().map(o => o.id)).toEqual(['o1']);
    });

    it('мовчить перші сім днів після доставки', () => {
        expect(pick({ orders: [order({ delivered_at: daysAgo(6) })] })).toEqual([]);
    });

    it('рівно сьомий день уже підходить', () => {
        expect(pick({ orders: [order({ delivered_at: daysAgo(7.1) })] })).toHaveLength(1);
    });

    it('пізніше за місяць уже не питає', () => {
        expect(pick({ orders: [order({ delivered_at: daysAgo(31), created_at: daysAgo(31) })] })).toEqual([]);
    });

    it('свіжа позначка на СТАРОМУ замовленні не рахується', () => {
        // Саме це сталося 15.09.2026: відстеження полагодили, і 256 замовлень
        // отримали delivered_at одного дня, серед них серпневі.
        expect(pick({ orders: [order({ delivered_at: daysAgo(8), created_at: daysAgo(45) })] })).toEqual([]);
    });

    it('замовлення без дати доставки пропускається', () => {
        expect(pick({ orders: [order({ delivered_at: null })] })).toEqual([]);
    });

    it('замовлення без пошти пропускається', () => {
        expect(pick({ orders: [order({ customer_email: '  ' })] })).toEqual([]);
    });

    it('не просить удруге по тому самому замовленню', () => {
        const log = [{ email: 'client@example.com', sent_at: daysAgo(90), meta: { order_id: 'o1' } }];
        expect(pick({ requestLog: log })).toEqual([]);
    });

    it('шістдесят днів охолодження на клієнта', () => {
        const log = [{ email: 'CLIENT@example.com', sent_at: daysAgo(30), meta: { order_id: 'інше' } }];
        expect(pick({ requestLog: log })).toEqual([]);
    });

    it('після шістдесяти днів можна знову', () => {
        const log = [{ email: 'client@example.com', sent_at: daysAgo(61), meta: { order_id: 'інше' } }];
        expect(pick({ requestLog: log })).toHaveLength(1);
    });

    it('не просить, коли відгук по замовленню вже є', () => {
        expect(pick({ reviewedOrderIds: ['o1'] })).toEqual([]);
    });

    it('одна людина — один лист за прогін', () => {
        const two = [order({ id: 'o1' }), order({ id: 'o2', delivered_at: daysAgo(9) })];
        expect(pick({ orders: two }).map(o => o.id)).toEqual(['o1']);
    });

    it('спершу найдавніша доставка', () => {
        const many = [
            order({ id: 'new', customer_email: 'a@b.com', delivered_at: daysAgo(8) }),
            order({ id: 'old', customer_email: 'c@d.com', delivered_at: daysAgo(20), created_at: daysAgo(25) }),
        ];
        expect(pick({ orders: many }).map(o => o.id)).toEqual(['old', 'new']);
    });

    it('партія обмежена, решта дочекається завтра', () => {
        const flood = Array.from({ length: REVIEW_REQUEST_RULES.batchLimit + 12 }, (_, i) =>
            order({ id: `o${i}`, customer_email: `c${i}@example.com` }));
        expect(pick({ orders: flood })).toHaveLength(REVIEW_REQUEST_RULES.batchLimit);
    });
});
