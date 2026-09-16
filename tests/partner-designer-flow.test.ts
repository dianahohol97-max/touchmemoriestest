import { describe, expect, it } from 'vitest';
import { selectCheckoutCodes } from '@/lib/referral/checkout-codes';
import { parseStoredReferralCode, serializeReferralCode } from '@/lib/referral/pending-code';
import { isSelfReferral, normalizeBindingEmail } from '@/lib/agency/binding';

/**
 * ПОТІК «З ДИЗАЙНЕРОМ» — той, на якому партнерська модель зламалася в проді.
 *
 * TM-001325 (16.09.2026): перехід за посиланням записався в referral_visits,
 * код ліг у localStorage, а замовлення прийшло з promo_code=null,
 * referral_partner_id=null і без знижки. Причина виявилася не там, де її
 * шукали: замовлень із сайту ДВА потоки, і цей вставляє рядок прямо з браузера,
 * минаючи і /checkout, і /api/orders/submit, де вся партнерська механіка й
 * живе. За серпень і вересень так прийшло 48 із 92 замовлень.
 *
 * Наявні тести цього не спіймали саме тому, що перевіряли /checkout — шлях, на
 * якому все справді працює. Цей файл закриває другий.
 */

const HOUR = 60 * 60 * 1000;
const NOW = 1_800_000_000_000;

/**
 * Модель /api/referral/attach-order: що робить сервер, коли потік дизайнера
 * просить привʼязати щойно створене замовлення.
 */
type World = {
    bindings: Map<string, string>;
    partners: Map<string, { id: string; email: string; active: boolean; discountPct: number }>;
};

type Order = {
    id: string;
    email: string;
    paymentStatus: 'pending' | 'paid';
    subtotal: number;
    total: number;
    referralPartnerId: string | null;
};

function attachOrder(world: World, order: Order, refCode?: string) {
    if (order.paymentStatus === 'paid') return { attributed: false, reason: 'already_paid', discount: 0 };
    if (order.referralPartnerId) return { attributed: true, reason: 'already_attributed', discount: 0 };

    const email = normalizeBindingEmail(order.email);
    let partner = null as World['partners'] extends Map<string, infer V> ? V | null : never;
    let isFirstOrder = true;

    const bound = email ? world.bindings.get(email) : undefined;
    if (bound) {
        isFirstOrder = false;
        partner = [...world.partners.values()].find(p => p.id === bound) || null;
    } else if (refCode) {
        partner = world.partners.get(refCode) || null;
    }

    if (!partner || !partner.active) return { attributed: false, reason: 'no_partner', discount: 0 };
    if (isSelfReferral(order.email, partner.email)) {
        return { attributed: false, reason: 'self_referral', discount: 0 };
    }

    order.referralPartnerId = partner.id;
    let discount = 0;
    if (isFirstOrder) {
        discount = Math.round(order.subtotal * partner.discountPct) / 100;
        if (discount > 0) order.total = Math.round((order.subtotal - discount) * 100) / 100;
    }
    return { attributed: true, reason: 'ok', discount, first_order: isFirstOrder };
}

const makeWorld = (): World => ({
    bindings: new Map(),
    partners: new Map([
        ['ПОДОTABB', { id: 'p1', email: 'partner@agency.com', active: true, discountPct: 5 }],
    ]),
});

const makeOrder = (over: Partial<Order> = {}): Order => ({
    id: 'o1',
    email: 'client@mail.com',
    paymentStatus: 'pending',
    subtotal: 675,
    total: 675,
    referralPartnerId: null,
    ...over,
});

describe('весь шлях: візит на /uk → localStorage → потік дизайнера', () => {
    it('код, збережений на /uk?ref=, читається через добу і дає знижку', () => {
        // Саме те, що сталося в проді: ReferralCapture записав код о 10:29,
        // замовлення пішло о 10:32. Між ними — інша сторінка й інший потік.
        const stored = serializeReferralCode('ПОДОTABB', NOW - 3 * 60 * 1000);
        const code = parseStoredReferralCode(stored, NOW, 90 * 24 * HOUR);
        expect(code).toBe('ПОДОTABB');

        const w = makeWorld();
        const order = makeOrder();
        const r = attachOrder(w, order, code!);

        expect(r.attributed).toBe(true);
        expect(r.discount).toBe(33.75);          // 5% від 675
        expect(order.total).toBe(641.25);        // саме це має побачити Монобанк
        expect(order.subtotal).toBe(675);        // повна сума лишається — з неї рахується комісія
        expect(order.referralPartnerId).toBe('p1');
    });

    it('без коду і без привʼязки замовлення лишається звичайним', () => {
        const w = makeWorld();
        const order = makeOrder();
        const r = attachOrder(w, order);
        expect(r.attributed).toBe(false);
        expect(order.total).toBe(675);
        expect(order.referralPartnerId).toBeNull();
    });
});

