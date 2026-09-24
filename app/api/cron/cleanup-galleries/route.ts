import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { removeFiles } from '@/lib/photographers/storage';
import { cleanupExpiredGalleries } from '@/lib/photographers/gallery-cleanup';
import { sendExpiryNotices, sendPurgeNotices, type NoticeReport } from '@/lib/photographers/notices';
import { sendLoggedEmail } from '@/lib/email/send-logged';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Nightly retention for photographer galleries: photos live 30–90 days
 * (photographer_galleries.expires_at), then the files are deleted from
 * storage. The logic — and why its order matters — lives in
 * lib/photographers/gallery-cleanup.ts; this route only authorises and
 * reports.
 *
 * A gallery that fails is logged and left for the next run; it no longer
 * aborts the whole run. `skipped` in the response says which and why.
 *
 * Around the purge the same run sends two letters to the photographer
 * (lib/photographers/notices.ts):
 *   before — «галерея скоро згасне», for galleries within three days of
 *            expiry at the NEXT run (see EXPIRY_CRON_PERIOD_MS);
 *   after  — «файли галереї видалено», only for galleries whose
 *            files_purged_at is already set, i.e. storage confirmed.
 * They live here and not in a separate cron because this run is the one that
 * deletes: the warning is about exactly this job, and the purge notice can
 * only honestly follow its success. A mail failure never touches the purge:
 * each step is wrapped and reported separately.
 */
export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization');
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const admin = getAdminClient();
  if (!admin) return NextResponse.json({ error: 'No admin client' }, { status: 500 });

  const log = (message: string, context: Record<string, unknown>) => console.error(message, context);
  const notices = async (step: (d: any) => Promise<NoticeReport>): Promise<NoticeReport | { error: string }> => {
    try {
      return await step({ db: admin, send: sendLoggedEmail, log });
    } catch (e: any) {
      log('[cleanup-galleries] notice step failed', { error: e?.message || String(e) });
      return { error: e?.message || String(e) };
    }
  };

  const started = Date.now();
  const expiryNotices = await notices(sendExpiryNotices);

  try {
    const report = await cleanupExpiredGalleries({ db: admin, removeFiles, log }, {
      // The warning step above shares the route's 60 s.
      budgetMs: Math.max(10_000, 40_000 - (Date.now() - started)),
    });
    const purgeNotices = await notices(sendPurgeNotices);
    return NextResponse.json({
      success: true, ...report, skippedCount: report.skipped.length, expiryNotices, purgeNotices,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || String(e) }, { status: 500 });
  }
}
