import { describe, expect, it } from 'vitest';
import { classifyItemsSubtotal, processAgencyCommission } from '@/lib/agency/commission';

/**
 * ПАСТКА «ЗАКРІПЛЕНИЙ КЛІЄНТ БЕЗ КОМІСІЇ».
 *
 * Привʼязка клієнта до партнера створювалася раніше, ніж перевірялося, що
 * комісія більша за нуль, і жодного звʼязку між цими двома діями не було. Тому
 * замовлення з незнайомою формою позиції лишало напівстан, який нічим не
 * лікується: клієнт закріплений за партнером НАЗАВЖДИ, а грошей немає ні
 * партнеру, ні його менеджеру, ні рядком у журналі.
 *
 * Тести навмисно ганяють САМУ processAgencyCommission через підроблений клієнт
 * бази, а не повторюють її логіку моделлю. Перевіряється порядок дій усередині
 * функції, тож модель поруч довела б лише те, що модель узгоджена сама з
 * собою — рівно ту помилку, через яку перший набір тестів пропустив потік «з
 * дизайнером».
 */

type Db = {
    orders: Record<string, any>;
    agency_partners: Record<string, any>;
    partner_client_bindings: Record<string, any>;
    agency_commissions: any[];
    sales_managers: Record<string, any>;
    sales_commissions: any[];
    /** Змушує підроблену RPC впасти так, як упала б помилка вставки в базі. */
    failCommissionInsert?: boolean;
};

const PARTNER_ID = 'p-1';
const ORDER_ID = 'o-1';

function makeDb(over: Partial<Db> = {}): Db {
    return {
        orders: {
            [ORDER_ID]: {
                id: ORDER_ID,
                customer_email: 'client@mail.com',
                referral_partner_id: PARTNER_ID,
                subtotal: 675,
                total: 641.25,
            },
        },
        agency_partners: {
            [PARTNER_ID]: {
                id: PARTNER_ID,
                email: 'partner@agency.com',
                travelbook_rate: 5,
                other_rate: 3,
                status: 'active',
                sales_manager_id: null,
            },
        },
        partner_client_bindings: {},
        agency_commissions: [],
        sales_managers: {},
        sales_commissions: [],
        ...over,
    };
}

/**
 * Підроблений службовий клієнт: рівно ті виклики, які робить ланцюжок
 * нарахування. RPC моделює тіло record_agency_commission разом із головною
 * його властивістю — обидві вставки в одній транзакції, тож помилка другої
 * відкочує першу.
 */
function makeAdmin(db: Db): any {
    const rowsOf = (t: string): any[] => {
        const v = (db as any)[t];
        return Array.isArray(v) ? v : Object.values(v || {});
    };

    const from = (table: string) => {
        const filters: ((r: any) => boolean)[] = [];
        let pending: { kind: 'insert' | 'update'; payload: any } | null = null;

        const exec = () => {
            if (pending?.kind === 'insert') {
                rowsOf(table).push?.(pending.payload);
                if (Array.isArray((db as any)[table])) (db as any)[table].push(pending.payload);
                return { data: [pending.payload], error: null };
            }
            if (pending?.kind === 'update') {
                const hit = rowsOf(table).filter(r => filters.every(f => f(r)));
                hit.forEach(r => Object.assign(r, pending!.payload));
                return { data: hit, error: null };
            }
            return { data: null, error: null };
        };

        const api: any = {
            select: () => api,
            eq: (c: string, v: any) => { filters.push(r => r[c] === v); return api; },
            neq: (c: string, v: any) => { filters.push(r => r[c] !== v); return api; },
            ilike: (c: string, v: any) => {
                filters.push(r => String(r[c] ?? '').toLowerCase() === String(v).toLowerCase());
                return api;
            },
            insert: (payload: any) => { pending = { kind: 'insert', payload }; return api; },
            update: (payload: any) => { pending = { kind: 'update', payload }; return api; },
            maybeSingle: async () => {
                const hit = rowsOf(table).filter(r => filters.every(f => f(r)));
                return { data: hit[0] ?? null, error: null };
            },
            then: (resolve: any, reject: any) => Promise.resolve(exec()).then(resolve, reject),
        };
        return api;
    };

    const recalc = (agencyId: string) => {
        const partner = db.agency_partners[agencyId];
        if (!partner) return;
        partner.total_earned = db.agency_commissions
            .filter(c => c.agency_id === agencyId && c.payout_status !== 'cancelled')
            .reduce((s, c) => s + Number(c.total_commission || 0), 0);
    };

    const rpc = async (name: string, a: any) => {
        if (name === 'recalc_agency_partner_totals') { recalc(a.p_agency_id); return { data: null, error: null }; }
        if (name !== 'record_agency_commission') return { data: null, error: null };

        // Знімок заради того єдиного, заради чого функція й живе в базі:
        // помилка другої вставки має відкотити першу.
        const snapshot = { ...db.partner_client_bindings };

        let bound = false;
        if (a.p_email) {
            if (!db.partner_client_bindings[a.p_email]) {
                db.partner_client_bindings[a.p_email] = {
                    email: a.p_email, partner_id: a.p_agency_id, first_order_id: a.p_order_id,
                };
                bound = true;
            }
        }
        const kind = bound ? 'new_client' : 'repeat';

        let inserted = false;
        if (Number(a.p_total_commission) > 0) {
            if (db.failCommissionInsert) {
                db.partner_client_bindings = snapshot;      // ROLLBACK
                return { data: null, error: { message: 'insert failed' } };
            }
            if (!db.agency_commissions.some(c => c.order_id === a.p_order_id)) {
                db.agency_commissions.push({
                    agency_id: a.p_agency_id, order_id: a.p_order_id,
                    travelbook_subtotal: a.p_travelbook_subtotal, other_subtotal: a.p_other_subtotal,
                    travelbook_commission: a.p_travelbook_commission, other_commission: a.p_other_commission,
                    total_commission: a.p_total_commission, payout_status: 'pending', kind,
                });
                inserted = true;
            }
        }
        if (inserted) recalc(a.p_agency_id);
        return { data: [{ bound_now: bound, commission_inserted: inserted, kind }], error: null };
    };

    return { from, rpc };
}

