import { NextResponse } from 'next/server';
import { mirrorKeycrmOrders } from '@/lib/automation/keycrm-mirror';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Copy KeyCRM-native orders into the site, read-only, once an hour.
 *
 * These are the Instagram orders: entered, paid and fiscalised in the CRM, and
 * until now invisible to every figure the site computes about the business.
 * Mirroring gives the admin dashboard and the analytics the whole picture
 * without moving ownership anywhere.
 *
 * Hourly rather than every half hour because nothing here is time-critical —
 * no email fires off the back of it, no customer is waiting on it. It is a
 * reporting copy.
 *
 * Auth: Vercel Cron sends `Authorization: Bearer $CRON_SECRET` automatically.
 * Add `?dry=1` to see what would be written without writing it.
 */

// Far enough back to catch an order edited days after it was placed, short
// enough to keep one invocation inside its time budget.
const WINDOW_DAYS = 14;

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
        const report = await mirrorKeycrmOrders({ windowDays: WINDOW_DAYS, dryRun });
        if (report.problems.length) console.warn('[keycrm-mirror] problems:', report.problems);
        return NextResponse.json({ ok: true, ...report });
    } catch (e: any) {
        console.error('[keycrm-mirror] Fatal error:', e);
        return NextResponse.json({ error: e?.message }, { status: 500 });
    }
}
