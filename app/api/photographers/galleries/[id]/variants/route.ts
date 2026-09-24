import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { getPhotographerByToken } from '@/lib/photographers/helpers';
import { liveGalleryIds, runGalleryVariants } from '@/lib/photographers/gallery-variants';
import { liveVariantDeps } from '@/lib/photographers/gallery-variants-live';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Screen copies for the photos just uploaded (auth = cabinet token).
 *
 * The cabinet calls this after an upload batch and repeats while `remaining`
 * shrinks. It never blocks the upload itself: a photo without copies is shown
 * from the original, as before, and the 15-minute telegram-webhook-sync cron
 * picks up anything the tab did not finish (catchUpRecentVariants). Why the server and not the
 * photographer's browser — lib/photographers/gallery-variants.ts.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: galleryId } = await params;
  const body = await req.json().catch(() => ({}));
  const photographer = await getPhotographerByToken(String(body?.token || ''));
  if (!photographer) return NextResponse.json({ error: 'Кабінет не знайдено' }, { status: 404 });

  const admin = getAdminClient();
  const { data: gallery } = await admin
    .from('photographer_galleries')
    .select('id')
    .eq('id', galleryId)
    .eq('photographer_id', photographer.id)
    .maybeSingle();
  if (!gallery) return NextResponse.json({ error: 'Галерею не знайдено' }, { status: 404 });

  // An expired gallery belongs to the retention cron; cutting copies of a
  // photo it is about to erase is a race (see gallery-variants.ts).
  const live = await liveGalleryIds(admin, new Date(), [galleryId]);
  if (live.error) return NextResponse.json({ error: live.error }, { status: 500 });
  if (!live.ids.length) return NextResponse.json({ made: 0, remaining: 0, skipped: 'gallery not live' });

  const report = await runGalleryVariants(liveVariantDeps(), {
    scope: q => q.eq('gallery_id', galleryId),
    maxPhotos: 60,
    budgetMs: 40_000,
  });
  if (report.failed) console.error('[photographers/variants] some copies failed', { galleryId, errors: report.errors.slice(0, 5) });
  return NextResponse.json({
    made: report.made, failed: report.failed, remaining: report.remaining,
  });
}