/** Позиція потоку «з дизайнером» — та, що лежала в TM-001326. */
const designerItem = { product_slug: 'travelbook-20x30', product_name: 'Travel Book', quantity: 1, price: 675 };
/** Та сама позиція з ціною в полі, якого читач не знає. */
const brokenItem = { product_slug: 'travelbook-20x30', product_name: 'Travel Book', quantity: 1, sum_total: 675 };

describe('а. бита форма позиції: ні комісії, ні привʼязки', () => {
    it('замовлення з грошима і нечитабельними позиціями не пише НІЧОГО', async () => {
        const db = makeDb();
        const paid = await processAgencyCommission(makeAdmin(db), {
            orderId: ORDER_ID, promoCode: null, items: [brokenItem],
        });

        expect(paid).toBe(0);
        expect(db.agency_commissions).toHaveLength(0);
        // Ось воно, серце задачі: привʼязки теж немає.
        expect(Object.keys(db.partner_client_bindings)).toHaveLength(0);
        // І менеджер партнера не отримує нарахування від нульової бази.
        expect(db.sales_commissions).toHaveLength(0);
    });

    it('частковий недобір теж відмова: одну позицію прочитали, другу ні', async () => {
        const db = makeDb();
        db.orders[ORDER_ID].subtotal = 1350;
        const paid = await processAgencyCommission(makeAdmin(db), {
            orderId: ORDER_ID, promoCode: null, items: [designerItem, brokenItem],
        });

        expect(paid).toBe(0);
        expect(db.agency_commissions).toHaveLength(0);
        expect(Object.keys(db.partner_client_bindings)).toHaveLength(0);
    });

    it('порожній масив позицій при замовленні з сумою — теж відмова', async () => {
        const db = makeDb();
        const paid = await processAgencyCommission(makeAdmin(db), {
            orderId: ORDER_ID, promoCode: null, items: [],
        });
        expect(paid).toBe(0);
        expect(Object.keys(db.partner_client_bindings)).toHaveLength(0);
    });
});

describe('б. нормальне замовлення: і комісія, і привʼязка', () => {
    it('перше замовлення дає нарахування new_client і закріплює клієнта', async () => {
        const db = makeDb();
        const paid = await processAgencyCommission(makeAdmin(db), {
            orderId: ORDER_ID, promoCode: null, items: [designerItem],
        });

        expect(paid).toBe(33.75);                       // 5% від 675
        expect(db.agency_commissions).toHaveLength(1);
        expect(db.agency_commissions[0].kind).toBe('new_client');
        expect(db.agency_commissions[0].travelbook_subtotal).toBe(675);
        expect(db.partner_client_bindings['client@mail.com'].partner_id).toBe(PARTNER_ID);
        expect(db.agency_partners[PARTNER_ID].total_earned).toBe(33.75);
    });

    it('повторний виклик нічого не подвоює', async () => {
        const db = makeDb();
        const admin = makeAdmin(db);
        await processAgencyCommission(admin, { orderId: ORDER_ID, promoCode: null, items: [designerItem] });
        const second = await processAgencyCommission(admin, { orderId: ORDER_ID, promoCode: null, items: [designerItem] });

        expect(second).toBe(0);
        expect(db.agency_commissions).toHaveLength(1);
        expect(Object.keys(db.partner_client_bindings)).toHaveLength(1);
    });
});

describe('в. самореферал: не змінилося нічого', () => {
    it('партнер за власним посиланням не отримує ні комісії, ні привʼязки', async () => {
        const db = makeDb();
        db.orders[ORDER_ID].customer_email = 'partner@agency.com';
        const paid = await processAgencyCommission(makeAdmin(db), {
            orderId: ORDER_ID, promoCode: null, items: [designerItem],
        });

        expect(paid).toBe(0);
        expect(db.agency_commissions).toHaveLength(0);
        expect(Object.keys(db.partner_client_bindings)).toHaveLength(0);
    });
});

