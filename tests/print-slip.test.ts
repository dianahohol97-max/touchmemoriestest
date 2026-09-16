import { describe, expect, it } from 'vitest';
import { buildPrintSlip } from '@/lib/production/print-slip';

/**
 * Аркуш на друк для виробництва.
 *
 * Дефект, заради якого написані ці тести: текст збирався шаблонним рядком із
 * полів, яких у замовленнях немає. На 16.09.2026 у 2068 позиціях дошки
 * виробництва не було жодного `name`, жодного `qty`, жодного `options.format`
 * і жодного `options.pages` — усі 2068 мають `product_name`, `quantity` і
 * опції українськими назвами. Тобто кожен рядок аркуша читався як
 * «- undefined (undefined undefined undefined стор.) - undefined шт.», а
 * контакти для 224 замовлень закінчувалися «[object Object]».
 */
const bookOrder = {
    order_number: 'TM-001301',
    customer_name: 'Анастасія Скрипка',
    delivery_method: 'nova_poshta',
    delivery_address: { city: 'Володимирець', branch: 'Відділення №1: вул. Повстанців, 75' },
    items: [{
        product_name: 'Фотокнига з велюровою обкладинкою',
        quantity: 2,
        options: { 'Розмір': '30×30 см', 'Кількість сторінок': '20 сторінок', 'Колір велюру': 'В-01' },
    }],
};

describe('аркуш на друк', () => {
    it('називає товар, кількість і всі опції', () => {
        const slip = buildPrintSlip(bookOrder);

        expect(slip).toContain('Фотокнига з велюровою обкладинкою — 2 шт.');
        expect(slip).toContain('Розмір: 30×30 см');
        expect(slip).toContain('Кількість сторінок: 20 сторінок');
        expect(slip).toContain('Колір велюру: В-01');
        expect(slip).not.toContain('undefined');
    });

    it('адреса з обʼєкта більше не «[object Object]»', () => {
        const slip = buildPrintSlip(bookOrder);

        expect(slip).not.toContain('[object Object]');
        expect(slip).toContain('Нова Пошта, Володимирець, Відділення №1: вул. Повстанців, 75');
    });

    it('адреса рядком читається так само', () => {
        const slip = buildPrintSlip({ ...bookOrder, delivery_address: 'Київ, відділення 12' });

        expect(slip).toContain('Нова Пошта, Київ, відділення 12');
        expect(slip).not.toContain('[object Object]');
    });

    /**
     * Потік «з дизайнером» лишає delivery_address порожнім обʼєктом і пише
     * адресу в custom_attributes. Аркуш мусить знайти її там, інакше
     * виробництво пакує наосліп.
     */
    it('знаходить адресу потоку «з дизайнером»', () => {
        const slip = buildPrintSlip({
            ...bookOrder,
            delivery_address: {},
            custom_attributes: { city: 'Львів', address: 'Відділення №8' },
        });

        expect(slip).toContain('Львів, Відділення №8');
    });

    it('коли адреси немає взагалі — каже це вголос', () => {
        const slip = buildPrintSlip({ ...bookOrder, delivery_address: {}, custom_attributes: {} });

        expect(slip).toContain('УВАГА: адреси доставки в замовленні немає.');
    });

    /**
     * Напис на гравіювання читають символ у символ, тож він іде окремим
     * блоком і зберігає рядки.
     */
    it('виносить персоналізацію окремим блоком із рядками', () => {
        const slip = buildPrintSlip({
            ...bookOrder,
            items: [{
                product_name: 'Альбом для фото 23х23',
                quantity: 1,
                options: { 'сторінки': 'білі' },
                personalization_note: 'надпис як на фото, золотом\n11.10.26\nВячеслав & Емілія',
            }],
        });

        expect(slip).toContain('Персоналізація:');
        expect(slip).toContain('11.10.26');
        expect(slip).toContain('Вячеслав & Емілія');
    });

    it('невідомий спосіб доставки показується як є, а не ховається', () => {
        const slip = buildPrintSlip({ ...bookOrder, delivery_method: 'drone' });
        expect(slip).toContain('drone');
    });

    it('замовлення без позицій не робить порожній аркуш мовчазним', () => {
        const slip = buildPrintSlip({ ...bookOrder, items: [] });
        expect(slip).toContain('- позицій немає');
    });
    /**
     * Дзеркалене з CRM замовлення: спосіб доставки в нашій колонці лишається
     * 'other', бо CRM не віддає його окремим полем, а адреса при цьому повна.
     * «Не обрано — узгодити з клієнтом» біля такої адреси суперечить саме
     * собі, і виробництво читає цей рядок буквально.
     */
    it('не радить узгоджувати доставку, коли адреса вже є', () => {
        const slip = buildPrintSlip({
            ...bookOrder,
            delivery_method: 'other',
            delivery_address: 'Ukraine, Одеська, Нерубайське, Відділення №1: вул. Вознесенська, 2-Б',
        });

        expect(slip).not.toContain('узгодити з клієнтом');
        expect(slip).toContain('Доставка: Ukraine, Одеська, Нерубайське');
    });

    it('але радить, коли адреси немає', () => {
        const slip = buildPrintSlip({ ...bookOrder, delivery_method: 'other', delivery_address: {}, custom_attributes: {} });

        expect(slip).toContain('узгодити з клієнтом');
        expect(slip).toContain('УВАГА: адреси доставки в замовленні немає.');
    });
});
