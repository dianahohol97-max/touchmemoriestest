import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { removeFiles } from '@/lib/photographers/storage';
import { cleanupExpiredGalleries } from '@/lib/photographers/gallery-cleanup';

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
 */
export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization');
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const admin = getAdminClient();
  if (!admin) return NextResponse.json({ error: 'No admin client' }, { status: 500 });

  try {
    const report = await cleanupExpiredGalleries({
      db: admin,
      removeFiles,
      log: (message, context) => console.error(message, context),
    });
    return NextResponse.json({ success: true, ...report, skippedCount: report.skipped.length });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || String(e) }, { status: 500 });
  }
}
