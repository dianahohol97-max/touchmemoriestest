import { describe, expect, it } from 'vitest';
import { accrueOrderCommission, reverseSalesCommission, syncManagerTotals } from '@/lib/sales/commission';

/**
 * КОМІСІЯ МЕНЕДЖЕРА ЗА СКАСОВАНИМ ЗАМОВЛЕННЯМ.
 *
 * 16.09.2026 скасування навчили знімати комісію ПАРТНЕРА, і на тому спинилися.
 * Менеджерське нарахування за тим самим замовленням лишалося зі статусом
 * 'pending' і далі йшло у виплату. Половина лікування виглядала як ціле саме
 * тому, що обидва нарахування робляться одним викликом, а знімалося лише одне.
 *
 * Друга половина задачі — зведення менеджера. `total_earned` правився читанням
 * і записом назад, а перемикач статусу в адмінці чіпав тільки `total_paid` і
 * `total_earned` не чіпав узагалі, тож знятий рядок і далі рахувався
 * заробленим. Тепер обидві суми похідні від журналу.
 *
 * Тести ганяють справжні функції через підроблений клієнт бази: перевіряється
 * те, що реально лягає в рядки, а не модель поруч із кодом.
 */

type Db = {
    sales_managers: Record<string, any>;
    sales_commissions: any[];
    agency_partners: Record<string, any>;
};

const MANAGER_ID = 'm-1';
const PARTNER_ID = 'p-1';
const ORDER_ID = 'o-1';

function makeDb(): Db {
    return {
        sales_managers: {
            [MANAGER_ID]: { id: MANAGER_ID, rate_order: 1, rate_gallery: 5, is_active: true, total_earned: 0, total_paid: 0 },
        },
        sales_commissions: [],
        agency_partners: {
            [PARTNER_ID]: { id: PARTNER_ID, sales_manager_id: MANAGER_ID, status: 'active', agency_name: 'Подорожуй!' },
        },
    };
}

/** Те, що робить recalc_sales_manager_totals у базі. */
function recalc(db: Db, managerId: string) {
    const mgr = db.sales_managers[managerId];
    if (!mgr) return;
    const rows = db.sales_commissions.filter(c => c.manager_id === managerId);
    mgr.total_earned = rows.filter(c => c.status !== 'cancelled').reduce((s, c) => s + Number(c.amount || 0), 0);
    mgr.total_paid = rows.filter(c => c.status === 'paid').reduce((s, c) => s + Number(c.amount || 0), 0);
}

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
                // UNIQUE(kind, source_id): те саме джерело двічі не оплачується.
                const row = pending.payload;
                const clash = db.sales_commissions.some(c => c.kind === row.kind && c.source_id === row.source_id);
                if (clash) return { data: null, error: { code: '23505', message: 'duplicate' } };
                db.sales_commissions.push({ status: 'pending', ...row });
                return { data: [row], error: null };
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
            eq: (c: string, v: any) => { filters.push(r => String(r[c]) === String(v)); return api; },
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

    return {
        from,
        rpc: async (name: string, a: any) => {
            if (name === 'recalc_sales_manager_totals') recalc(db, a.p_manager_id);
            return { data: null, error: null };
        },
    };
}

const accrue = (db: Db, orderId = ORDER_ID, total = 2000) =>
    accrueOrderCommission(makeAdmin(db), {
        orderId, promoCode: 'ПОДОTABB', orderTotal: total, partnerId: PARTNER_ID,
    });

