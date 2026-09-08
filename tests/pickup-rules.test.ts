import { describe, expect, it } from 'vitest';
import {
    blocksPickup, isGlossyMagazine, isUrgentItem, pickupAllowed,
} from '@/lib/orders/pickup-rules';

/**
 * Правило: терміновий глянцевий журнал самовивозом не віддається.
 *
 * Межа має тримати обидва боки. Пропустити терміновий журнал у самовивіз —
 * це термінова робота, що лежить на полиці. Заблокувати самовивіз там, де він
 * дозволений, — це клієнт, у якого без причини забрали найдешевший спосіб
 * отримати замовлення.
 */
describe('isGlossyMagazine', () => {
    it('recognises the product by its article', () => {
        expect(isGlossyMagazine({ slug: 'personalized-glossy-magazine' })).toBe(true);
        expect(isGlossyMagazine({ product_slug: 'personalized-glossy-magazine' })).toBe(true);
    });

    /** У базі є позиції взагалі без артикула — лишається назва. */
    it('recognises it by name when the article is missing', () => {
        expect(isGlossyMagazine({ slug: '', product_name: 'Глянцевий журнал про людину' })).toBe(true);
        expect(isGlossyMagazine({ slug: '3456768', product_name: 'Глянцевий журнал 12 ст' })).toBe(true);
    });

    it('does not mistake other products for it', () => {
        expect(isGlossyMagazine({ slug: 'photobook-printed', product_name: 'Фотокнига' })).toBe(false);
        expect(isGlossyMagazine({ slug: 'travelbook-20x30', product_name: 'Travel Book' })).toBe(false);
    });
});

describe('isUrgentItem', () => {
    /** Три різні написання, усі реально зустрічаються в замовленнях. */
    it('reads every spelling of urgency that exists in the data', () => {
        expect(isUrgentItem({ options: { 'Терміновість': 'urgent' } })).toBe(true);
        expect(isUrgentItem({ options: { 'Терміновість': 'Термінова 1–3 дні (+30%)' } })).toBe(true);
        expect(isUrgentItem({ options: { 'Терміновість': 'Термінове виготовлення (+30%)' } })).toBe(true);
    });

    it('does not call the standard option urgent', () => {
        expect(isUrgentItem({ options: { 'Терміновість': 'standard' } })).toBe(false);
        expect(isUrgentItem({ options: { 'Терміновість': 'Стандартна (5–8 днів)' } })).toBe(false);
    });

    it('is false when there is no urgency option at all', () => {
        expect(isUrgentItem({ options: { 'Розмір': '20x30' } })).toBe(false);
        expect(isUrgentItem({})).toBe(false);
    });
});

describe('pickupAllowed', () => {
    const urgentMagazine = { slug: 'personalized-glossy-magazine', options: { 'Терміновість': 'urgent' } };
    const calmMagazine = { slug: 'personalized-glossy-magazine', options: { 'Терміновість': 'standard' } };
    const photobook = { slug: 'photobook-printed', options: { 'Терміновість': 'urgent' } };

    it('blocks the cart that holds an urgent glossy magazine', () => {
        expect(blocksPickup(urgentMagazine)).toBe(true);
        expect(pickupAllowed([urgentMagazine])).toBe(false);
    });

    it('allows a glossy magazine without rush', () => {
        expect(pickupAllowed([calmMagazine])).toBe(true);
    });

    /** Терміновість сама по собі нічого не блокує — правило лише про журнал. */
    it('allows an urgent photobook', () => {
        expect(pickupAllowed([photobook])).toBe(true);
    });

    it('blocks the whole cart on one offending line, because it ships as one parcel', () => {
        expect(pickupAllowed([photobook, calmMagazine, urgentMagazine])).toBe(false);
    });

    it('allows an empty or unknown cart rather than blocking blindly', () => {
        expect(pickupAllowed([])).toBe(true);
        expect(pickupAllowed(null)).toBe(true);
        expect(pickupAllowed(undefined)).toBe(true);
    });
});
