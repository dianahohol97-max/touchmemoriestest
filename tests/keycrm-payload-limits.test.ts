import { describe, expect, it } from 'vitest';
import { buildKeycrmOrderPayload } from '@/lib/automation/keycrm-push';

/**
 * Межі, на яких KeyCRM відмовляє ВСЬОМУ замовленню.
 *
 * Це не косметика. API не обрізає надто довге поле — воно повертає 422 і не
 * створює картку взагалі. 14.09.2026 так не перенеслося TM-001287: весільний
 * журнал, де клієнтка написала історію кохання на 2465 символів в опції «Наша
 * історія кохання». Крон бився об цю відмову щопівгодини, а замовлення на
 * 1250 ₴ для менеджерки просто не існувало.
 *
 * Дві межі, обидві з тексту відповіді KeyCRM:
 *   products.0.comment              — 1024 символи
 *   products.0.properties.N.value   — 255 символів
 */
const LOVE_STORY = 'Іноді найкрасивіші історії кохання починаються в найнесподіваніший спосіб. '.repeat(40);

const weddingMagazine = {
    order_number: 'TM-001287',
    total: 1250,
    customer_name: 'Valentina Shultz',
    customer_phone: '+380 97 763 9568',
    delivery_method: 'nova_poshta',
    delivery_address: { city: 'Володимирець', branch: 'Відділення №1: вул. Повстанців, 75' },
    items: [{
        product_name: 'Весільний журнал',
        quantity: 1,
        unit_price: 1250,
        total_price: 1250,
        options: {
            'Дизайн': 'Дизайн 2 — Wedding Post',
            'Імена пари': 'Brandt & Valentina',
            'Наша історія кохання': LOVE_STORY,
        },
    }],
};

describe('межі KeyCRM у payload', () => {
    it('ріже коментар позиції до 1024 символів РАЗОМ із маркером', () => {
        const payload = buildKeycrmOrderPayload(weddingMagazine);
        const comment = payload.products[0].comment as string;

        expect(comment.length).toBeLessThanOrEqual(1024);
        expect(comment).toContain('обрізано');
    });

    it('ріже значення властивості до 255 символів РАЗОМ із маркером', () => {
        const payload = buildKeycrmOrderPayload(weddingMagazine);
        const values = payload.products[0].properties.map((p: any) => p.value as string);

        for (const value of values) expect(value.length).toBeLessThanOrEqual(255);
        expect(values.some((v: string) => v.includes('повний текст на сайті'))).toBe(true);
    });

    it('не чіпає коротке — властивості, що влізли, лишаються дослівними', () => {
        const payload = buildKeycrmOrderPayload(weddingMagazine);
        const byName = Object.fromEntries(payload.products[0].properties.map((p: any) => [p.name, p.value]));

        expect(byName['Імена пари']).toBe('Brandt & Valentina');
        expect(byName['Дизайн']).toBe('Дизайн 2 — Wedding Post');
    });

    /**
     * Регресія на саму арифметику обрізання: місце під маркер відраховувалося
     * як тридцять символів, а маркер має сорок один, тож обрізаний текст
     * виходив за власну межу на одинадцять символів. Саме та помилка робила
     * обріз декоративним.
     */
    it('маркер уміщається в межу, а не додається поверх неї', () => {
        const wall = { ...weddingMagazine, items: [{ ...weddingMagazine.items[0], options: { 'Текст': 'я'.repeat(9000) } }] };
        const payload = buildKeycrmOrderPayload(wall);

        expect((payload.products[0].comment as string).length).toBeLessThanOrEqual(1024);
        expect((payload.products[0].properties[0].value as string).length).toBeLessThanOrEqual(255);
    });
});
