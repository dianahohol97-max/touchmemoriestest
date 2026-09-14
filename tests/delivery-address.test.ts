import { describe, it, expect } from 'vitest';
import { readDeliveryAddress } from '@/lib/orders/delivery-address';

/**
 * Адреса доставки лежить у двох колонках, бо її пишуть два різні потоки
 * оформлення. Вивантаження в KeyCRM читало лише одну з них, і 47 зі 131
 * замовлень сайту за 90 днів приїхали до менеджерів без міста й відділення,
 * хоча в базі адреса була.
 */
describe('readDeliveryAddress', () => {
    it('кошик: місто і відділення з delivery_address', () => {
        const a = readDeliveryAddress({
            delivery_address: { city: 'Київ', branch: 'Відділення №41: бул. Русанівський, 4' },
        });
        expect(a.city).toBe('Київ');
        expect(a.point).toBe('Відділення №41: бул. Русанівський, 4');
        expect(a.source).toBe('delivery_address');
    });

    it('потік з дизайнером: адреса з custom_attributes, коли delivery_address порожній', () => {
        // TM-001313 у базі має саме такий вигляд.
        const a = readDeliveryAddress({
            delivery_address: {},
            custom_attributes: { city: 'Київ', address: 'Відділення №41: бул. Русанівський, 4' },
        });
        expect(a.city).toBe('Київ');
        expect(a.point).toBe('Відділення №41: бул. Русанівський, 4');
        expect(a.source).toBe('custom_attributes');
    });

    it('заповнений delivery_address має перевагу над custom_attributes', () => {
        const a = readDeliveryAddress({
            delivery_address: { city: 'Львів', branch: 'Відділення №1' },
            custom_attributes: { city: 'Київ', address: 'Відділення №41' },
        });
        expect(a.city).toBe('Львів');
        expect(a.source).toBe('delivery_address');
    });

    it('міжнародна відправка: вулиця стає точкою отримання, країна зберігається', () => {
        const a = readDeliveryAddress({
            delivery_address: {
                country: 'Spain', city: 'Barcelona', postal: '08830', address: 'Pasaje Irena Sendler 4',
            },
        });
        expect(a.city).toBe('Barcelona');
        expect(a.point).toBe('Pasaje Irena Sendler 4');
        expect(a.country).toBe('Spain');
        expect(a.postal).toBe('08830');
    });

    it('адреса одним рядком — це точка отримання', () => {
        const a = readDeliveryAddress({ delivery_address: 'Київ, Відділення №41' });
        expect(a.point).toBe('Київ, Відділення №41');
        expect(a.city).toBe('');
        expect(a.source).toBe('delivery_address');
    });

    it('джерела не змішуються навпіл', () => {
        // Місто з однієї колонки і відділення з іншої — це адреса, якої не
        // існує в жодному стані замовлення.
        const a = readDeliveryAddress({
            delivery_address: { city: 'Київ' },
            custom_attributes: { address: 'Відділення №41' },
        });
        expect(a.source).toBe('delivery_address');
        expect(a.point).toBe('');
    });

    it('немає нічого — немає й адреси', () => {
        expect(readDeliveryAddress({ delivery_address: {}, custom_attributes: {} }).source).toBe('none');
        expect(readDeliveryAddress(null).source).toBe('none');
        expect(readDeliveryAddress({ delivery_address: '   ' }).source).toBe('none');
    });
});
