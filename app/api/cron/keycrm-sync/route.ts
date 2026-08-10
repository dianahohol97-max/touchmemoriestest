import { NextResponse } from 'next/server';
import { pushOrderToKeycrm, findUnsyncedOrders } from '@/lib/automation/keycrm-push';
import { syncOrderBothWays, findSyncedOrders } from '@/lib/automation/keycrm-twoway';
import { applyStockForOrder, findOrdersNeedingStock } from '@/lib/automation/stock';
import { enqueueDefectsFromTags } from '@/lib/automation/reprints';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Carry paid website orders into KeyCRM, so the manager stops re-typing them.
 *
 * Runs on a schedule rather than straight from the payment webhook on purpose.
 * A scheduled sweep retries by nature: an order that fails because the CRM was
 * down, or because the sync was still switched off, is simply picked up by the
 * next run. A webhook-only push would drop it silently and nobody would notice
 * until the order was missing from the CRM.
 *
 * Auth: Vercel Cron sends `Authorization: Bearer $CRON_SECRET` automatically.
 * Add `?dry=1` to see exactly what would be sent, without creating anything.
 */

// How far back a sweep looks. Generous on purpose: if the CRM is down for a few
// days, everything from that gap is still recovered on the next healthy run.
// The historical backlog is not protected by this number but by
// KEYCRM_SYNC_FROM — orders paid before that date were entered by hand and must
// never be pushed, because a hand-typed order carries no external reference for
// the duplicate guard to recognise.
const WINDOW_DAYS = 14;

// Keep one invocation well inside its time budget. Whatever is left over is
// picked up half an hour later.
const BATCH_LIMIT = 15;

// The reconcile pass reaches further back than the create pass: an order stays
// worth watching until it is delivered, which is weeks after it was placed.
const RECONCILE_WINDOW_DAYS = 45;

// One CRM read per order, so this is the real cost of the pass. Anything not
// covered this run is covered half an hour later.
const RECONCILE_LIMIT = 25;

// Stock is counted once per order and never again, so this pass only ever sees
// orders that arrived since the last run — the window is a safety net for
// downtime, not a workload.
const STOCK_WINDOW_DAYS = 30;
const STOCK_LIMIT = 40;

export async function GET(request: Request) {
    const auth = request.headers.get('authorization');
    if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const dryRun = new URL(request.url).searchParams.get('dry') === '1';

    const stats: Record<string, number> = { candidates: 0, created: 0, alreadySynced: 0, skipped: 0, reconciled: 0, stock_counted: 0, defects_enqueued: 0, errors: 0 };
    const details: any[] = [];

    // Stock first, and outside the CRM guard below. Taking what an order
    // consumed off the shelf needs nothing from KeyCRM — it reads the site's own
    // orders and the site's own balances. Leaving it behind that guard meant an
    // unconfigured sync date silently stopped stock being counted at all, which
    // is a far quieter failure than orders not transferring.
    const stock: any[] = [];
    try {
        const needStock = await findOrdersNeedingStock({ windowDays: STOCK_WINDOW_DAYS, limit: STOCK_LIMIT });

        for (const order of needStock) {
            const applied = await applyStockForOrder(order, { dryRun });
            if (applied.moved.length) {
                stats.stock_counted++;
                stock.push({ order: applied.orderNumber, moved: applied.moved, skipped: applied.skipped });
            } else if (applied.skipped.length) {
                stock.push({ order: applied.orderNumber, skipped: applied.skipped });
            }
        }
    } catch (e: any) {
        console.error('[keycrm-sync] stock pass failed:', e);
        stats.errors++;
    }

    if (!String(process.env.KEYCRM_SYNC_FROM || '').trim()) {
        return NextResponse.json({
            ok: true,
            stats,
            stock,
            note: 'KEYCRM_SYNC_FROM не заданий, тому синхронізація свідомо не переносить нічого. Постав дату старту, і з неї підуть лише нові замовлення.',
        });
    }

    try {
        const pending = await findUnsyncedOrders({ windowDays: WINDOW_DAYS, limit: BATCH_LIMIT });
        stats.candidates = pending.length;

        for (const order of pending) {
            const result = await pushOrderToKeycrm(order.id, { dryRun });

            if (result.status === 'created' || result.status === 'dry-run') stats.created++;
            else if (result.status === 'already-synced') stats.alreadySynced++;
            else if (result.status === 'skipped') stats.skipped++;
            else stats.errors++;

            if (result.status !== 'created') {
                details.push({
                    order: result.orderNumber,
                    status: result.status,
                    reason: result.reason,
                    ...(dryRun ? { payload: result.payload } : {}),
                });
            }

            // The first skip is almost always a configuration one (sync off, no
            // source id) and applies to every remaining order equally. Stopping
            // keeps the log readable instead of repeating the same line fifteen
            // times.
            if (result.status === 'skipped' && !dryRun && stats.created === 0) break;
        }

        // Second pass: orders already living in both systems. Money travels to
        // the CRM, fulfilment travels back to the site — see keycrm-twoway for
        // why the split is what stops the two sides overwriting each other.
        const reconciled: any[] = [];
        const synced = await findSyncedOrders({ windowDays: RECONCILE_WINDOW_DAYS, limit: RECONCILE_LIMIT });

        for (const order of synced) {
            const result = await syncOrderBothWays(order, { dryRun });
            if (!result) continue;

            if (result.changes.length) stats.reconciled++;
            if (result.problems.length) stats.errors++;

            if (result.changes.length || result.problems.length) {
                reconciled.push({
                    order: result.orderNumber,
                    changes: result.changes,
                    problems: result.problems,
                });
            }
        }

        // Fourth pass: open reprint-queue entries for freshly tagged defects.
        // Runs after the reconcile pass on purpose — that is what merges tags
        // down from the CRM, so a "брак" set there minutes ago is already on
        // the order by the time this scan reads it.
        let defects: any = null;
        try {
            defects = await enqueueDefectsFromTags({ windowDays: RECONCILE_WINDOW_DAYS, dryRun });
            stats.defects_enqueued = defects.enqueued.length;
        } catch (e: any) {
            console.error('[keycrm-sync] defect intake failed:', e);
            stats.errors++;
        }

        return NextResponse.json({ ok: true, dryRun, stats, details, reconciled, stock, defects });

    } catch (err: any) {
        console.error('[keycrm-sync] Fatal error:', err);
        return NextResponse.json({ error: err.message, stats }, { status: 500 });
    }
}
