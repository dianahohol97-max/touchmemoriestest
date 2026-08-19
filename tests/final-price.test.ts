import { describe, expect, it } from 'vitest';
import { computeFinalPrice, INSCRIPTION_ON_KEY } from '@/lib/pricing/final-price';
import { getCalculatedPrice } from '@/components/ui/ProductOptionsSelector';
import { INSCRIPTION_KEYS } from '@/components/ui/InscriptionDesigner';
import { calcTravelBookTotal } from '@/lib/products';

/**
 * Підсумкова ціна на сторінці товару.
 *
 * Це тести на composeFinalPrice — чисту функцію, у яку переїхала арифметика
 * зі сторінки товару (ProductClient). Раніше вона жила всередині React-
 * компонента, її неможливо було викликати з тесту, і саме там сталися всі
 * історичні цінові баги. Кожне очікуване число нижче виведене з прайсу
 * Діани або взяте з реального інциденту, НЕ з коду, який перевіряється.
 *
 * Товари описані так, як їх реально зберігає Supabase: options це масив
 * груп, значення приходять рядками, надбавка за сторінки відрахована від
 * найдешевшого тарифу.
 */

/** Глянцевий журнал — рядок products, як у базі. */
const GLOSSY_MAGAZINE = {
    slug: 'personalized-glossy-magazine',
    price: 525,
    options: [
        {
            name: 'Кількість сторінок', type: 'select', required: true,
            options: [
                { label: '8 сторінок', price: 0, value: '8' },
                { label: '12 сторінок', price: 50, value: '12' },
                { label: '24 сторінки', price: 500, value: '24' },
            ],
        },
        {
            name: 'Верстка тексту', type: 'select',
            options: [
                { label: 'Без тексту (тільки фото)', price: 0, value: 'none' },
                { label: 'Власний текст (+195 ₴)', price: 195, value: 'own' },
                { label: 'Ми пишемо (від 195 ₴)', price: 195, value: 'we' },
            ],
        },
        {
            name: 'Терміновість', type: 'select',
            options: [
                { label: 'Стандартна (5–8 днів)', price: 0, value: 'standard', surcharge_pct: 0 },
                { label: 'Термінова 1–3 дні (+30%)', price: 0, value: 'urgent', surcharge_pct: 30 },
            ],
        },
    ],
};

/** Журнал з твердою обкладинкою — рядок products, як у базі після фіксів. */
const HARD_JOURNAL = {
    slug: 'fotozhurnal-tverd-obkladynka',
    price: 675,
    options: [
        {
            name: 'Кількість сторінок', type: 'select', required: true,
            options: [
                { label: '12 сторінок', price: 0, value: '12' },
                { label: '14 сторінок', price: 75, value: '14' },
                { label: '16 сторінок', price: 150, value: '16' },
            ],
        },
        {
            name: 'Верстка тексту', type: 'select',
            options: [
                { label: 'Без тексту (тільки фото)', price: 0, value: 'none' },
                { label: 'Власний текст (+195 ₴)', price: 195, value: 'own' },
            ],
        },
        {
            name: 'Ламінація обкладинки', type: 'select',
            options: [
                { label: 'Глянцева', price: 0, value: 'glossy' },
                { label: 'Матова', price: 0, value: 'matte' },
            ],
        },
        {
            name: 'Ламінація сторінок', type: 'select',
            options: [
                { label: 'Без ламінації', price: 0, value: 'none' },
                { label: 'З ламінацією (+7 ₴/стор)', price: 0, value: 'with', per_page: 7 },
            ],
        },
        {
            name: 'Терміновість', type: 'select',
            options: [
                { label: 'Стандартна (5–8 днів)', price: 0, value: 'standard', surcharge_pct: 0 },
                { label: 'Термінова до 5 робочих днів (+30%)', price: 0, value: 'urgent', surcharge_pct: 30 },
            ],
        },
    ],
};

const price = (args: Parameters<typeof computeFinalPrice>[0]) => computeFinalPrice(args).finalPrice;

