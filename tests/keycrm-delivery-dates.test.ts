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

/**
 * Скасування зі стадії CRM не торкається оплачених замовлень.
 *
 * Живий випадок: TM-001036, картка 12916 — на сайті оплачено 3705 ₴, у CRM
 * стадія «canceled» із проведеним нулем і свіжою ТТН. Скасувати таке
 * автоматично означало б сховати суперечність під «скасовано», а рішення про
 * повернення грошей за людиною.
 */
describe('скасування зі стадії CRM', () => {
    const cancelMap = { '19': 'cancelled' };

    it('неоплачене скасовує', () => {
        const order = siteOrder({
            order_status: 'new', payment_status: 'pending', paid_amount: 0, total: 928,
            custom_attributes: { keycrm: { status_label: 'new' } },
        });
        const { patch } = buildSitePatch(order, crmCard({ status_id: 19, status_label: 'canceled', payments_total: 0 }), cancelMap);

        expect(patch.order_status).toBe('cancelled');
    });

    it('оплачене НЕ скасовує і каже про це', () => {
        const order = siteOrder({
            order_status: 'confirmed', payment_status: 'paid', paid_amount: 3705, total: 3705,
            custom_attributes: { keycrm: { status_label: 'new' } },
        });
        const { patch, changes } = buildSitePatch(order, crmCard({ status_id: 19, status_label: 'canceled', payments_total: 3705 }), cancelMap);

        expect(patch.order_status).toBeUndefined();
        expect(changes.join(' ')).toContain('потрібне рішення людини');
    });

    /**
     * Частково оплачене — теж гроші. Передоплата в 400 ₴ на замовленні, яке
     * CRM скасувала, це так само привід поговорити з клієнтом.
     */
    it('часткова оплата теж утримує від скасування', () => {
        const order = siteOrder({
            order_status: 'confirmed', payment_status: 'pending', paid_amount: 400, total: 770,
            custom_attributes: { keycrm: { status_label: 'new' } },
        });
        const { patch } = buildSitePatch(order, crmCard({ status_id: 19, status_label: 'canceled', payments_total: 0 }), cancelMap);

        expect(patch.order_status).toBeUndefined();
    });
    /**
     * Планована передоплата грошима НЕ рахується. Чекаут пише повну суму в
     * prepaid_amount у момент створення рахунку, тож TM-001203 має там
     * 2838 ₴, яких ніхто не платив. Якби цей рядок рахувався за оплату,
     * запобіжник заблокував би скасування половини відмов.
     */
    it('планована передоплата не заважає скасувати неоплачене', () => {
        const order = siteOrder({
            order_status: 'new', payment_status: 'pending', paid_amount: 0, prepaid_amount: 2838, total: 2838,
            custom_attributes: { keycrm: { status_label: 'new' } },
        });
        const { patch } = buildSitePatch(
            order,
            crmCard({ status_id: 19, status_label: 'canceled', payments_total: 0 }),
            cancelMap,
        );

        expect(patch.order_status).toBe('cancelled');
    });
});
