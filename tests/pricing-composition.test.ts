import { describe, expect, it } from 'vitest';
import {
    calcTravelBookTotal,
    isUrgentOption,
    isPageLaminationSelected,
    LAMINATION_PRICE_PER_PAGE,
    URGENT_MULTIPLIER,
} from '@/lib/products';
import { getCalculatedPrice, detectProductType, getWishbookPrice } from '@/components/ui/ProductOptionsSelector';

/**
 * How the pieces add up.
 *
 * The scale says what a book costs; this file says what happens when the
 * customer also picks rush, lamination, endpaper print and typesetting. Every
 * bug in this area came from the ORDER of those operations rather than from a
 * wrong tariff, so the order is what gets pinned here.
 *
 * The rule, stated once: терміновість множить базову ціну виробу, а плоскі
 * доплати лягають зверху вже після множення. Rush is a production surcharge on
 * making the book; typesetting, lamination and the endpaper print are separate
 * labour and material that a rushed order does not make more expensive.
 */

describe('Travel Book — повна сума за вибраними опціями', () => {
    it('без жодних доплат це просто ціна за кількість сторінок', () => {
        expect(calcTravelBookTotal({ 'Кількість сторінок': 12 })).toBe(675);
        expect(calcTravelBookTotal({ 'Кількість сторінок': 24 })).toBe(1125);
    });

    it('терміновість додає тридцять відсотків до базової ціни', () => {
        expect(URGENT_MULTIPLIER).toBe(0.3);
        expect(calcTravelBookTotal({ 'Кількість сторінок': 12, 'Терміновість': 'urgent' })).toBe(878);
    });

    it('ламінація коштує сім гривень за сторінку', () => {
        expect(LAMINATION_PRICE_PER_PAGE).toBe(7);
        expect(calcTravelBookTotal({
            'Кількість сторінок': 12,
            'Ламінація сторінок': 'З ламінацією (+7 ₴/стор)',
        })).toBe(675 + 84);
    });

    it('друк на форзаці додає сто гривень', () => {
        expect(calcTravelBookTotal({ 'Кількість сторінок': 12, 'Друк на форзаці': 'yes' })).toBe(775);
        expect(calcTravelBookTotal({ 'Кількість сторінок': 12, 'Друк на форзаці': 'none' })).toBe(675);
        expect(calcTravelBookTotal({ 'Кількість сторінок': 12, 'Друк на форзаці': 'Без друку' })).toBe(675);
    });

    // Картка колись показувала 987 ₴ там, де редактор рахував 962 ₴ за ту саму
    // книгу. Різниця виникала тому, що множник терміновості накривав і
    // ламінацію теж. Це число тримає порядок дій на місці.
    it('термінова книга з ламінацією коштує 962 ₴, а не 987 ₴', () => {
        expect(calcTravelBookTotal({
            'Кількість сторінок': 12,
            'Терміновість': 'Термінова до 5 робочих днів (+30%)',
            'Ламінація сторінок': 'З ламінацією (+7 ₴/стор)',
        })).toBe(962);
    });

    it('усе разом складається в одному порядку: множник, потім плоскі доплати', () => {
        // 24 ст: 1125 × 1.3 = 1463 (округлення), + 24 × 7 = 168, + 100 форзац.
        expect(calcTravelBookTotal({
            'Кількість сторінок': 24,
            'Терміновість': 'urgent',
            'Ламінація сторінок': 'with',
            'Друк на форзаці': 'yes',
        })).toBe(1463 + 168 + 100);
    });

    it('без кількості сторінок ціни нема, і це не нуль', () => {
        expect(calcTravelBookTotal({})).toBeNull();
        expect(calcTravelBookTotal({ 'Кількість сторінок': 0 })).toBeNull();
    });
});

describe('терміновість читається однаково з будь-якої форми', () => {
    it.each([
        'urgent',
        'Термінова 1–3 дні (+30%)',
        'Термінова до 5 робочих днів (+30%)',
    ])('«%s» це терміново', (value) => {
        expect(isUrgentOption(value)).toBe(true);
    });

    it.each([
        '', '0', 'none', 'standard', 'Стандартна (5–8 днів)', 'Стандартна (5-8 днів)',
    ])('«%s» це звичайний строк', (value) => {
        expect(isUrgentOption(value)).toBe(false);
    });

    it('порожнє значення ніколи не читається як терміново', () => {
        expect(isUrgentOption(undefined)).toBe(false);
        expect(isUrgentOption(null)).toBe(false);
    });
});

