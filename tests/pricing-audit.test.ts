import { describe, expect, it } from 'vitest';
import {
    auditPagePricing,
    describePricingAudit,
    isPricingClean,
    PAGE_PRICED_PRODUCTS,
    type PricingProductRow,
} from '@/lib/pricing/audit';
import { PHOTO_JOURNAL_SOFT, PHOTO_JOURNAL_HARD, TRAVEL_BOOK } from '@/lib/products';

/**
 * The drift check, checked.
 *
 * The audit is the thing that is supposed to notice a wrong price before a
 * customer does, so it needs its own tests more than most code here: an audit
 * that quietly reports «все чисто» is worse than no audit at all.
 *
 * Each fixture is a `products` row in the shape Supabase actually stores —
 * `price` as the cheapest tier plus a surcharge per page count.
 */

const cheapest = (scale: Record<number, number>) =>
    scale[Math.min(...Object.keys(scale).map(Number))];

/** Build the DB row that correctly reproduces `scale` from a given base. */
function row(slug: string, base: number, scale: Record<number, number>): PricingProductRow {
    const tiers = Object.keys(scale).map(Number).sort((a, b) => a - b);
    return {
        slug,
        name: slug,
        price: base,
        options: [{
            name: 'Кількість сторінок',
            type: 'select',
            options: tiers.map(pages => ({
                label: `${pages} сторінок`,
                value: String(pages),
                // Надбавка завжди відраховується від найдешевшого тарифу —
                // саме цей зв'язок і ламається, коли база лишається старою.
                price: scale[pages] - cheapest(scale),
            })),
        }],
    };
}

const CORRECT_ROWS = (): PricingProductRow[] => [
    row('personalized-glossy-magazine', cheapest(PHOTO_JOURNAL_SOFT.prices), PHOTO_JOURNAL_SOFT.prices),
    row('fotozhurnal-tverd-obkladynka', cheapest(PHOTO_JOURNAL_HARD.prices), PHOTO_JOURNAL_HARD.prices),
    row('travelbook-20x30', cheapest(TRAVEL_BOOK.prices), TRAVEL_BOOK.prices),
];

describe('коли база дорівнює найдешевшому тарифу', () => {
    it('розходжень нема жодного', () => {
        const report = auditPagePricing(CORRECT_ROWS());
        expect(report.drift).toEqual([]);
        expect(isPricingClean(report)).toBe(true);
        expect(describePricingAudit(report)).toEqual([]);
    });

    it('усі три посторінкові товари позначені перевіреними', () => {
        const report = auditPagePricing(CORRECT_ROWS());
        expect(report.cleanProducts.sort()).toEqual(PAGE_PRICED_PRODUCTS.map(p => p.slug).sort());
    });
});

describe('TM-001202 — база лишилась на щабель вище', () => {
    const rows = () => {
        const all = CORRECT_ROWS();
        // Рівно те, що було в базі: надбавки правильні, а колонка price
        // лишилась на ціні шістнадцяти сторінок.
        all[1] = { ...all[1], price: 825 };
        return all;
    };

    it('аудит бачить розходження і не мовчить', () => {
        const report = auditPagePricing(rows());
        expect(isPricingClean(report)).toBe(false);
        expect(report.drift.length).toBeGreaterThan(0);
    });

    it('промахуються всі тарифи товару, а не тільки дванадцять сторінок', () => {
        const report = auditPagePricing(rows());
        const journal = report.drift.filter(d => d.slug === 'fotozhurnal-tverd-obkladynka');
        expect(journal).toHaveLength(TRAVEL_BOOK.pagesAvailable.length);
        expect(journal.every(d => d.diff === 150)).toBe(true);
    });

    it('дванадцять сторінок названі поіменно: 825 замість 675', () => {
        const report = auditPagePricing(rows());
        const twelve = report.drift.find(d => d.slug === 'fotozhurnal-tverd-obkladynka' && d.pages === 12);
        expect(twelve).toMatchObject({ actual: 825, expected: 675, diff: 150 });
    });

    it('звіт каже, якою база має бути, а не просто перелічує симптоми', () => {
        const report = auditPagePricing(rows());
        expect(report.suggestedBase).toEqual([{
            slug: 'fotozhurnal-tverd-obkladynka',
            label: 'Фотожурнал з твердою обкладинкою',
            current: 825,
            shouldBe: 675,
        }]);
        expect(describePricingAudit(report)).toEqual([
            'Фотожурнал з твердою обкладинкою: базова ціна 825 ₴ замість 675 ₴ — кожна конфігурація йде на 150 ₴ мимо.',
        ]);
    });

    it('сусідні товари лишаються чистими і не тонуть у шумі', () => {
        const report = auditPagePricing(rows());
        expect(report.cleanProducts.sort()).toEqual(['personalized-glossy-magazine', 'travelbook-20x30']);
    });
});

