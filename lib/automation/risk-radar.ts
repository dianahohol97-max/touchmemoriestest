import { getAdminClient } from '@/lib/supabase/admin';
import { isTestOrder } from '@/lib/automation/test-orders';
import { isVisibleProductionOrder, PRODUCTION_ACTIVE_STATUSES } from '@/lib/automation/production-visibility';

/**
 * The three things that go wrong quietly, computed from live state.
 *
 * Diana picked these (2026-08-11) out of a longer list: stock about to run
 * out, deadlines about to be missed, and orders sitting idle because the
 * customer never sent the photos. All three share a shape — nothing is
 * broken YET, so nothing shows up on any board, and by the time it does the
 * cost is already paid.
 *
 * Everything reads the same sources the rest of the system uses: KeyCRM
 * stock mirrored onto the catalogue map, order deadlines resolved by the
 * production rules, and order_files for what the customer actually sent.
 */

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

async function readSetting(supabase: any, key: string, fallback: number): Promise<number> {
    const { data } = await supabase.from('settings').select('value').eq('key', key).maybeSingle();
    const parsed = parseFloat(String(data?.value ?? ''));
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

export type LowStockItem = {
    name: string;
    variant: string;
    stock: number;
    /** Active orders that mention this product — «7 лишилось, а 3 в роботі». */
    inWork: number;
};

/**
 * Materials the CRM says are running out. Only CONFIRMED pairs carry a real
 * quantity, and only products that behave like consumables are interesting:
 * a photobook is made to order and its «stock» means nothing.
 */
export async function computeLowStock(): Promise<{ items: LowStockItem[]; threshold: number }> {
    const supabase = getAdminClient();
    const threshold = await readSetting(supabase, 'keycrm_low_stock_threshold', 10);

    const { data: rows } = await supabase
        .from('keycrm_product_map')
        .select('site_product_name, site_variant_label, crm_stock, site_slug')
        .eq('confirmed', true)
        .not('crm_stock', 'is', null)
        .lte('crm_stock', threshold)
        .order('crm_stock', { ascending: true });

    if (!rows?.length) return { items: [], threshold };

    // How many orders in production mention each of these — a low count with
    // nothing in work can wait for the next supplier run, the same count with
    // three orders on it cannot.
    const { data: orders } = await supabase
        .from('orders')
        .select('items, order_status, source, customer_name, created_at, custom_attributes')
        .in('order_status', PRODUCTION_ACTIVE_STATUSES)
        .gte('created_at', new Date(Date.now() - 60 * DAY_MS).toISOString())
        .limit(400);

    const activeItems: string[] = [];
    for (const o of orders || []) {
        if (isTestOrder(o as any) || !isVisibleProductionOrder(o as any)) continue;
        for (const it of (Array.isArray(o.items) ? o.items : [])) {
            const name = String(it?.product_name || it?.name || '').toLowerCase();
            if (name) activeItems.push(name);
        }
    }

    const items: LowStockItem[] = rows.map((r: any) => {
        const label = String(r.site_product_name || r.site_slug || '');
        const key = label.toLowerCase().split('(')[0].trim();
        const inWork = key ? activeItems.filter(n => n.includes(key) || key.includes(n)).length : 0;
        return {
            name: label,
            variant: r.site_variant_label || '',
            stock: Number(r.crm_stock),
            inWork,
        };
    });

    return { items, threshold };
}

export type DeadlineRisk = {
    orderNumber: string;
    customer: string;
    deadline: string;
    daysLeft: number;
    stage: string;
    reason: string;
};

/**
 * Deadlines that are still ahead but already unlikely.
 *
 * The rule comes from how the shop actually produces: a photobook needs the
 * layout approved before print, and print itself takes days. So an order
 * whose deadline is close while its CRM stage still says «прийнято» or
 * «в роботі» — nothing handed to print — is the one that slips. Orders
 * already past their deadline are the overdue list and are not repeated here.
 */
export async function computeDeadlineRisks(): Promise<DeadlineRisk[]> {
    const supabase = getAdminClient();
    const horizonDays = await readSetting(supabase, 'deadline_risk_days', 4);
    const now = Date.now();

    const { data } = await supabase
        .from('orders')
        .select('order_number, customer_name, deadline, order_status, source, created_at, custom_attributes, items')
        .gte('deadline', new Date(now).toISOString())
        .lte('deadline', new Date(now + horizonDays * DAY_MS).toISOString())
        .in('order_status', PRODUCTION_ACTIVE_STATUSES)
        .order('deadline', { ascending: true })
        .limit(200);

    const risks: DeadlineRisk[] = [];
    for (const o of data || []) {
        if (isTestOrder(o as any) || !isVisibleProductionOrder(o as any)) continue;

        const stage = String((o as any)?.custom_attributes?.keycrm?.status_label || '').trim();
        const stageLower = stage.toLowerCase();
        const daysLeft = Math.max(0, Math.round((new Date(o.deadline).getTime() - now) / DAY_MS));

        // Stages that mean the work has physically left the design desk. An
        // order in one of them is on track by definition, however close its
        // deadline is.
        const handedOver = /друк|печат|виготовл|готов|пакув|відправ|дорозі|доставлен|отриман|completed|in_transit|delivered/i.test(stageLower);
        if (handedOver) continue;

        const printStartedAt = (o as any)?.custom_attributes?.keycrm?.print_started_at;
        if (printStartedAt) continue;

        risks.push({
            orderNumber: o.order_number,
            customer: o.customer_name || 'без імені',
            deadline: o.deadline,
            daysLeft,
            stage: stage || 'без стадії',
            reason: daysLeft <= 1
                ? 'дедлайн завтра, а в друк ще не передано'
                : `${daysLeft} дн до дедлайну, ще не в друці`,
        });
    }
    return risks;
}

export type WaitingForClient = {
    orderNumber: string;
    customer: string;
    paidDaysAgo: number;
    deadline: string | null;
};

/**
 * Paid orders with nothing to produce from.
 *
 * The customer paid, the deadline clock is running, and no photos ever
 * arrived — the order looks healthy on every board while it is in fact
 * blocked. Files count as arrived when order_files holds an upload for the
 * order (that is where both the constructor's exports and the customer's
 * material land).
 */
export async function computeWaitingForClient(): Promise<WaitingForClient[]> {
    const supabase = getAdminClient();
    const graceDays = await readSetting(supabase, 'waiting_files_days', 2);
    const now = Date.now();

    const { data: orders } = await supabase
        .from('orders')
        .select('id, order_number, customer_name, paid_at, deadline, order_status, source, created_at, custom_attributes, with_designer')
        .eq('payment_status', 'paid')
        .in('order_status', PRODUCTION_ACTIVE_STATUSES)
        .gte('paid_at', new Date(now - 45 * DAY_MS).toISOString())
        .lte('paid_at', new Date(now - graceDays * DAY_MS).toISOString())
        .order('paid_at', { ascending: true })
        .limit(200);

    const candidates = (orders || []).filter(o => !isTestOrder(o as any) && isVisibleProductionOrder(o as any));
    if (!candidates.length) return [];

    const { data: files } = await supabase
        .from('order_files')
        .select('order_id')
        .in('order_id', candidates.map(o => o.id));
    const withFiles = new Set((files || []).map((f: any) => f.order_id));

    return candidates
        .filter(o => !withFiles.has(o.id))
        .map(o => ({
            orderNumber: o.order_number,
            customer: o.customer_name || 'без імені',
            paidDaysAgo: Math.max(1, Math.round((now - new Date(o.paid_at).getTime()) / DAY_MS)),
            deadline: o.deadline,
        }));
}
