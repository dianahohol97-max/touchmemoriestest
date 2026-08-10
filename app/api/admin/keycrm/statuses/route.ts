import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/guards';
import { getAdminClient } from '@/lib/supabase/admin';
import { fetchKeycrmStatuses } from '@/lib/automation/keycrm';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Translate KeyCRM pipeline stages into website order statuses.
 *
 * GET  — the account's stages, the mapping saved so far, and the website
 *        statuses available to map onto.
 * POST — `{ rows: [{ keycrm_status_id, keycrm_status_name, site_order_status,
 *        direction }] }`.
 *
 * Nothing here is guessed. An unmapped stage leaves the website order untouched,
 * because inferring that a stage called "Готово" means shipped would send a
 * customer a tracking email for a parcel still sitting on the desk.
 */

// The statuses the website itself understands, in lifecycle order.
const SITE_STATUSES = [
    'new',
    'confirmed',
    'in_production',
    'quality_check',
    'ready',
    'shipped',
    'delivered',
    'cancelled',
    'refunded',
];

const DIRECTIONS = ['from_crm', 'to_crm', 'both'];

export async function GET() {
    const guard = await requireAdmin();
    if (!guard.ok) return guard.response;

    const supabase = getAdminClient();
    const { data: saved } = await supabase
        .from('keycrm_status_map')
        .select('keycrm_status_id, keycrm_status_name, site_order_status, direction');

    if (!process.env.KEYCRM_API_TOKEN) {
        return NextResponse.json({
            site_statuses: SITE_STATUSES,
            crm_statuses: [],
            saved: saved || [],
            error: 'KEYCRM_API_TOKEN не заданий.',
        });
    }

    try {
        const crmStatuses = await fetchKeycrmStatuses();
        return NextResponse.json({
            site_statuses: SITE_STATUSES,
            crm_statuses: crmStatuses,
            saved: saved || [],
        });
    } catch (e: any) {
        return NextResponse.json({
            site_statuses: SITE_STATUSES,
            crm_statuses: [],
            saved: saved || [],
            error: e?.message || 'Не вдалося прочитати статуси з KeyCRM',
        });
    }
}

export async function POST(request: Request) {
    const guard = await requireAdmin();
    if (!guard.ok) return guard.response;

    let body: any;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const rows = Array.isArray(body?.rows) ? body.rows : [];

    // Validated rather than trusted: a typo in site_order_status would write a
    // status the website does not understand into live orders, and the order
    // pages would render it as an unknown state.
    const clean: Array<Record<string, string>> = [];
    for (const row of rows) {
        const statusId = String(row?.keycrm_status_id ?? '').trim();
        const siteStatus = String(row?.site_order_status ?? '').trim();
        const direction = String(row?.direction ?? 'from_crm').trim();

        if (!statusId || !siteStatus) continue;
        if (!SITE_STATUSES.includes(siteStatus)) {
            return NextResponse.json(
                { error: `Статус сайту «${siteStatus}» не існує. Доступні: ${SITE_STATUSES.join(', ')}` },
                { status: 400 },
            );
        }
        if (!DIRECTIONS.includes(direction)) {
            return NextResponse.json(
                { error: `Напрям «${direction}» не існує. Доступні: ${DIRECTIONS.join(', ')}` },
                { status: 400 },
            );
        }

        clean.push({
            keycrm_status_id: statusId,
            keycrm_status_name: String(row?.keycrm_status_name ?? ''),
            site_order_status: siteStatus,
            direction,
            updated_at: new Date().toISOString(),
        });
    }

    if (!clean.length) {
        return NextResponse.json({ error: 'Немає рядків для збереження.' }, { status: 400 });
    }

    const supabase = getAdminClient();
    const { error } = await supabase
        .from('keycrm_status_map')
        .upsert(clean, { onConflict: 'keycrm_status_id' });

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, saved: clean.length });
}
