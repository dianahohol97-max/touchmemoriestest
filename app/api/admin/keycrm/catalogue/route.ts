import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/guards';
import { reconcileCatalogues, saveMappings } from '@/lib/automation/keycrm-catalogue';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Reconcile the website catalogue against KeyCRM's.
 *
 * GET  — returns every website product with its proposed CRM counterpart, the
 *        score behind the proposal, the runners-up it beat, and the CRM offers
 *        nothing pointed at. Read-only: it proposes, it never decides.
 *
 * POST — stores decisions: `{ rows: [{ site_slug, keycrm_offer_id, keycrm_sku,
 *        keycrm_name, confirmed: true }] }`. Only confirmed rows are used when
 *        an order is pushed, so nothing is attached to a CRM product until a
 *        person has agreed it is the same thing.
 */

export async function GET() {
    const guard = await requireAdmin();
    if (!guard.ok) return guard.response;

    if (!process.env.KEYCRM_API_TOKEN) {
        return NextResponse.json({ error: 'KEYCRM_API_TOKEN не заданий.' }, { status: 400 });
    }

    try {
        const report = await reconcileCatalogues();
        return NextResponse.json(report);
    } catch (e: any) {
        return NextResponse.json({ error: e?.message || 'Звірка не вдалася' }, { status: 502 });
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
    const clean = rows.filter((r: any) => typeof r?.site_slug === 'string' && r.site_slug.trim());

    if (!clean.length) {
        return NextResponse.json({ error: 'Немає рядків для збереження.' }, { status: 400 });
    }

    try {
        const result = await saveMappings(clean);
        return NextResponse.json({ ok: true, ...result });
    } catch (e: any) {
        return NextResponse.json({ error: e?.message || 'Не вдалося зберегти відповідності' }, { status: 500 });
    }
}
