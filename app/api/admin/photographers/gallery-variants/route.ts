import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/auth/guards';
import { consumeRunToken } from '@/lib/automation/run-token';
import { liveGalleryIds, runGalleryVariants } from '@/lib/photographers/gallery-variants';
import { liveVariantDeps } from '@/lib/photographers/gallery-variants-live';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Backfill of screen copies for photos uploaded before copies existed
 * (lib/photographers/gallery-variants.ts).
 *
 *   GET                    — per live gallery: photos, with copies, still
 *                            waiting, given up on, what originals and copies weigh.
 *   GET ?gallery_id=…      — one portion (≤ 45 s) for that gallery, then the
 *                            same stats for it. Repeat until `remaining` is 0.
 *                            Safe to re-run: done photos never re-enter the
 *                            queue, and a copy's path is fixed by its original,
 *                            so a repeat overwrites the same file.
 *
 * Access: an admin session, or a one-time token in settings
 * (`gallery_variants_run_token`, see lib/automation/run-token.ts) — the token
 * is consumed by the call, so every portion needs a fresh one.
 */
export async function GET(req: NextRequest) {
  const viaToken = await consumeRunToken(req, 'gallery_variants_run_token');
  if (!viaToken) {
    const guard = await requireAdmin();
    if (!guard.ok) return guard.response;
  }

  const admin = getAdminClient();
  const galleryId = new URL(req.url).searchParams.get('gallery_id') || '';
  const live = await liveGalleryIds(admin, new Date(), galleryId ? [galleryId] : undefined);
  if (live.error) return NextResponse.json({ error: live.error }, { status: 500 });

  let run: unknown = null;
  if (galleryId) {
    if (!live.ids.length) return NextResponse.json({ error: 'Галерея не жива (термін минув або файли стерто)' }, { status: 400 });
    const report = await runGalleryVariants(liveVariantDeps(), {
      scope: q => q.eq('gallery_id', galleryId),
      maxPhotos: 120,
      budgetMs: 45_000,
    });
    run = { ...report, errors: report.errors.slice(0, 20) };
  }

  const { data, error } = await admin.rpc('gallery_variant_stats', { gallery_ids: live.ids });
  if (error) return NextResponse.json({ error: error.message, run }, { status: 500 });
  return NextResponse.json({ run, galleries: data || [] });
}