describe('глянцевий журнал', () => {
    it('вісім сторінок без опцій це 525 ₴', () => {
        expect(price({
            product: GLOSSY_MAGAZINE,
            selectedOptions: { 'Кількість сторінок': '8', 'Верстка тексту': 'none', 'Терміновість': 'standard' },
            dynamicPrice: 525,
        })).toBe(525);
    });

    it('верстка додає плоскі 195 ₴ і видна окремим рядком розбивки', () => {
        const { finalPrice, breakdown } = computeFinalPrice({
            product: GLOSSY_MAGAZINE,
            selectedOptions: { 'Кількість сторінок': '8', 'Верстка тексту': 'own', 'Терміновість': 'standard' },
            dynamicPrice: 525,
        });
        expect(finalPrice).toBe(720);
        expect(breakdown).toEqual([
            { label: 'Базова вартість', amount: 525 },
            { label: 'Верстка тексту: Власний текст (+195 ₴)', amount: 195 },
        ]);
    });

    // Історичне число: терміновий журнал із власним текстом коштує 878 ₴.
    // Помилковий порядок дій давав 936 — множник накривав і верстку теж.
    it('терміновість множить базу, а верстка лягає зверху: 878, а не 936', () => {
        expect(price({
            product: GLOSSY_MAGAZINE,
            selectedOptions: { 'Кількість сторінок': '8', 'Верстка тексту': 'own', 'Терміновість': 'urgent' },
            dynamicPrice: 525,
        })).toBe(878);
    });

    it('терміновість без верстки: 525 × 1.3 = 683', () => {
        expect(price({
            product: GLOSSY_MAGAZINE,
            selectedOptions: { 'Кількість сторінок': '8', 'Верстка тексту': 'none', 'Терміновість': 'urgent' },
            dynamicPrice: 525,
        })).toBe(683);
    });

    // TM-001043: коли шкала ще не порахована (перший рендер), надбавка за
    // сторінки живе прямо в опції бази і МУСИТЬ додатись до products.price.
    // Безумовне виключення «Кількості сторінок» колись з'їло рівно 50 ₴.
    it('без dynamicPrice надбавка за сторінки береться з опції: 525 + 50 = 575', () => {
        expect(price({
            product: GLOSSY_MAGAZINE,
            selectedOptions: { 'Кількість сторінок': '12', 'Верстка тексту': 'none', 'Терміновість': 'standard' },
            dynamicPrice: null,
        })).toBe(575);
    });

    it('а коли dynamicPrice є, та сама надбавка НЕ додається вдруге', () => {
        expect(price({
            product: GLOSSY_MAGAZINE,
            selectedOptions: { 'Кількість сторінок': '12', 'Верстка тексту': 'none', 'Терміновість': 'standard' },
            dynamicPrice: 575,
        })).toBe(575);
    });
});

describe('журнал з твердою обкладинкою', () => {
    it('дванадцять сторінок це 675 ₴ — регресія TM-001202', () => {
        expect(price({
            product: HARD_JOURNAL,
            selectedOptions: { 'Кількість сторінок': '12', 'Верстка тексту': 'none', 'Терміновість': 'standard', 'Ламінація сторінок': 'none', 'Ламінація обкладинки': 'glossy' },
            dynamicPrice: 675,
        })).toBe(675);
    });

    it('ламінація сторінок — 7 ₴ за сторінку, плоско: 675 + 84 = 759', () => {
        const { finalPrice, breakdown } = computeFinalPrice({
            product: HARD_JOURNAL,
            selectedOptions: { 'Кількість сторінок': '12', 'Верстка тексту': 'none', 'Терміновість': 'standard', 'Ламінація сторінок': 'with', 'Ламінація обкладинки': 'glossy' },
            dynamicPrice: 675,
        });
        expect(finalPrice).toBe(759);
        expect(breakdown).toContainEqual({ label: 'Ламінування сторінок (7 ₴ × 12)', amount: 84 });
    });

    // Стара помилка: (975 + 195) × 1.3 + 195 = 1716 замість 975 × 1.3 + 195.
    // Тут та сама форма на 12 сторінках: 675 × 1.3 = 878, потім + 195 + 84.
    it('повна комбінація: терміново + власний текст + ламінація = 1157', () => {
        expect(price({
            product: HARD_JOURNAL,
            selectedOptions: { 'Кількість сторінок': '12', 'Верстка тексту': 'own', 'Терміновість': 'urgent', 'Ламінація сторінок': 'with', 'Ламінація обкладинки': 'matte' },
            dynamicPrice: 675,
        })).toBe(878 + 195 + 84);
    });

    it('ламінація обкладинки безкоштовна і не міняє суму', () => {
        const glossy = price({
            product: HARD_JOURNAL,
            selectedOptions: { 'Кількість сторінок': '12', 'Верстка тексту': 'none', 'Терміновість': 'standard', 'Ламінація сторінок': 'none', 'Ламінація обкладинки': 'glossy' },
            dynamicPrice: 675,
        });
        const matte = price({
            product: HARD_JOURNAL,
            selectedOptions: { 'Кількість сторінок': '12', 'Верстка тексту': 'none', 'Терміновість': 'standard', 'Ламінація сторінок': 'none', 'Ламінація обкладинки': 'matte' },
            dynamicPrice: 675,
        });
        expect(glossy).toBe(matte);
    });
});