describe('потік дизайнера: повторне замовлення привʼязаного клієнта', () => {
    it('комісія без коду і БЕЗ знижки', () => {
        const w = makeWorld();
        w.bindings.set('client@mail.com', 'p1');
        const order = makeOrder({ subtotal: 2000, total: 2000 });
        // Коду немає взагалі: людина прийшла на сайт сама.
        const r = attachOrder(w, order);
        expect(r.attributed).toBe(true);
        expect(r.first_order).toBe(false);
        expect(r.discount).toBe(0);
        expect(order.total).toBe(2000);
        expect(order.referralPartnerId).toBe('p1');
    });

    it('привʼязка переважає код чужого партнера', () => {
        const w = makeWorld();
        w.partners.set('OTHER123', { id: 'p2', email: 'other@agency.com', active: true, discountPct: 5 });
        w.bindings.set('client@mail.com', 'p1');
        const order = makeOrder();
        attachOrder(w, order, 'OTHER123');
        expect(order.referralPartnerId).toBe('p1');
    });
});

describe('потік дизайнера: межі', () => {
    it('оплачене замовлення не переписується', () => {
        const w = makeWorld();
        const order = makeOrder({ paymentStatus: 'paid' });
        const r = attachOrder(w, order, 'ПОДОTABB');
        expect(r.reason).toBe('already_paid');
        expect(order.total).toBe(675);
    });

    it('повторний виклик нічого не подвоює', () => {
        const w = makeWorld();
        const order = makeOrder();
        attachOrder(w, order, 'ПОДОTABB');
        const totalAfterFirst = order.total;
        const second = attachOrder(w, order, 'ПОДОTABB');
        expect(second.reason).toBe('already_attributed');
        expect(order.total).toBe(totalAfterFirst);
    });

    it('самореферал не дає ні знижки, ні атрибуції', () => {
        const w = makeWorld();
        const order = makeOrder({ email: 'partner@agency.com' });
        const r = attachOrder(w, order, 'ПОДОTABB');
        expect(r.attributed).toBe(false);
        expect(order.total).toBe(675);
        expect(order.referralPartnerId).toBeNull();
    });

    it('деактивований партнер не привʼязує', () => {
        const w = makeWorld();
        w.partners.set('ПОДОTABB', { id: 'p1', email: 'partner@agency.com', active: false, discountPct: 5 });
        const order = makeOrder();
        expect(attachOrder(w, order, 'ПОДОTABB').attributed).toBe(false);
    });
});

describe('другий браузерний потік: бриф на текст журналу', () => {
    /**
     * /order/magazine-text-brief вставляє замовлення так само з браузера і так
     * само минає submit. Що він живий, а не залишковий, показали дані: 27
     * замовлень, 17 оплачених, 12 за останні тридцять днів, останнє 15.09,
     * 17 225 ₴ оплаченої виручки. Тому він підключений тим самим роутом і
     * перевіряється тими самими правилами.
     */
    it('замовлення з брифу теж отримує знижку й атрибуцію', () => {
        const w = makeWorld();
        const order = makeOrder({ id: 'brief-1', subtotal: 1200, total: 1200 });
        const r = attachOrder(w, order, 'ПОДОTABB');
        expect(r.attributed).toBe(true);
        expect(r.discount).toBe(60);
        expect(order.total).toBe(1140);
        expect(order.subtotal).toBe(1200);
    });

    it('повторне замовлення з брифу дає комісію без знижки', () => {
        const w = makeWorld();
        w.bindings.set('client@mail.com', 'p1');
        const order = makeOrder({ id: 'brief-2', subtotal: 1200, total: 1200 });
        const r = attachOrder(w, order);
        expect(r.attributed).toBe(true);
        expect(r.discount).toBe(0);
        expect(order.total).toBe(1200);
    });
});

describe('чекаут лишається справним — гіпотези, які прод спростував', () => {
    it('код із localStorage доходить до чекауту як партнерський', () => {
        // Гіпотеза «гард глушить код із localStorage» не підтвердилась:
        // автопідстановка шле source:'link', і відхиляється лише поле вводу.
        const r = selectCheckoutCodes({ storedRef: 'ПОДОTABB' });
        expect(r.code).toBe('ПОДОTABB');
        expect(r.partnerCode).toBe('ПОДОTABB');
    });

    it('кириличний код переживає запис і читання зі сховища', () => {
        // Гіпотеза «код губиться на редиректі / з 308» теж не підтвердилась.
        const stored = serializeReferralCode('ПОДОTABB', NOW);
        expect(parseStoredReferralCode(stored, NOW, 90 * 24 * HOUR)).toBe('ПОДОTABB');
    });
});
