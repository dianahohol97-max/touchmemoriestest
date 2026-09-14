import { describe, it, expect } from 'vitest';
import { buildKeycrmOrderPayload } from '@/lib/automation/keycrm-push';

/**
 * Що саме бачить менеджер у картці KeyCRM у полях доставки.
 *
 * TM-001313 і TM-001314 — сусідні замовлення тієї самої клієнтки на ту саму
 * адресу. Перше оформлене через потік з дизайнером, друге через кошик, і до
 * 14.09.2026 в CRM з адресою доїжджало тільки друге.
 */
const DESIGNER_ORDER = {
    order_number: 'TM-001313',
    customer_name: 'Світлана Краснова',
    customer_phone: '+380509359089',
    delivery_method: 'nova_poshta',
    delivery_address: {},
    custom_attributes: { city: 'Київ', address: 'Відділення №41: бул. Русанівський, 4' },
    items: [{ product_name: 'Travel Book', quantity: 1, price: 750 }],
};

describe('buildKeycrmOrderPayload · доставка', () => {
    it('замовлення з дизайнером більше не їде без адреси', () => {
        const p = buildKeycrmOrderPayload(DESIGNER_ORDER);
        expect(p.shipping.shipping_address_city).toBe('Київ');
        expect(p.shipping.shipping_receive_point).toBe('Відділення №41: бул. Русанівський, 4');
    });

    it('замовлення з кошика працює як і раніше', () => {
        const p = buildKeycrmOrderPayload({
            ...DESIGNER_ORDER,
            order_number: 'TM-001314',
            delivery_address: { city: 'Київ', branch: 'Відділення №41: бул. Русанівський, 4' },
            custom_attributes: {},
        });
        expect(p.shipping.shipping_address_city).toBe('Київ');
        expect(p.shipping.shipping_receive_point).toBe('Відділення №41: бул. Русанівський, 4');
    });

    it('міжнародна відправка додає країну', () => {
        const p = buildKeycrmOrderPayload({
            ...DESIGNER_ORDER,
            delivery_method: 'international',
            delivery_address: { country: 'Spain', city: 'Barcelona', postal: '08830', address: 'Pasaje Irena Sendler 4' },
        });
        expect(p.shipping.shipping_address_country).toBe('Spain');
        expect(p.shipping.shipping_receive_point).toBe('Pasaje Irena Sendler 4');
    });

    it('без адреси поля лишаються порожніми, а не зникають', () => {
        const p = buildKeycrmOrderPayload({ ...DESIGNER_ORDER, custom_attributes: {} });
        expect(p.shipping.shipping_address_city).toBe('');
        expect(p.shipping.shipping_receive_point).toBe('');
        expect(p.shipping).not.toHaveProperty('shipping_address_country');
    });
});

describe('buildKeycrmOrderPayload · дедлайн', () => {
    it('дата готовності їде в коментар менеджера', () => {
        const p = buildKeycrmOrderPayload({ ...DESIGNER_ORDER, deadline: '2026-09-20T00:00:00Z' });
        expect(p.manager_comment).toContain('Дедлайн: 20.09.2026');
    });

    it('без дедлайну рядка немає', () => {
        const p = buildKeycrmOrderPayload(DESIGNER_ORDER);
        expect(p.manager_comment).not.toContain('Дедлайн');
    });

    it('зіпсована дата не потрапляє в коментар', () => {
        const p = buildKeycrmOrderPayload({ ...DESIGNER_ORDER, deadline: 'завтра' });
        expect(p.manager_comment).not.toContain('Дедлайн');
    });
});