describe('Travel Book', () => {
    const TRAVELBOOK = {
        slug: 'travelbook-20x30',
        price: 675,
        options: [
            {
                name: 'Кількість сторінок', type: 'select',
                options: [{ label: '12 сторінок', price: 0, value: '12' }],
            },
            {
                name: 'Ламінація сторінок', type: 'select',
                options: [
                    { label: 'Без ламінації', price: 0, value: 'none' },
                    { label: 'З ламінацією (+7 ₴/стор)', price: 0, value: 'with', per_page: 7 },
                ],
            },
            {
                name: 'Терміновість', type: 'select',
                options: [
                    { label: 'Стандартна (5–8 днів)', price: 0, value: 'standard', surcharge_pct: 0 },
                    { label: 'Термінова до 5 робочих днів (+30%)', price: 0, value: 'urgent', surcharge_pct: 30 },
                ],
            },
        ],
    };

    // Регресія «від 1283 ₴»: calcTravelBookTotal уже застосував множник, і
    // загальний цикл терміновості НЕ сміє накрити його вдруге.
    it('терміновість не множиться двічі: 962, а не 1251', () => {
        const opts = { 'Кількість сторінок': 12, 'Терміновість': 'Термінова до 5 робочих днів (+30%)', 'Ламінація сторінок': 'З ламінацією (+7 ₴/стор)' };
        const dyn = calcTravelBookTotal(opts as Record<string, unknown>);
        expect(dyn).toBe(962);
        expect(price({
            product: TRAVELBOOK,
            selectedOptions: opts as any,
            dynamicPrice: dyn,
        })).toBe(962);
    });
});

describe('фотокнига — ціна з таблиці photobook_prices', () => {
    const PHOTOBOOK = {
        slug: 'photobook-printed',
        price: 600,
        options: [
            {
                name: 'Калька перед першою сторінкою', type: 'select',
                options: [
                    { label: 'Без кальки', price: 0, value: 'without' },
                    { label: 'З калькою', price: 0, value: 'with' },
                ],
            },
        ],
    };
    const TABLE = [
        { cover_type: { name: 'Друкована' }, size: { name: '20×30' }, page_count: 20, base_price: 1020, kalka_surcharge: 300 },
        { cover_type: { name: 'Друкована' }, size: { name: '20×30' }, page_count: 22, base_price: 1080, kalka_surcharge: 300 },
    ];

    it('розмір і сторінки знаходять рядок таблиці, а не products.price', () => {
        expect(price({
            product: PHOTOBOOK,
            selectedOptions: { 'Розмір': '20х30 см', 'Кількість сторінок': '20 сторінок' },
            dynamicPrice: null,
            photobookPrices: TABLE,
        })).toBe(1020);
    });

    it('калька додає надбавку з того самого рядка', () => {
        expect(price({
            product: PHOTOBOOK,
            selectedOptions: { 'Розмір': '20х30 см', 'Кількість сторінок': '20 сторінок', 'Калька перед першою сторінкою': 'with' },
            dynamicPrice: null,
            photobookPrices: TABLE,
        })).toBe(1320);
    });

    it('коли таблиця дала рядок, dynamicPrice не втручається', () => {
        expect(price({
            product: PHOTOBOOK,
            selectedOptions: { 'Розмір': '20х30 см', 'Кількість сторінок': '22 сторінки' },
            dynamicPrice: 999,
            photobookPrices: TABLE,
        })).toBe(1080);
    });
});

