import { describe, expect, it } from 'vitest';
import { buildSitePatch } from '@/lib/automation/keycrm-twoway';

/**
 * Дата доставки береться з CRM, а не з годинника звірки.
 *
 * Дефект коштував 59 замовлень за один вечір 14.09.2026. Черга звірки вперше
 * пішла за давністю, дісталася замовлень, яких не звіряли тижнями, і кожному
 * поставила дату доставки «сьогодні». Замовлення від 28 липня дістало
 * «доставлено 14 вересня, 20:30». Поле читають строки доставки в аналітиці,
 * звіти за місяць і прибирання файлів друку.
 */
const crmCard = (over: Partial<any> = {}): any => ({
    id: 13806,
    source_uuid: '',
    source_id: '1',
    status_id: 11,
    status_label: 'delivered',
    status_changed_at: '2026-08-02T09:14:00.000000Z',
    grand_total: 928,
    created_at: '2026-07-28T10:00:00.000000Z',
    updated_at: '2026-08-02T09:14:00.000000Z',
    buyer_name: '', buyer_email: '', buyer_phone: '',
    manager_comment: '', buyer_comment: '', manager_name: '',
    assigned_names: [], ttn: '', shipping_service: '', shipping_address: '',
    payments_total: 928, tags: [], files: [], products: [],
    ...over,
});

const siteOrder = (over: Partial<any> = {}): any => ({
    id: 'uuid', order_number: 'TM-001096',
    order_status: 'shipped', payment_status: 'paid',
    total: 928, paid_amount: 928, cod_amount: 0,
    shipped_at: null, delivered_at: null, cod_received_at: null,
    ttn: '', tags: [], custom_attributes: { keycrm: { order_id: 13806, status_label: 'delivered' } },
    created_at: '2026-07-28T10:00:00.000Z',
    ...over,
});

describe('delivered_at зі стадії KeyCRM', () => {
    it('бере момент переходу стадії, а не момент звірки', () => {
        const { patch } = buildSitePatch(siteOrder(), crmCard(), {});

        expect(patch.order_status).toBe('delivered');
        expect(patch.delivered_at).toBe('2026-08-02T09:14:00.000000Z');
    });

    it('те саме для відправлення', () => {
        const { patch } = buildSitePatch(
            siteOrder({ order_status: 'confirmed', custom_attributes: { keycrm: { status_label: 'in_transit' } } }),
            crmCard({ status_label: 'in_transit', status_changed_at: '2026-07-30T08:00:00.000000Z' }),
            {},
        );

        expect(patch.order_status).toBe('shipped');
        expect(patch.shipped_at).toBe('2026-07-30T08:00:00.000000Z');
    });

    /**
     * Найважливіший випадок: поля немає, і перехід ми не бачили — тобто
     * замовлення вперше трапилося нам уже доставленим. Статус міняємо,
     * дату не вигадуємо.
     */
    it('без дати з CRM і без побаченого переходу дати не ставить зовсім', () => {
        const { patch } = buildSitePatch(siteOrder(), crmCard({ status_changed_at: '' }), {});

        expect(patch.order_status).toBe('delivered');
        expect(patch.delivered_at).toBeUndefined();
    });

    it('без дати з CRM, але з побаченим переходом ставить «зараз»', () => {
        const order = siteOrder({ custom_attributes: { keycrm: { status_label: 'Передано на друк' } } });
        const { patch } = buildSitePatch(order, crmCard({ status_changed_at: '' }), {});

        expect(patch.order_status).toBe('delivered');
        expect(Date.parse(patch.delivered_at)).toBeGreaterThan(Date.now() - 5000);
    });

    it('наявну дату не перезаписує', () => {
        const { patch } = buildSitePatch(siteOrder({ delivered_at: '2026-08-01T00:00:00.000Z' }), crmCard(), {});

        expect(patch.delivered_at).toBeUndefined();
    });

    /**
     * Післяплата — єдиний виняток: без моменту стадії дата все одно ставиться,
     * бо пропущена позначка забирає гроші з paid_amount.
     */
    it('післяплату позначає отриманою навіть без дати з CRM', () => {
        const order = siteOrder({ cod_amount: 500, paid_amount: 428, payment_status: 'pending' });
        const { patch } = buildSitePatch(order, crmCard({ status_changed_at: '' }), {});

        expect(patch.cod_received_at).toBeTruthy();
        expect(patch.paid_amount).toBe(928);
    });
});
