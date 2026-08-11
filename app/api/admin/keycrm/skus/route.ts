import { NextResponse } from 'next/server';
import { requireStaff } from '@/lib/auth/guards';
import { syncSkusToKeycrm } from '@/lib/automation/keycrm-catalogue';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Write shared article numbers (SKUs) into KeyCRM for confirmed pairs.
 *
 * Why this exists: KeyCRM's order-create API links a product line to the
 * catalogue ONLY by SKU — the offer_id the push sends alongside is ignored.
 * Until the CRM offers carry SKUs, every pushed line is free text that moves
 * no stock and feeds no report. This writes the site slug as the SKU for every
 * confirmed pair whose CRM offer has none, and adopts the CRM's own SKU into
 * the map when one already exists. Never overwrites.
 *
 * GET          — dry run: shows what would be written, writes nothing.
 * GET ?apply=1 — writes for real. A mutating GET, deliberately: this is
 *                triggered from a browser by a person, same as the stock
 *                levelling, and staying one flag away from the dry run keeps
 *                the two runs comparable.
 */
export async function GET(request: Request) {
    const guard = await requireStaff();
    if (!guard.ok) return guard.response;

    if (!process.env.KEYCRM_API_TOKEN) {
        return NextResponse.json({ error: 'KEYCRM_API_TOKEN не заданий.' }, { status: 400 });
    }

    const apply = new URL(request.url).searchParams.get('apply') === '1';

    try {
        const report = await syncSkusToKeycrm({ dryRun: !apply });
        return NextResponse.json(report);
    } catch (e: any) {
        return NextResponse.json({ error: e?.message || 'Синхронізація артикулів не вдалася' }, { status: 502 });
    }
}
