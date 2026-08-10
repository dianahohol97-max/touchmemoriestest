import { NextResponse } from 'next/server';
import { pushOrderToKeycrm, findUnsyncedOrders } from '@/lib/automation/keycrm-push';

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

export async function GET(request: Request) {
    const auth = request.headers.get('authorization');
    if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const dryRun = new URL(request.url).searchParams.get('dry') === '1';

    const stats = { candidates: 0, created: 0, alreadySynced: 0, skipped: 0, errors: 0 };
    const details: any[] = [];

    if (!String(process.env.KEYCRM_SYNC_FROM || '').trim()) {
        return NextResponse.json({
            ok: true,
            stats,
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

        return NextResponse.json({ ok: true, dryRun, stats, details });

    } catch (err: any) {
        console.error('[keycrm-sync] Fatal error:', err);
        return NextResponse.json({ error: err.message, stats }, { status: 500 });
    }
}
