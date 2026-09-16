import { describe, expect, it } from 'vitest';
import {
    MAGAZINE_TEXT_PACKAGE_PRICE,
    buildMagazineBriefOrderRow,
    isMagazineTextPackage,
    isMagazineUrgent,
    priceMagazineBrief,
    readMagazinePages,
} from '@/lib/orders/magazine-brief';
import { getMagazinePrice, URGENT_MULTIPLIER } from '@/lib/products';
import { DELIVERY_NOT_CHOSEN } from '@/lib/orders/pickup-rules';

/**
 * Заявка «журнал із нашим текстом»: ціна і рядок замовлення.
 *
 * Ціна на цій сторінці рахувалася в трьох місцях — у підсумку для клієнта, у
 * рядку для бази і (тепер) на сервері. Ці тести стережуть те, заради чого
 * копії злилися в одну функцію: клієнт не має бачити одну суму, а отримати
 * рахунок на іншу.
 */
const base24 = getMagazinePrice(24, false);

describe('ціна заявки', () => {
    it('база за кількістю сторінок плюс пакет тексту', () => {
        const p = priceMagazineBrief({ 'Кількість сторінок': '24 сторінки' }, 'basic');
        expect(p.pages).toBe(24);
        expect(p.total).toBe(base24 + MAGAZINE_TEXT_PACKAGE_PRICE.basic);
        expect(p.urgentExtra).toBe(0);
    });

    it('терміновість додає тридцять відсотків від бази, не від суми з пакетом', () => {
        const p = priceMagazineBrief({ 'Кількість сторінок': '24', 'Терміновість': 'Термінове' }, 'premium');
        expect(p.urgentExtra).toBe(Math.round(base24 * URGENT_MULTIPLIER));
        expect(p.total).toBe(base24 + p.urgentExtra + MAGAZINE_TEXT_PACKAGE_PRICE.premium);
    });

    /**
     * Підсумок для клієнта рахувався як round(база × 1,3), а рядок у базі — як
     * база + round(база × 0,3). Тепер це одна функція, і показане число і є те,
     * що лягає в рахунок.
     */
    it('показане клієнтові число дорівнює тому, що лягає в замовлення', () => {
        const options = { 'Кількість сторінок': '32', 'Терміновість': 'Термінове' };
        const shown = priceMagazineBrief(options, 'basic').total;
        const row = buildMagazineBriefOrderRow({ ...baseInput, options, pkg: 'basic' });
        expect(row.total).toBe(shown);
        expect(row.items[0].unit_price).toBe(shown);
    });

    it('без кількості сторінок ціни немає — нуль, а не мінімальний тариф', () => {
        const p = priceMagazineBrief({}, 'premium');
        expect(p.total).toBe(0);
        expect(p.breakdown).toEqual([]);
    });

    it('порожня терміновість і «стандартна» — це не терміново', () => {
        expect(isMagazineUrgent({})).toBe(false);
        expect(isMagazineUrgent({ 'Терміновість': 'Стандартна' })).toBe(false);
        expect(isMagazineUrgent({ 'Терміновість': '0' })).toBe(false);
        expect(isMagazineUrgent({ 'Терміновість': 'Термінове виготовлення' })).toBe(true);
    });

    it('кількість сторінок читається з тексту картки товару', () => {
        expect(readMagazinePages({ 'Кількість сторінок': '24 сторінки' })).toBe(24);
        expect(readMagazinePages({ 'Кількість сторінок': '' })).toBe(0);
        expect(readMagazinePages(undefined)).toBe(0);
    });

    it('пакет приймається тільки відомий', () => {
        expect(isMagazineTextPackage('basic')).toBe(true);
        expect(isMagazineTextPackage('premium')).toBe(true);
        expect(isMagazineTextPackage('gold')).toBe(false);
        expect(isMagazineTextPackage(undefined)).toBe(false);
    });
});

const baseInput = {
    path: 'client' as const,
    productSlug: 'personalized-glossy-magazine',
    pkg: 'basic' as const,
    answers: { recipient_name: 'Оля' },
    options: { 'Кількість сторінок': '24' },
    firstName: 'Діана',
    lastName: 'Гоголь',
    phone: '+380000000000',
    email: 'test@example.com',
    telegram: '@test',
    contactMethod: 'telegram',
    collectedAt: '2026-09-16T10:00:00.000Z',
};

describe('рядок замовлення', () => {
    it('обидва шляхи пишуть той самий рядок, крім помітки джерела', () => {
        const client = buildMagazineBriefOrderRow({ ...baseInput, path: 'client' });
        const server = buildMagazineBriefOrderRow({ ...baseInput, path: 'server' });
        const strip = (row: any) => {
            const { custom_attributes, ...rest } = row;
            return rest;
        };
        expect(strip(client)).toEqual(strip(server));
        expect(client.custom_attributes.order_path).toBe('client');
        expect(server.custom_attributes.order_path).toBe('server');
        expect(server.custom_attributes.price_computed).toBe(server.total);
    });

    /**
     * Сервер не відкидає замовлення через розбіжність — записує обидві суми.
     * Клієнт зі старою збіркою сторінки має оформитися, а не впертися в
     * помилку; розбіжність бачить звіт.
     */
    it('заявлена браузером сума зберігається поруч із порахованою', () => {
        const row = buildMagazineBriefOrderRow({ ...baseInput, path: 'server', declaredTotal: 1 });
        expect(row.custom_attributes.price_declared).toBe(1);
        expect(row.custom_attributes.price_computed).toBe(row.total);
        expect(row.total).not.toBe(1);
    });

    it('ключ повтору лягає в замовлення, щоб друга спроба не створила другого', () => {
        const row = buildMagazineBriefOrderRow({ ...baseInput, idempotencyKey: 'magazine-brief-1789565909919' });
        expect(row.custom_attributes.order_idempotency_key).toBe('magazine-brief-1789565909919');
        expect(buildMagazineBriefOrderRow(baseInput).custom_attributes.order_idempotency_key).toBeUndefined();
    });

    /**
     * Форма не питає доставки взагалі. Поки сюди писався 'pickup', усі
     * замовлення журналу стояли самовивозом, включно з терміновими, яким
     * самовивіз заборонено.
     */
    it('доставка — «ще не обрано», а не самовивіз', () => {
        expect(buildMagazineBriefOrderRow(baseInput).delivery_method).toBe(DELIVERY_NOT_CHOSEN);
    });

    it('замовлення без порахованої ціни просить менеджера виставити суму руками', () => {
        const row = buildMagazineBriefOrderRow({ ...baseInput, options: {} });
        expect(row.total).toBe(0);
        expect(String(row.notes)).toContain('визначте вручну');
        expect(row.payment_status).toBe('pending');
    });

    it('замовлення приходить неоплаченим і без заявленої оплати', () => {
        const row = buildMagazineBriefOrderRow({ ...baseInput, path: 'server' });
        expect(row.payment_status).toBe('pending');
        expect(row.paid_amount).toBeUndefined();
        expect(row.paid_at).toBeUndefined();
    });
});