describe('фотодрук і полароїди — розмір і є ціною', () => {
    const POLAROID = {
        slug: 'polaroid-classic',
        price: 7.5,
        options: [
            {
                name: 'Розмір', type: 'select',
                options: [
                    { label: '9×9', price: 8, value: '9x9' },
                    { label: '10×10', price: 10, value: '10x10' },
                ],
            },
        ],
    };

    // Регресія 15.5 ₴: базу 7.5 додавали до повної ціни розміру 8 ₴.
    // Повна ціна більша за базу — отже вона заміняє базу, а не додається.
    it('повна ціна розміру заміняє базу: 8 ₴, а не 15.5 ₴', () => {
        expect(price({
            product: POLAROID,
            selectedOptions: { 'Розмір': '9x9' },
            dynamicPrice: null,
            getCalculatedPrice: () => null,
        })).toBe(8);
    });

    it('коли селектор уже порахував повну ціну, вона і є відповіддю', () => {
        expect(price({
            product: POLAROID,
            selectedOptions: { 'Розмір': '9x9' },
            dynamicPrice: 8,
        })).toBe(8);
    });

    it('фолбек через getCalculatedPrice, коли dynamicPrice ще не порахований', () => {
        expect(price({
            product: POLAROID,
            selectedOptions: { 'Розмір': '9x9' },
            dynamicPrice: null,
            getCalculatedPrice: (slug, opts) => (opts['Розмір'] === '9x9' ? 8 : null),
        })).toBe(8);
    });
});

describe('решта механізмів опцій', () => {
    it('напис додається лише коли він увімкнений', () => {
        const CARD = {
            slug: 'guestbook-wedding',
            price: 629,
            options: [{ name: 'Персоналізований напис', type: 'inscription', price: 180 }],
        };
        expect(price({ product: CARD, selectedOptions: { [INSCRIPTION_ON_KEY]: 'yes' }, dynamicPrice: null })).toBe(809);
        expect(price({ product: CARD, selectedOptions: {}, dynamicPrice: null })).toBe(629);
    });

    it('ключ вмикання напису збігається з тим, що пише InscriptionDesigner', () => {
        expect(INSCRIPTION_ON_KEY).toBe(INSCRIPTION_KEYS.on);
    });

    it('лічильник множить кількість на ціну штуки', () => {
        const PRINTS = {
            slug: 'poster-a2',
            price: 300,
            options: [{ name: 'Додаткові копії', type: 'counter', unit_price: 50, min: 0 }],
        };
        const { finalPrice, breakdown } = computeFinalPrice({
            product: PRINTS,
            selectedOptions: { 'Додаткові копії': 3 },
            dynamicPrice: null,
        });
        expect(finalPrice).toBe(450);
        expect(breakdown).toContainEqual({ label: 'Додаткові копії × 3', amount: 150 });
    });

    it('для товару без шкали розмір це модифікатор поверх бази', () => {
        const POSTER = {
            slug: 'poster-city-map',
            price: 450,
            options: [{
                name: 'Розмір', type: 'select',
                options: [
                    { label: 'A3', price: 0, value: 'a3' },
                    { label: 'A2', price: 150, value: 'a2' },
                ],
            }],
        };
        expect(price({ product: POSTER, selectedOptions: { 'Розмір': 'a2' }, dynamicPrice: null })).toBe(600);
    });

    it('товар без опцій просто показує свою базу', () => {
        expect(computeFinalPrice({
            product: { slug: 'simple-thing', price: 199, options: null },
            selectedOptions: {},
            dynamicPrice: null,
        })).toEqual({ finalPrice: 199, breakdown: [] });
    });
});

describe('живі дані замість макетів', () => {
    // Той самий розрахунок, але dynamicPrice взятий із реального селектора,
    // як його рахує сторінка. Зшиває цей файл із tests/pricing-scales.
    it('журнал 14 сторінок: селектор дає 750, функція не спотворює', () => {
        const dyn = getCalculatedPrice('fotozhurnal-tverd-obkladynka', { 'Кількість сторінок': '14' });
        expect(dyn).toBe(750);
        expect(price({
            product: HARD_JOURNAL,
            selectedOptions: { 'Кількість сторінок': '14', 'Верстка тексту': 'none', 'Терміновість': 'standard' },
            dynamicPrice: dyn,
        })).toBe(750);
    });
});
