import { describe, expect, it } from 'vitest';
import { priceConfiguredBook, isConfiguredBookItem } from '@/lib/pricing/configured-book-price';
import type { PriceTable } from '@/lib/editor/pricing';

/**
 * Server-side price recomputation for configured photobook lines.
 *
 * Every expectation below is a literal taken from the live `photobook_prices`
 * rows and from real orders in Supabase on 2026-08-31 — a test that derives
 * its expectation from the code under test proves nothing. The three
 * "real order" cases are actual historical orders, and their totals are what
 * the customer was actually charged. If one of these fails, either a price
 * genuinely changed (say so in the commit and update the literals) or the
 * parsing drifted.
 *
 * The false-positive cases matter more than the exploit case: rejecting a
 * real order is worse than the hole this closes, so anything the module
 * cannot identify with confidence must return null and let the old
 * base-price floor stand.
 */

/** Real rows from photobook_prices (cover × size × pages). */
const TABLE: PriceTable = {
    fetched_at: '2026-08-31T00:00:00.000Z',
    rows: [
        { cover_type: 'Друкована', size: '20×30', page_count: 20, base_price: 1265, kalka_surcharge: 300 },
        { cover_type: 'Друкована', size: '20×30', page_count: 50, base_price: 2390, kalka_surcharge: 300 },
        { cover_type: 'Друкована', size: '30×20', page_count: 18, base_price: 1170, kalka_surcharge: 300 },
        { cover_type: 'Велюр', size: '20×30', page_count: 10, base_price: 1985, kalka_surcharge: 300 },
        { cover_type: 'Тканина', size: '20×20', page_count: 6, base_price: 1100, kalka_surcharge: 300 },
    ],
};

/** The Велюр 30×20 / 32pp row a wishbook's geometry collides with. */
const WISHBOOK_COLLISION_TABLE: PriceTable = {
    fetched_at: '2026-08-31T00:00:00.000Z',
    rows: [{ cover_type: 'Велюр', size: '30×20', page_count: 32, base_price: 2540, kalka_surcharge: 300 }],
};

const opts = (o: Record<string, string>) => o;

describe('isConfiguredBookItem', () => {
    it('recognises a line by its size option', () => {
        expect(isConfiguredBookItem(opts({ 'Розмір книги': '20×30' }))).toBe(true);
    });

    it('ignores lines that carry no book configuration', () => {
        expect(isConfiguredBookItem(opts({ 'Формат': '10×15' }))).toBe(false);
        expect(isConfiguredBookItem(undefined)).toBe(false);
        expect(isConfiguredBookItem(null)).toBe(false);
    });
});

describe('priceConfiguredBook — real historical orders', () => {
    it('54 pages rounds to the nearest tier (50) and adds kalka → 2690 ₴', () => {
        const r = priceConfiguredBook(TABLE, opts({
            'Розмір книги': '20×30',
            'Обкладинка': 'Друкована',
            'Сторінок': '54 сторінок',
            'Калька перед першою сторінкою': 'З калькою',
        }));
        expect(r?.unitPrice).toBe(2690);   // 2390 + 300, order charged 2690
        expect(r?.pageCount).toBe(50);
    });

    it('landscape 30×20 is priced on its own row, not the portrait one → 1470 ₴', () => {
        const r = priceConfiguredBook(TABLE, opts({
            'Розмір книги': '30×20',
            'Обкладинка': 'Друкована',
            'Сторінок': '18 сторінок',
            'Калька перед першою сторінкою': 'З калькою',
        }));
        expect(r?.unitPrice).toBe(1470);   // 1170 + 300, order charged 1470
    });

    it('no kalka option means no surcharge → 1265 ₴', () => {
        const r = priceConfiguredBook(TABLE, opts({
            'Розмір книги': '20×30',
            'Обкладинка': 'Друкована',
            'Сторінок': '20 сторінок',
        }));
        expect(r?.unitPrice).toBe(1265);   // order charged 1265
        expect(r?.kalka).toBe(false);
    });
});

