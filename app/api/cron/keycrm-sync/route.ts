import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/guards';
import { pushOrderToKeycrm, findUnsyncedOrders } from '@/lib/automation/keycrm-push';
import { syncOrderBothWays, findSyncedOrders } from '@/lib/automation/keycrm-twoway';
import { applyStockForOrder, findOrdersNeedingStock } from '@/lib/automation/stock';
import { enqueueDefectsFromTags } from '@/lib/automation/reprints';
import { resolvePendingProductLinks, syncSkusToKeycrm, syncCostPrices } from '@/lib/automation/keycrm-catalogue';
import { pushInstructionCommentsToCrm } from '@/lib/automation/keycrm-comments';
import { getAdminClient } from '@/lib/supabase/admin';
import { resolveOrderDeadline } from '@/lib/automation/deadline-resolver';
import { fetchProductTermsBySlug } from '@/lib/automation/product-terms';
import { isTestOrder } from '@/lib/automation/test-orders';

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
    // Two ways in: Vercel Cron with the bearer secret, or a logged-in admin
    // opening the URL in a browser. The second exists so a run can be triggered
    // and inspected by a person without hunting for CRON_SECRET — the response
    // is the full report either way.
    const auth = request.headers.get('authorization');
    const cronOk = !!process.env.CRON_SECRET && auth === `Bearer ${process.env.CRON_SECRET}`;
    if (!cronOk) {
        const guard = await requireAdmin();
        if (!guard.ok) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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

        // The response body is the full report, but nobody reads a cron's
        // response — Vercel only keeps what lands in the logs. TM-001175 sat
        // unpushed for a whole night while every run answered 200: the skip
        // reason was in the JSON and nowhere else. Stats and per-order reasons
        // now always land in the log.
        console.log('[keycrm-sync] stats', JSON.stringify(stats));
        if (details.length) console.log('[keycrm-sync] details', JSON.stringify(details.slice(0, 10)));

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

        // Catalogue upkeep, only when there is actually something to do — the
        // guards are one cheap DB count each, so an idle run costs no CRM
        // requests at all.
        //
        // 1. Pending manual links: a KeyCRM number pasted where the CRM API was
        //    not reachable (chat) or not yet resolvable (old admin saves) sits
        //    unconfirmed until this resolves it against the live catalogue —
        //    fanning a product id out across all its sizes.
        // 2. SKUs: confirmed pairs whose CRM offer has no article number get
        //    the site slug written in, because the order API links lines to the
        //    catalogue by SKU alone.
        // 3. Costs: freshly confirmed pairs pull their закупівельна вартість
        //    onto the site right away instead of waiting for the nightly run.
        let catalogue: any = null;
        try {
            const supabase = getAdminClient();
            const { count: pendingLinks } = await supabase
                .from('keycrm_product_map')
                .select('id', { count: 'exact', head: true })
                .eq('confirmed', false)
                .eq('match_type', 'manual')
                .not('keycrm_offer_id', 'is', null);

            if ((pendingLinks || 0) > 0) {
                const links = await resolvePendingProductLinks();
                catalogue = { links };
                if (links.resolved > 0 && !dryRun) {
                    const skus = await syncSkusToKeycrm({ dryRun: false });
                    const costs = await syncCostPrices({ dryRun: false });
                    catalogue = {
                        links,
                        skus: { filled: skus.filled.length, adopted: skus.adopted.length, problems: skus.problems },
                        costs: { updated: costs.updated_products.length, per_size: costs.updated_variants.length, conflicts: costs.conflicts.length },
                    };
                }
                console.log('[keycrm-sync] catalogue', JSON.stringify(catalogue));
            }
        } catch (e: any) {
            console.error('[keycrm-sync] catalogue upkeep failed:', e);
            stats.errors++;
        }

        // Deadline recalibration for EVERY active order, every run (Diana,
        // 2026-08-11: «переконайся що всі дедлайни перераховані відповідно»,
        // after CRM-13510 sat on an 8-day fallback while being a 14-day
        // photobook). The hourly mirror only refreshes the newest ~300 CRM
        // orders, so rule changes never reached the older tail. This pass is
        // pure DB work — no CRM calls — and skips dates a person pinned
        // (deadline_locked) and test orders.
        try {
            const termsMap = await fetchProductTermsBySlug();
            const { data: activeOrders } = await getAdminClient()
                .from('orders')
                .select('id, order_number, customer_name, created_at, paid_at, deadline, notes, client_comment, items, custom_attributes, order_status')
                .in('order_status', ['new', 'confirmed', 'in_production', 'quality_check'])
                .order('created_at', { ascending: false })
                .limit(400);

            let recalced = 0;
            for (const o of activeOrders || []) {
                if (isTestOrder(o as any)) continue;
                const attrs = (o.custom_attributes && typeof o.custom_attributes === 'object')
                    ? o.custom_attributes as Record<string, any>
                    : {};
                if (attrs.deadline_locked) continue;

                const resolved = resolveOrderDeadline(o, { productTermsBySlug: termsMap });
                const current = o.deadline ? new Date(o.deadline).getTime() : null;
                if (current !== null && Math.abs(current - resolved.deadline.getTime()) <= 60 * 60 * 1000) continue;

                if (!dryRun) {
                    await getAdminClient()
                        .from('orders')
                        .update({ deadline: resolved.deadline.toISOString() })
                        .eq('id', o.id);
                }
                recalced++;
            }

            stats.deadlines_recalced = recalced;
            if (recalced) console.log(`[keycrm-sync] deadlines recalced: ${recalced}`);
        } catch (e: any) {
            console.error('[keycrm-sync] deadline recalibration failed:', e);
            stats.errors++;
        }

        // Chat instructions → CRM card comments. One write puts the
        // instruction where the managers work AND where the hourly mirror and
        // the deadline resolver read it back, so tightened dates survive every
        // refresh. Skips itself instantly when nothing is pending.
        let chatComments: any = null;
        try {
            if (!dryRun) {
                chatComments = await pushInstructionCommentsToCrm();
                if (chatComments.pushed || chatComments.problems.length) {
                    console.log('[keycrm-sync] chat comments', JSON.stringify(chatComments));
                }
            }
        } catch (e: any) {
            console.error('[keycrm-sync] chat comments failed:', e);
            stats.errors++;
        }

        // Photobook matrix sync, on demand. Two settings drive it so a human
        // stays in the loop with the editor's customer-facing prices:
        //   photobook_sync_requested = 'report' | 'apply' — one-shot, cleared
        //     after the run so a request never repeats by accident;
        //   'report' only fills costs and lists the differences, 'apply' also
        //     writes CRM prices into the printed-cover matrix (guarded, with
        //     every change recorded in photobook_price_changes).
        try {
            const supabase = getAdminClient();
            const { data: reqRow } = await supabase
                .from('settings').select('value').eq('key', 'photobook_sync_requested').maybeSingle();
            const mode = typeof reqRow?.value === 'string' ? reqRow.value : null;
            if (mode === 'report' || mode === 'apply') {
                const { syncPhotobookCosts } = await import('@/lib/automation/keycrm-photobooks');
                const pbReport = await syncPhotobookCosts({ applyPrices: mode === 'apply' });
                await supabase.from('settings').upsert({
                    key: 'photobook_sync_report',
                    value: { at: new Date().toISOString(), mode, ...pbReport },
                    updated_at: new Date().toISOString(),
                });
                await supabase.from('settings').upsert({
                    key: 'photobook_sync_requested',
                    value: '"done"',
                    updated_at: new Date().toISOString(),
                });
                console.log('[keycrm-sync] photobooks', JSON.stringify({
                    mode,
                    products: pbReport.products_read,
                    rows: pbReport.rows_written,
                    applied: pbReport.prices_applied.length,
                    held: pbReport.prices_held.length,
                }));
            }
        } catch (e: any) {
            console.error('[keycrm-sync] photobook sync failed:', e);
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

        return NextResponse.json({ ok: true, dryRun, stats, details, reconciled, stock, defects, catalogue, chat_comments: chatComments });

    } catch (err: any) {
        console.error('[keycrm-sync] Fatal error:', err);
        return NextResponse.json({ error: err.message, stats }, { status: 500 });
    }
}
