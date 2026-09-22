import { describe, expect, it } from 'vitest';
import { isUrgentOption } from '@/lib/products';
import { withProductionTime } from '@/components/ui/ProductOptionsSelector';

/**
 * The «Стандартна (…)» lead time is derived from products.production_time.
 *
 * Why this file exists. The product card used to invent its own lead time: a
 * hardcoded «Стандартна (5–8 днів)» in PRODUCT_OPTIONS won over the DB, so the
 * Travel Book promised 5–8 days on the page while products.production_time —
 * the value the delivery line, the country-landing FAQ and the deadline
 * automation all read — said 8–10. Deriving the label fixes that, but it puts
 * a generated string into the option the rush surcharge is decided from, and
 * THAT is the part that can cost money.
 *
 * isUrgentOption() treats anything it does not recognise as urgent (+30%), and
 * it recognises the standard case by the word «стандартна», never by the
 * digits. So the one property that must hold for every production_time Diana
 * can type into the admin panel is: the derived label still reads as NOT
 * urgent. Everything else here is shape.
 */

const urgency = (values: (string | number)[]) => ({
    name: 'Терміновість',
    values,
    required: false,
});
const STANDARD = 'Стандартна (5–8 днів)';
const RUSH = 'Термінова до 5 робочих днів (+30%)';

const labelOf = (opts: any[]) =>
    String(opts.find((o) => o.name === 'Терміновість').values[0]);

describe('«Стандартна (…)» береться з products.production_time', () => {
    it.each([
        ['8–10 робочих днів', 'Стандартна (8–10 днів)'],
        ['7–10 робочих днів', 'Стандартна (7–10 днів)'],
        ['5–8 робочих днів', 'Стандартна (5–8 днів)'],
        ['до 3 робочих днів', 'Стандартна (до 3 днів)'],
        ['10 робочих днів', 'Стандартна (10 днів)'],
        // Hyphen instead of en dash — both spellings exist in the DB.
        ['7-10 робочих днів', 'Стандартна (7-10 днів)'],
    ])('«%s» → «%s»', (productionTime, expected) => {
        const out = withProductionTime([urgency([STANDARD, RUSH])], productionTime);
        expect(labelOf(out)).toBe(expected);
    });

    it('НІКОЛИ не читається як терміново — інакше це +30% на рівному місці', () => {
        for (const pt of ['8–10 робочих днів', 'до 3 робочих днів', '1–3 дні', '14 днів', '10 робочих днів']) {
            const out = withProductionTime([urgency([STANDARD, RUSH])], pt);
            expect(isUrgentOption(labelOf(out))).toBe(false);
        }
    });

    it('термінову опцію не чіпає: це окрема обіцянка зі своєю надбавкою', () => {
        const out = withProductionTime([urgency([STANDARD, RUSH])], '8–10 робочих днів');
        const values = out.find((o) => o.name === 'Терміновість')!.values;
        expect(values[1]).toBe(RUSH);
        expect(isUrgentOption(String(values[1]))).toBe(true);
    });
});

describe('коли виводити нічого — лишає список як є', () => {
    it.each([undefined, null, '', '   ', 'за домовленістю'])('«%s» нічого не змінює', (pt) => {
        const input = [urgency([STANDARD, RUSH])];
        expect(labelOf(withProductionTime(input, pt as any))).toBe(STANDARD);
    });

    it('товар без опції терміновості проходить недоторканим', () => {
        const input = [{ name: 'Розмір', values: ['A4'], required: false }];
        expect(withProductionTime(input, '8–10 робочих днів')).toBe(input);
    });
});