describe('г. деактивований партнер: не змінилося нічого', () => {
    it('партнер зі статусом не active не привʼязує клієнта', async () => {
        const db = makeDb();
        db.agency_partners[PARTNER_ID].status = 'paused';
        const paid = await processAgencyCommission(makeAdmin(db), {
            orderId: ORDER_ID, promoCode: null, items: [designerItem],
        });

        expect(paid).toBe(0);
        expect(db.agency_commissions).toHaveLength(0);
        expect(Object.keys(db.partner_client_bindings)).toHaveLength(0);
    });
});

describe('д. повторне замовлення привʼязаного клієнта', () => {
    it('комісія нараховується без коду, знижки і нової привʼязки', async () => {
        const db = makeDb();
        db.partner_client_bindings['client@mail.com'] = {
            email: 'client@mail.com', partner_id: PARTNER_ID, first_order_id: 'o-0',
        };
        db.orders[ORDER_ID].referral_partner_id = null;   // код не приходив узагалі
        db.orders[ORDER_ID].total = 675;                  // знижки на повторному немає

        const paid = await processAgencyCommission(makeAdmin(db), {
            orderId: ORDER_ID, promoCode: null, items: [designerItem],
        });

        expect(paid).toBe(33.75);
        expect(db.agency_commissions[0].kind).toBe('repeat');
        expect(db.partner_client_bindings['client@mail.com'].first_order_id).toBe('o-0');
    });
});

describe('законний нуль — привʼязка є, нарахування немає', () => {
    /**
     * Рішення Діани (16.09.2026): якщо нарахування нульове ЗАКОННО, а не через
     * ваду, клієнта треба закріпити — він справжній, і наступне його замовлення
     * має принести партнеру відсоток.
     */
    it('партнер зі ставками 0% закріплює клієнта без рядка в журналі', async () => {
        const db = makeDb();
        db.agency_partners[PARTNER_ID].travelbook_rate = 0;
        db.agency_partners[PARTNER_ID].other_rate = 0;

        const paid = await processAgencyCommission(makeAdmin(db), {
            orderId: ORDER_ID, promoCode: null, items: [designerItem],
        });

        expect(paid).toBe(0);
        expect(db.agency_commissions).toHaveLength(0);
        expect(db.partner_client_bindings['client@mail.com'].partner_id).toBe(PARTNER_ID);
    });

    it('безкоштовне замовлення теж закріплює: позиції нульові й subtotal нульовий', async () => {
        const db = makeDb();
        db.orders[ORDER_ID].subtotal = 0;
        db.orders[ORDER_ID].total = 0;

        const paid = await processAgencyCommission(makeAdmin(db), {
            orderId: ORDER_ID, promoCode: null,
            items: [{ ...designerItem, price: 0 }],
        });

        expect(paid).toBe(0);
        expect(db.agency_commissions).toHaveLength(0);
        expect(db.partner_client_bindings['client@mail.com']).toBeTruthy();
    });
});

describe('транзакція: помилка нарахування відкочує привʼязку', () => {
    it('коли вставка комісії падає, закріпленого клієнта не лишається', async () => {
        const db = makeDb({ failCommissionInsert: true });
        const paid = await processAgencyCommission(makeAdmin(db), {
            orderId: ORDER_ID, promoCode: null, items: [designerItem],
        });

        expect(paid).toBe(0);
        expect(db.agency_commissions).toHaveLength(0);
        expect(Object.keys(db.partner_client_bindings)).toHaveLength(0);
    });
});

describe('classifyItemsSubtotal — де саме проходить межа', () => {
    it('замовлення з грошима і нульовими позиціями — підозріле', () => {
        expect(classifyItemsSubtotal(0, 675)).toBe('suspect');
    });

    it('позиції сходяться із сумою замовлення — нормально', () => {
        expect(classifyItemsSubtotal(675, 675)).toBe('ok');
    });

    it('позиції більші за subtotal — нормально: так пишуть дзеркалені з KeyCRM', () => {
        // Знижка в CRM стоїть на замовленні, а не на позиціях: 52 оплачені
        // замовлення в базі саме такі, і жодне з них не має бути відхилене.
        expect(classifyItemsSubtotal(3906, 3773.84)).toBe('ok');
    });

    it('недобір у межах відсотка прощається, більший — ні', () => {
        expect(classifyItemsSubtotal(669, 675)).toBe('ok');        // −0.9%
        expect(classifyItemsSubtotal(600, 675)).toBe('suspect');   // −11%
    });

    it('без суми замовлення судимо лише за позиціями', () => {
        expect(classifyItemsSubtotal(675, 0)).toBe('ok');
        expect(classifyItemsSubtotal(0, 0)).toBe('legit_zero');
    });

    it('сміття замість числа не проходить за «нормально»', () => {
        expect(classifyItemsSubtotal(NaN, 675)).toBe('suspect');
        expect(classifyItemsSubtotal(NaN, NaN)).toBe('legit_zero');
    });
});