describe('priceConfiguredBook — the hole this closes', () => {
    it('prices a configured book far above its products.price row', () => {
        // photobook-printed has products.price = 600 ₴. The old floor accepted
        // a claimed total of 600 for this configuration.
        const r = priceConfiguredBook(TABLE, opts({
            'Розмір книги': '20×30',
            'Обкладинка': 'Друкована',
            'Сторінок': '50 сторінок',
            'Калька перед першою сторінкою': 'З калькою',
        }));
        expect(r!.unitPrice).toBe(2690);
        expect(r!.unitPrice).toBeGreaterThan(600 * 4);
    });

    it('does not let an unknown cover label buy a velour book at printed prices', () => {
        // canonicalCoverType() defaults unknown labels to 'Друкована' for
        // display. The price CHECK must not inherit that default.
        const r = priceConfiguredBook(TABLE, opts({
            'Розмір книги': '20×30',
            'Обкладинка': 'ЩосьІнше',
            'Сторінок': '10 сторінок',
        }));
        expect(r).toBeNull();
    });

    it('prices velour on the velour row', () => {
        const r = priceConfiguredBook(TABLE, opts({
            'Розмір книги': '20×30',
            'Обкладинка': 'Велюр',
            'Сторінок': '10 сторінок',
        }));
        expect(r?.unitPrice).toBe(1985);
        expect(r?.cover).toBe('Велюр');
    });
});

describe('why the caller must gate on the photobooks category', () => {
    /**
     * `Розмір книги` is not unique to photobooks. A wishbook carries the same
     * option label but is priced from products.price plus its decorations, and
     * its 23×23 size does not exist in this matrix at all. For the geometries
     * that DO overlap the matrix answers with a photobook price, which is far
     * higher — order TM-001242 (wishbook, 30×20, 32pp) was legitimately
     * charged 1 209 ₴ while the matrix says 2 540 ₴.
     *
     * So this module prices anything shaped like a book, and
     * `/api/orders/submit` decides WHICH lines to trust it for by checking the
     * product's category. If that gate is ever removed, real wishbook orders
     * start getting rejected — this test is the note explaining why.
     */
    it('prices a wishbook geometry as if it were a photobook (hence the gate)', () => {
        const r = priceConfiguredBook(WISHBOOK_COLLISION_TABLE, opts({
            'Розмір книги': '30×20',
            'Обкладинка': 'Велюр',
            'Сторінок': '32 сторінки',
        }));
        expect(r?.unitPrice).toBe(2540);   // …vs the 1209 ₴ actually charged
    });

    it('cannot price a size that is not in the matrix (23×23 wishbooks)', () => {
        const r = priceConfiguredBook(TABLE, opts({
            'Розмір книги': '23×23',
            'Обкладинка': 'Друкована',
            'Сторінок': '32 сторінки',
        }));
        expect(r).toBeNull();
    });
});

describe('priceConfiguredBook — declines rather than guesses', () => {
    it('returns null when the price table is unavailable', () => {
        expect(priceConfiguredBook(null, opts({ 'Розмір книги': '20×30' }))).toBeNull();
        expect(priceConfiguredBook({ rows: [], fetched_at: '' }, opts({ 'Розмір книги': '20×30' }))).toBeNull();
    });

    it('returns null for a size with no rows at all', () => {
        const r = priceConfiguredBook(TABLE, opts({
            'Розмір книги': '99×99',
            'Обкладинка': 'Друкована',
            'Сторінок': '20 сторінок',
        }));
        expect(r).toBeNull();
    });

    it('returns null when the page count is missing or unparseable', () => {
        const base = { 'Розмір книги': '20×30', 'Обкладинка': 'Друкована' };
        expect(priceConfiguredBook(TABLE, opts({ ...base }))).toBeNull();
        expect(priceConfiguredBook(TABLE, opts({ ...base, 'Сторінок': 'багато' }))).toBeNull();
    });

    it('accepts the ASCII "x" spelling of a size', () => {
        const r = priceConfiguredBook(TABLE, opts({
            'Розмір книги': '20x30',
            'Обкладинка': 'Друкована',
            'Сторінок': '20 сторінок',
        }));
        expect(r?.unitPrice).toBe(1265);
    });

    it('reads a non-Ukrainian cover label (other locales price the same book)', () => {
        const r = priceConfiguredBook(TABLE, opts({
            'Розмір книги': '20×30',
            'Обкладинка': 'Velour',
            'Сторінок': '10 сторінок',
        }));
        expect(r?.unitPrice).toBe(1985);
    });
});