describe('скасування знімає й менеджерську комісію', () => {
    it('нарахування переходить у cancelled, а total_earned перераховується', async () => {
        const db = makeDb();
        await accrue(db);
        expect(db.sales_commissions).toHaveLength(1);
        expect(db.sales_managers[MANAGER_ID].total_earned).toBe(20);   // 1% від 2000

        const taken = await reverseSalesCommission(makeAdmin(db), { orderId: ORDER_ID });

        expect(taken).toBe(20);
        expect(db.sales_commissions[0].status).toBe('cancelled');
        // Головне: сума в кабінеті сходить до нуля сама, з журналу.
        expect(db.sales_managers[MANAGER_ID].total_earned).toBe(0);
    });

    it('повторне скасування не знімає нічого вдруге', async () => {
        const db = makeDb();
        await accrue(db);
        await reverseSalesCommission(makeAdmin(db), { orderId: ORDER_ID });
        const second = await reverseSalesCommission(makeAdmin(db), { orderId: ORDER_ID });
        expect(second).toBe(0);
        expect(db.sales_managers[MANAGER_ID].total_earned).toBe(0);
    });

    it('виплачене нарахування лишається недоторканим', async () => {
        // Повертати гроші, які вже пішли людині, скрипт не має права.
        const db = makeDb();
        await accrue(db);
        db.sales_commissions[0].status = 'paid';
        recalc(db, MANAGER_ID);

        const taken = await reverseSalesCommission(makeAdmin(db), { orderId: ORDER_ID });

        expect(taken).toBe(0);
        expect(db.sales_commissions[0].status).toBe('paid');
        expect(db.sales_managers[MANAGER_ID].total_earned).toBe(20);
        expect(db.sales_managers[MANAGER_ID].total_paid).toBe(20);
    });

    it('нарахування за тариф памʼяті не зачіпається', async () => {
        // Інший вид нарахування з власним source_id: збіг ідентифікаторів не
        // має знімати чужі гроші.
        const db = makeDb();
        db.sales_commissions.push({
            manager_id: MANAGER_ID, kind: 'gallery', source_id: ORDER_ID,
            base_amount: 500, rate: 5, amount: 25, status: 'pending',
        });
        recalc(db, MANAGER_ID);

        const taken = await reverseSalesCommission(makeAdmin(db), { orderId: ORDER_ID });

        expect(taken).toBe(0);
        expect(db.sales_commissions[0].status).toBe('pending');
        expect(db.sales_managers[MANAGER_ID].total_earned).toBe(25);
    });

    it('чуже замовлення лишається цілим', async () => {
        const db = makeDb();
        await accrue(db, 'o-1', 2000);
        await accrue(db, 'o-2', 1000);
        expect(db.sales_managers[MANAGER_ID].total_earned).toBe(30);

        await reverseSalesCommission(makeAdmin(db), { orderId: 'o-1' });

        expect(db.sales_commissions.find(c => c.source_id === 'o-2').status).toBe('pending');
        expect(db.sales_managers[MANAGER_ID].total_earned).toBe(10);
    });
});

describe('нарахування лишається цілим', () => {
    it('звичайне замовлення дає менеджеру відсоток і оновлює зведення', async () => {
        const db = makeDb();
        const r = await accrue(db, ORDER_ID, 2000);
        expect(r.amount).toBe(20);
        expect(r.managerId).toBe(MANAGER_ID);
        expect(db.sales_commissions[0].status).toBe('pending');
        expect(db.sales_managers[MANAGER_ID].total_earned).toBe(20);
    });

    it('повторний вебхук за тим самим замовленням не подвоює', async () => {
        const db = makeDb();
        await accrue(db, ORDER_ID, 2000);
        const again = await accrue(db, ORDER_ID, 2000);
        expect(again.amount).toBe(0);
        expect(db.sales_commissions).toHaveLength(1);
        expect(db.sales_managers[MANAGER_ID].total_earned).toBe(20);
    });

    it('два одночасні нарахування не губляться одне в одному', async () => {
        // Саме це втрачалося при читанні-записі назад: обидва вебхуки читали ту
        // саму колонку і писали ту саму суму, тож одне нарахування зникало.
        const db = makeDb();
        await Promise.all([accrue(db, 'o-1', 2000), accrue(db, 'o-2', 1000)]);
        expect(db.sales_commissions).toHaveLength(2);
        expect(db.sales_managers[MANAGER_ID].total_earned).toBe(30);
    });

    it('неактивний менеджер нічого не отримує', async () => {
        const db = makeDb();
        db.sales_managers[MANAGER_ID].is_active = false;
        const r = await accrue(db);
        expect(r.amount).toBe(0);
        expect(db.sales_commissions).toHaveLength(0);
    });
});

describe('зведення похідне від журналу', () => {
    it('перерахунок прибирає зняте із «зароблено» і з «виплачено»', async () => {
        const db = makeDb();
        await accrue(db, 'o-1', 2000);   // 20, pending
        await accrue(db, 'o-2', 1000);   // 10, pending
        db.sales_commissions[1].status = 'paid';
        await syncManagerTotals(makeAdmin(db), MANAGER_ID);
        expect(db.sales_managers[MANAGER_ID].total_earned).toBe(30);
        expect(db.sales_managers[MANAGER_ID].total_paid).toBe(10);

        db.sales_commissions[0].status = 'cancelled';
        await syncManagerTotals(makeAdmin(db), MANAGER_ID);
        expect(db.sales_managers[MANAGER_ID].total_earned).toBe(10);
        expect(db.sales_managers[MANAGER_ID].total_paid).toBe(10);
    });

    it('кабінет не рахує знятого в «Зароблено всього»', () => {
        // Та сама умова, що в /api/sales/me: фільтр по статусу замість «всі».
        const rows = [
            { amount: 20, status: 'pending' },
            { amount: 10, status: 'paid' },
            { amount: 50, status: 'cancelled' },
        ];
        const sum = (f: (r: any) => boolean) => rows.filter(f).reduce((s, r) => s + Number(r.amount || 0), 0);
        const live = (r: any) => r.status !== 'cancelled';

        expect(sum(live)).toBe(30);
        expect(sum(r => r.status === 'pending')).toBe(20);
        expect(sum(r => r.status === 'paid')).toBe(10);
        // Рядок нікуди не подівся — він видимий, просто не в грошах.
        expect(rows).toHaveLength(3);
    });
});
