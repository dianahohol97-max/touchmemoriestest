import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/guards';
import { fetchKeycrmSources } from '@/lib/automation/keycrm';
import { pushOrderToKeycrm } from '@/lib/automation/keycrm-push';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Admin-side controls for the KeyCRM order sync.
 *
 * GET  — lists the account's order sources with their ids, plus the current
 *        configuration. Creating an order requires a numeric source_id that is
 *        specific to the account, and this is how that number gets found once
 *        during setup instead of being guessed.
 *
 * POST — pushes a single order on demand. `{ orderId, dryRun: true }` returns
 *        the exact body that would be sent without touching the CRM, which is
 *        how the mapping should be checked before the scheduled sync is turned
 *        on for everything.
 */

export async function GET() {
    const guard = await requireAdmin();
    if (!guard.ok) return guard.response;

    const config = {
        token_configured: Boolean(process.env.KEYCRM_API_TOKEN),
        sync_enabled: String(process.env.KEYCRM_SYNC_ENABLED || '').toLowerCase() === 'true',
        sync_from: process.env.KEYCRM_SYNC_FROM || null,
        source_id: process.env.KEYCRM_SOURCE_ID || null,
        payment_method_id: process.env.KEYCRM_PAYMENT_METHOD_ID || null,
        delivery_service_id: process.env.KEYCRM_DELIVERY_SERVICE_ID || null,
    };

    if (!config.token_configured) {
        return NextResponse.json({ config, sources: [], error: 'KEYCRM_API_TOKEN не заданий.' });
    }

    try {
        const sources = await fetchKeycrmSources();
        return NextResponse.json({ config, sources });
    } catch (e: any) {
        return NextResponse.json({ config, sources: [], error: e?.message || 'Запит до KeyCRM не вдався' });
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

    const orderId = String(body?.orderId || '').trim();
    if (!orderId) {
        return NextResponse.json({ error: 'orderId is required' }, { status: 400 });
    }

    const result = await pushOrderToKeycrm(orderId, { dryRun: body?.dryRun === true });
    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
