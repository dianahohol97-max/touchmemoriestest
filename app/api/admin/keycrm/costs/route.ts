import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/guards';
import { syncCostPrices } from '@/lib/automation/keycrm-catalogue';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Pull purchase costs from KeyCRM into the website product cards.
 *
 * GET  — dry run. Lists exactly which products would change and from what to
 *        what, which sizes disagree with each other, and which mapped CRM items
 *        carry no cost at all. Writes nothing.
 * POST — applies the same thing.
 *
 * Costs only travel along confirmed catalogue mappings, and only when every
 * size of a product agrees. See syncCostPrices for why.
 */

export async function GET() {
    const guard = await requireAdmin();
    if (!guard.ok) return guard.response;

    try {
        return NextResponse.json(await syncCostPrices({ dryRun: true }));
    } catch (e: any) {
        return NextResponse.json({ error: e?.message || 'Не вдалося прочитати собівартість' }, { status: 502 });
    }
}

export async function POST() {
    const guard = await requireAdmin();
    if (!guard.ok) return guard.response;

    try {
        return NextResponse.json(await syncCostPrices({ dryRun: false }));
    } catch (e: any) {
        return NextResponse.json({ error: e?.message || 'Не вдалося оновити собівартість' }, { status: 502 });
    }
}