describe('ламінація сторінок читається і зі значення, і з підпису', () => {
    // Конструктор порівнював вибір із локалізованим підписом, тому машинне
    // 'none' ніколи не збігалось, і кожна неламінована книга отримувала +7 ₴
    // за сторінку за послугу, від якої клієнт відмовився.
    it.each(['none', 'no', '0', 'false', 'ні', 'Без ламінації', 'without lamination', 'Bez laminacji', 'ohne'])(
        '«%s» це без ламінації', (value) => {
            expect(isPageLaminationSelected(value)).toBe(false);
        });

    it.each(['with', 'З ламінацією (+7 ₴/стор)', 'yes'])('«%s» це з ламінацією', (value) => {
        expect(isPageLaminationSelected(value)).toBe(true);
    });

    it('невибрана опція не коштує нічого', () => {
        expect(isPageLaminationSelected(undefined)).toBe(false);
        expect(isPageLaminationSelected('')).toBe(false);
    });
});

describe('ціна за слугом товару і вибраними опціями', () => {
    // Це той самий шлях, яким сторінка товару перевіряє себе проти прайсу.
    // Значення опції приходить із бази рядком, а з кнопок у інтерфейсі —
    // числом. Обидві форми мають давати одну ціну: поки перевірка вимагала
    // саме число, рядок «12» повертав null, сторінка падала назад на колонку
    // products.price і продавала журнал за 825 ₴ (TM-001202).
    it.each([
        ['fotozhurnal-tverd-obkladynka', 12, 675],
        ['fotozhurnal-tverd-obkladynka', 14, 750],
        ['fotozhurnal-tverd-obkladynka', 16, 825],
        ['fotozhurnal-tverd-obkladynka', 80, 2900],
        ['personalized-glossy-magazine', 8, 525],
        ['personalized-glossy-magazine', 24, 1025],
    ])('%s на %s сторінок коштує %s ₴ і числом, і рядком', (slug, pages, price) => {
        expect(getCalculatedPrice(slug as string, { 'Кількість сторінок': pages })).toBe(price);
        expect(getCalculatedPrice(slug as string, { 'Кількість сторінок': String(pages) })).toBe(price);
    });

    it('фотокниги свою ціну тут не рахують — вона живе в photobook_prices', () => {
        expect(getCalculatedPrice('photobook-printed', { 'Кількість сторінок': 20 })).toBeNull();
    });

    it('невідомий товар не вигадує ціну', () => {
        expect(getCalculatedPrice('something-else-entirely', { 'Кількість сторінок': 20 })).toBeNull();
    });
});

describe('розпізнавання типу товару за слугом', () => {
    it.each([
        ['fotozhurnal-tverd-obkladynka', 'photojournal-hard'],
        ['personalized-glossy-magazine', 'magazine'],
        ['travelbook-20x30', 'travelbook'],
        ['photobook-velour', 'photobook'],
        ['wishbook', 'wishbook'],
    ])('%s це %s', (slug, type) => {
        expect(detectProductType(slug)).toBe(type);
    });

    // Слуг твердого журналу не містить слова photojournal, він розпізнається
    // за «tverd». Якби він упав у гілку глянцевого журналу, ціна поїхала б на
    // м'яку шкалу, тобто на сто гривень дешевше на кожній кількості сторінок.
    it('журнал з твердою обкладинкою не читається як глянцевий', () => {
        expect(detectProductType('fotozhurnal-tverd-obkladynka')).not.toBe('magazine');
    });
});

describe('книга побажань', () => {
    it('ціна залежить від матеріалу, кольору сторінок і розміру', () => {
        expect(getWishbookPrice('Друкована', 'Білі', '23x23')).toBe(629);
        expect(getWishbookPrice('Друкована', 'Чорні', '20x30')).toBe(1049);
        expect(getWishbookPrice('Велюр', 'Білі', '23x23')).toBe(1159);
        expect(getWishbookPrice('Шкірзамінник', 'Кремові', '30x20')).toBe(1509);
    });

    // Таблиця ключована українськими підписами, а конструктор передає
    // локалізовані. Поки їх не зводили до канонічних, велюрова книга на
    // польській чи румунській падала на базову ціну, тобто продавалась
    // дешевше за собівартість матеріалу.
    it('локалізовані назви матеріалу дають ту саму ціну, що й українські', () => {
        const uk = getWishbookPrice('Велюр', 'Білі', '23x23');
        expect(getWishbookPrice('Welur', 'Білі', '23x23')).toBe(uk);
        expect(getWishbookPrice('Velour', 'Білі', '23x23')).toBe(uk);
    });

    it('розмір читається і з латинським x, і з математичним знаком множення', () => {
        expect(getWishbookPrice('Друкована', 'Білі', '23×23')).toBe(629);
        expect(getWishbookPrice('Друкована', 'Білі', '23x23')).toBe(629);
    });
});
