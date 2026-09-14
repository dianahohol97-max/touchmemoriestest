import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/guards';
import { getAdminClient } from '@/lib/supabase/admin';
import { fetchKeycrmOrderById } from '@/lib/automation/keycrm';

export const dynamic = 'force-dynamic';
// Один запит до KeyCRM на замовлення, а замовлень під сотню — п'ять хвилин
// із запасом, бо шістдесяти секунд на таке не вистачає.
export const maxDuration = 300;

/**
 * GET /api/admin/keycrm/delivered-at-backfill
 *
 * Разовий прохід: замінити дати доставки, які звірка проставила «зараз»,
 * справжнім моментом переходу стадії з KeyCRM.
 *
 * НАВІЩО. До 14.09.2026 звірка ставила delivered_at і shipped_at моментом
 * власного запуску. Поки вона бачила кожне замовлення щопівгодини від самого
 * створення, різниця була хвилини. Того вечора черга вперше пішла за
 * давністю звірки, дісталася замовлень, яких не звіряли тижнями, і за дві
 * години поставила дату доставки 59 замовленням — усім одним вечором.
 * Замовлення від 28 липня дістало «доставлено 14 вересня, 20:30». Код уже
 * виправлено (lib/automation/keycrm-twoway), але вже проставлені дати від
 * цього не полагодяться — їх переписує оцей прохід.
 *
 * ПРАВИЛО ЗАМІНИ — ТІЛЬКИ НАЗАД У ЧАСІ. Дата з CRM ставиться лише тоді, коли
 * вона РАНІША за наявну більш ніж на добу. Це не обережність заради
 * обережності: наявна дата в зіпсованих випадках — момент звірки, а він
 * завжди ПІЗНІШИЙ за справжню доставку, тож виправлення завжди йде назад.
 * Дата, яку хтось поставив руками або яку записало відстеження Нової Пошти
 * у момент самої доставки, від цього захищена: рухати її вперед прохід не
 * вміє взагалі.
 *
 * ЩО ПОКАЗУЄ. Без параметрів — нічого не пише, лише показує таблицю: що
 * стоїть зараз, що каже CRM, на скільки діб розходження. Запис відбувається
 * тільки з ?apply=1.
 *
 * Параметри:
 *   ?apply=1   записати (без нього — тільки показ)
 *   ?limit=N   скільки замовлень взяти (типово 200)
 */

/** Наскільки має розходитися дата, щоб її взагалі чіпати. */
const MIN_GAP_HOURS = 24;

type Row = {
    order_number: string;
    card: string;
    stage: string;
    site_delivered_at: string;
    crm_status_changed_at: string | null;
    gap_days: number | null;
    action: 'rewrite' | 'keep' | 'no-crm-date' | 'card-missing';
};

export async function GET(req: Request) {
    const guard = await requireAdmin();
    if (!guard.ok) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const url = new URL(req.url);
    const apply = url.searchParams.get('apply') === '1';
    const limit = Math.min(Number(url.searchParams.get('limit')) || 200, 500);

    const supabase = getAdminClient();

    // Сторінками, а не однією вибіркою: orders — одна з таблиць, де PostgREST
    // мовчки віддає тисячу рядків замість правди (готча 14 у CLAUDE.md).
    const orders: any[] = [];
    const PAGE = 200;
    for (let from = 0; from < limit; from += PAGE) {
        const { data, error } = await supabase
            .from('orders')
            .select('id, order_number, delivered_at, custom_attributes')
            .neq('source', 'keycrm')
            .not('custom_attributes->keycrm->>order_id', 'is', null)
            .not('delivered_at', 'is', null)
            .order('delivered_at', { ascending: false })
            .range(from, Math.min(from + PAGE, limit) - 1);

        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        orders.push(...(data || []));
        if (!data || data.length < PAGE) break;
    }

    const rows: Row[] = [];
    let rewritten = 0;
    const problems: string[] = [];

    for (const order of orders) {
        const card = String((order.custom_attributes as any)?.keycrm?.order_id || '');
        const siteDate = String(order.delivered_at);

        let crm: any = null;
        try {
            crm = await fetchKeycrmOrderById(card);
        } catch (e: any) {
            problems.push(`${order.order_number}: ${e?.message || e}`);
            continue;
        }

        if (!crm) {
            rows.push({
                order_number: order.order_number, card, stage: '', site_delivered_at: siteDate,
                crm_status_changed_at: null, gap_days: null, action: 'card-missing',
            });
            continue;
        }

        const crmDate = String(crm.status_changed_at || '').trim();
        if (!crmDate) {
            rows.push({
                order_number: order.order_number, card, stage: crm.status_label, site_delivered_at: siteDate,
                crm_status_changed_at: null, gap_days: null, action: 'no-crm-date',
            });
            continue;
        }

        const gapMs = new Date(siteDate).getTime() - new Date(crmDate).getTime();
        const gapDays = Math.round((gapMs / 86400000) * 10) / 10;

        // Тільки назад і тільки суттєво: вперед прохід не рухає нічого.
        if (gapMs <= MIN_GAP_HOURS * 3600 * 1000) {
            rows.push({
                order_number: order.order_number, card, stage: crm.status_label, site_delivered_at: siteDate,
                crm_status_changed_at: crmDate, gap_days: gapDays, action: 'keep',
            });
            continue;
        }

        rows.push({
            order_number: order.order_number, card, stage: crm.status_label, site_delivered_at: siteDate,
            crm_status_changed_at: crmDate, gap_days: gapDays, action: 'rewrite',
        });

        if (apply) {
            const { error } = await supabase
                .from('orders')
                .update({ delivered_at: new Date(crmDate).toISOString() })
                .eq('id', order.id);
            if (error) problems.push(`${order.order_number}: запис не вдався — ${error.message}`);
            else rewritten++;
        }
    }

    const toRewrite = rows.filter(r => r.action === 'rewrite');

    return NextResponse.json({
        ok: true,
        mode: apply ? 'записано' : 'тільки показ, нічого не записано',
        checked: rows.length,
        to_rewrite: toRewrite.length,
        rewritten,
        // Найбільше розходження першим — там найгучніша брехня.
        preview: toRewrite.sort((a, b) => (b.gap_days || 0) - (a.gap_days || 0)),
        untouched: rows.filter(r => r.action !== 'rewrite'),
        problems,
    });
}
