import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/guards';
import { syncLevelsFromKeycrm, stockMappingGaps } from '@/lib/automation/stock';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Level website stock against KeyCRM.
 *
 * GET  — dry run: which products would change, from what to what, which sizes
 *        disagree, and which products have no confirmed catalogue mapping yet.
 * POST — applies it.
 *
 * Deliberately NOT a cron. The site deducts stock for every order it counts —
 * its own and the mirrored Instagram ones — so a scheduled levelling would
 * overwrite every deduction made since the previous run and leave the balance
 * permanently one period too high. This is a correction a person runs when the
 * CRM figure is known to be the right one.
 */

export async function GET() {
    const guard = await requireAdmin();
    if (!guard.ok) return guard.response;

    if (!process.env.KEYCRM_API_TOKEN) {
        return NextResponse.json({ error: 'KEYCRM_API_TOKEN не заданий.' }, { status: 400 });
    }

    try {
        const [report, gaps] = await Promise.all([
            syncLevelsFromKeycrm({ dryRun: true }),
            stockMappingGaps(),
        ]);

        return NextResponse.json({ ...report, unmapped_products: gaps });
    } catch (e: any) {
        return NextResponse.json({ error: e?.message || 'Не вдалося прочитати залишки' }, { status: 502 });
    }
}

export async function POST() {
    const guard = await requireAdmin();
    if (!guard.ok) return guard.response;

    try {
        return NextResponse.json(await syncLevelsFromKeycrm({ dryRun: false }));
    } catch (e: any) {
        return NextResponse.json({ error: e?.message || 'Не вдалося оновити залишки' }, { status: 502 });
    }
}
