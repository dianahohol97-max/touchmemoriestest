import { NextResponse } from 'next/server';
import { drainCampaignQueue } from '@/lib/email/campaign-queue';
import { getEmailQuotaStatus } from '@/lib/email/quota';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * Daily drip for queued newsletters.
 *
 * Runs late in the cron order (16:00 UTC), after the other automations have
 * taken their share, so whatever marketing budget is left over goes to the
 * manual campaigns instead of competing with win-back and the welcome series.
 *
 * PER_RUN caps how much of the remaining budget one run may take. Without it a
 * single campaign would drain everything the moment it is queued, and a second
 * campaign queued the same week would wait behind it for days.
 */
const PER_RUN = 120;

export async function GET(request: Request) {
    const authHeader = request.headers.get('authorization');
    if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const result = await drainCampaignQueue(PER_RUN);
        const quota = await getEmailQuotaStatus();
        return NextResponse.json({
            message: result.sent === 0 && result.remaining === 0
                ? 'Черга порожня'
                : `Надіслано ${result.sent}, лишилося ${result.remaining}`,
            ...result,
            quota,
        });
    } catch (err: any) {
        console.error('[email-queue] cron error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
