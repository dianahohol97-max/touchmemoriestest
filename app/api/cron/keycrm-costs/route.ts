import { NextResponse } from 'next/server';
import { syncCostPrices } from '@/lib/automation/keycrm-catalogue';
import { syncPhotobookCosts } from '@/lib/automation/keycrm-photobooks';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Keep website product costs in step with KeyCRM, once a day.
 *
 * Costs change when suppliers change, and a stale cost is invisible: the margin
 * on the admin order card still renders, it is just wrong. A nightly pull keeps
 * the number honest without anyone remembering to press a button.
 *
 * Only confirmed catalogue mappings are followed, and a product whose sizes
 * report different costs is left alone and reported rather than guessed at.
 *
 * Auth: Vercel Cron sends `Authorization: Bearer $CRON_SECRET` automatically.
 * Add `?dry=1` to preview the changes without writing them.
 */
export async function GET(request: Request) {
    const auth = request.headers.get('authorization');
    if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!process.env.KEYCRM_API_TOKEN) {
        return NextResponse.json({ ok: true, skipped: 'KEYCRM_API_TOKEN не заданий.' });
    }

    const dryRun = new URL(request.url).searchParams.get('dry') === '1';

    try {
        const report = await syncCostPrices({ dryRun });

        if (report.conflicts.length) {
            console.warn('[keycrm-costs] size costs disagree, left untouched:', report.conflicts);
        }

        // Photobooks are priced by a matrix the map cannot express, so their
        // costs come from their own sync (size × pages). Never blocks the
        // main report — a CRM hiccup on photobooks must not cost every other
        // product its nightly cost update.
        let photobooks: any = null;
        if (!dryRun) {
            try {
                photobooks = await syncPhotobookCosts();
                console.log('[keycrm-costs] photobooks', JSON.stringify({
                    products: photobooks.products_read,
                    rows: photobooks.rows_written,
                    mismatches: photobooks.price_mismatches.length,
                    problems: photobooks.problems.length,
                }));
            } catch (e: any) {
                console.error('[keycrm-costs] photobook sync failed:', e);
            }
        }

        return NextResponse.json({ ok: true, ...report, photobooks });
    } catch (e: any) {
        console.error('[keycrm-costs] Fatal error:', e);
        return NextResponse.json({ error: e?.message }, { status: 500 });
    }
}