describe('коли зсунуто не базу, а окрему надбавку', () => {
    it('названо саме той тариф, що поїхав', () => {
        const rows = CORRECT_ROWS();
        const opt: any = (rows[2].options as any[])[0];
        opt.options = opt.options.map((o: any) =>
            o.value === '24' ? { ...o, price: o.price + 40 } : o);

        const report = auditPagePricing(rows);
        expect(report.drift).toHaveLength(1);
        expect(report.drift[0]).toMatchObject({ slug: 'travelbook-20x30', pages: 24, diff: 40 });
        // Один зсунутий тариф це не зсунута база, тож підказки про базу нема.
        expect(report.suggestedBase).toEqual([]);
        expect(describePricingAudit(report)[0]).toContain('24 стор.');
    });

    it('найбільше розходження стоїть першим у звіті', () => {
        const rows = CORRECT_ROWS();
        const opt: any = (rows[2].options as any[])[0];
        opt.options = opt.options.map((o: any) => {
            if (o.value === '24') return { ...o, price: o.price + 40 };
            if (o.value === '30') return { ...o, price: o.price - 300 };
            return o;
        });

        const report = auditPagePricing(rows);
        expect(report.drift[0].pages).toBe(30);
        expect(report.drift[0].diff).toBe(-300);
    });
});

describe('дірки між прайсом і тим, що продається', () => {
    it('тариф є в прайсі, а на сайті його купити не можна', () => {
        const rows = CORRECT_ROWS();
        const opt: any = (rows[1].options as any[])[0];
        opt.options = opt.options.filter((o: any) => o.value !== '14' && o.value !== '18');

        const report = auditPagePricing(rows);
        expect(report.missingInDb).toEqual([{
            slug: 'fotozhurnal-tverd-obkladynka',
            label: 'Фотожурнал з твердою обкладинкою',
            pages: [14, 18],
        }]);
        expect(isPricingClean(report)).toBe(false);
    });

    it('на сайті продається кількість, якої в прайсі нема', () => {
        const rows = CORRECT_ROWS();
        const opt: any = (rows[1].options as any[])[0];
        opt.options = [...opt.options, { label: '90 сторінок', value: '90', price: 3000 }];

        const report = auditPagePricing(rows);
        expect(report.missingInScale[0].pages).toEqual([90]);
        // Ціни для неї нема з чим порівняти, тож у розходження вона не лізе.
        expect(report.drift).toEqual([]);
        expect(describePricingAudit(report)[0]).toContain('90');
    });

    it('зниклий товар помічається окремо від неправильної ціни', () => {
        const report = auditPagePricing(CORRECT_ROWS().slice(0, 2));
        expect(report.missingProducts).toEqual(['travelbook-20x30']);
        expect(isPricingClean(report)).toBe(false);
    });
});

describe('стійкість до кривих даних', () => {
    it('порожня вибірка не вдає, що все гаразд', () => {
        const report = auditPagePricing([]);
        expect(isPricingClean(report)).toBe(false);
        expect(report.missingProducts).toHaveLength(PAGE_PRICED_PRODUCTS.length);
    });

    it('товар без опцій читається як товар без тарифів, а не падає', () => {
        const rows = CORRECT_ROWS();
        rows[0] = { ...rows[0], options: null };
        expect(() => auditPagePricing(rows)).not.toThrow();
    });

    it('надбавка рядком рахується як число', () => {
        const rows = CORRECT_ROWS();
        const opt: any = (rows[1].options as any[])[0];
        opt.options = opt.options.map((o: any) => ({ ...o, price: String(o.price) }));
        expect(auditPagePricing(rows).drift).toEqual([]);
    });
});
