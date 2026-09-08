import { describe, expect, it } from 'vitest';
import { splitLineByBreakdown } from '@/lib/automation/keycrm-line-split';

/**
 * Розбиття позиції сайту на рядки CRM.
 *
 * Найважливіше тут не краса картки, а гроші: сума рядків у CRM мусить точно
 * збігатися з тим, що заплатив клієнт. Тому кожен випадок, де розбивка не
 * сходиться, має давати null — тобто «лишити одну позицію», а не приблизну
 * розкладку.
 */
const magazine = {
    product_name: 'Глянцевий журнал про людину',
    quantity: 1,
    unit_price: 1533,
    total_price: 1533,
    price_breakdown: [
        { label: 'Базова вартість (20 стор.)', amount: 875 },
        { label: 'Термінове виготовлення', amount: 263 },
        { label: 'Текст пише команда — Преміум пакет — 6 розділів + опція кастомної статті', amount: 395 },
    ],
};

describe('splitLineByBreakdown', () => {
    /** Саме замовлення зі скріншота: журнал, текст, терміновість. */
    it('splits the magazine into product, rush and text', () => {
        const lines = splitLineByBreakdown(magazine)!;
        expect(lines.map(l => l.kind)).toEqual(['base', 'rush', 'text']);
        expect(lines.map(l => l.name)).toEqual([
            'Глянцевий журнал про людину', 'Терміновість', 'Написання тексту',
        ]);
        expect(lines.map(l => l.amount)).toEqual([875, 263, 395]);
    });

    it('keeps the money exactly equal to what the customer paid', () => {
        const lines = splitLineByBreakdown(magazine)!;
        expect(lines.reduce((s, l) => s + l.amount, 0)).toBe(magazine.unit_price);
    });

    it('gives the services a stable article so CRM can count them', () => {
        const lines = splitLineByBreakdown(magazine)!;
        expect(lines.find(l => l.kind === 'rush')!.sku).toBe('service-urgent');
        expect(lines.find(l => l.kind === 'text')!.sku).toBe('service-text');
        // Базовий рядок лишається привʼязаним до справжнього товару.
        expect(lines.find(l => l.kind === 'base')!.sku).toBeNull();
    });

    it('keeps the original wording for the line comment', () => {
        const lines = splitLineByBreakdown(magazine)!;
        expect(lines.find(l => l.kind === 'rush')!.sourceLabel).toBe('Термінове виготовлення');
    });

    /** Головний запобіжник: розбивка, що не сходиться, не розбивається. */
    it('refuses to split when the rows do not add up to the price', () => {
        expect(splitLineByBreakdown({ ...magazine, unit_price: 1600 })).toBeNull();
    });

    it('refuses a discount row rather than sending a negative product', () => {
        expect(splitLineByBreakdown({
            product_name: 'Журнал', unit_price: 800,
            price_breakdown: [{ label: 'Базова вартість', amount: 900 }, { label: 'Знижка', amount: -100 }],
        })).toBeNull();
    });

    it('leaves a single-line product alone', () => {
        expect(splitLineByBreakdown({
            product_name: 'Журнал', unit_price: 875,
            price_breakdown: [{ label: 'Базова вартість', amount: 875 }],
        })).toBeNull();
    });

    it('leaves a product with no breakdown alone', () => {
        expect(splitLineByBreakdown({ product_name: 'Журнал', unit_price: 875 })).toBeNull();
        expect(splitLineByBreakdown({ product_name: 'Журнал', unit_price: 875, price_breakdown: [] })).toBeNull();
    });

    it('ignores zero rows instead of sending empty lines to the CRM', () => {
        const lines = splitLineByBreakdown({
            product_name: 'Журнал', unit_price: 1270,
            price_breakdown: [
                { label: 'Базова вартість (20 стор.)', amount: 875 },
                { label: 'Термінове виготовлення', amount: 0 },
                { label: 'Текст пише команда — Базовий', amount: 395 },
            ],
        })!;
        expect(lines.map(l => l.kind)).toEqual(['base', 'text']);
        expect(lines.reduce((s, l) => s + l.amount, 0)).toBe(1270);
    });

    it('names an unrecognised extra by its own label', () => {
        const lines = splitLineByBreakdown({
            product_name: 'Фотокнига', unit_price: 1000,
            price_breakdown: [
                { label: 'Базова вартість', amount: 900 },
                { label: 'Друк на форзацах', amount: 100 },
            ],
        })!;
        expect(lines[1]).toMatchObject({ kind: 'extra', name: 'Друк на форзацах', sku: null });
    });

    it('survives broken rows without guessing', () => {
        expect(splitLineByBreakdown({
            product_name: 'Журнал', unit_price: 875,
            price_breakdown: [{ label: 'Базова', amount: 875 }, { label: '', amount: 100 }],
        })).toBeNull();
        expect(splitLineByBreakdown({
            product_name: 'Журнал', unit_price: 875,
            price_breakdown: [{ label: 'Базова', amount: 875 }, { label: 'Щось', amount: NaN }],
        })).toBeNull();
    });
});
