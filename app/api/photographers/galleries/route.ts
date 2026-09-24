import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { getPhotographerByToken, daysLeft } from '@/lib/photographers/helpers';
import { fileUrl } from '@/lib/photographers/storage';
import { readGalleryPhotoRows } from '@/lib/photographers/gallery-photos';
import { gallerySources, VARIANT_COLUMNS } from '@/lib/photographers/gallery-variant-paths';
import { galleryThumbUrl } from '@/lib/photographers/gallery-image';

export const dynamic = 'force-dynamic';

/** List own galleries with photo counts (auth = cabinet token). */
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token') || '';
  const photographer = await getPhotographerByToken(token);
  if (!photographer) return NextResponse.json({ error: 'Кабінет не знайдено' }, { status: 404 });

  const admin = getAdminClient();
  const { data: galleries, error } = await admin
    .from('photographer_galleries')
    // The !gallery_id hint is REQUIRED: cover_photo_id added a second FK
    // between these tables, and an unhinted embed makes PostgREST fail with
    // "more than one relationship was found" (broke the cabinet list,
    // 2026-08-04). Count through the child's gallery_id relationship.
    .select('id, client_token, title, client_name, shoot_date, expires_at, files_purged_at, created_at, cover_photo_id, design, zip_downloads, photographer_gallery_photos!gallery_id(count)')
    .eq('photographer_id', photographer.id)
    .order('created_at', { ascending: false });
  if (error) {
    // 500s here showed up in Vercel logs with no cause (2026-08-04, PostgREST
    // schema-cache staleness after adding columns) — always log the reason.
    console.error('[photographers/galleries] list failed:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // How many photos the client hearted in each gallery (what to print), and
  // single-photo downloads (ZIP counts live on the gallery row itself). Both
  // span EVERY gallery of the photographer, so they cross PostgREST's silent
  // 1000-row cap easily — read page by page.
  const galleryIds = (galleries || []).map((g: any) => g.id);
  const favByGallery: Record<string, number> = {};
  const photoDlByGallery: Record<string, number> = {};
  let favFailed = false;
  let dlFailed = false;
  if (galleryIds.length) {
    // These span every live gallery of the photographer, not one gallery, so
    // the page fuse is wider than the per-gallery default of 10.
    const TALLY_MAX_PAGES = 50;
    const [fav, dl] = await Promise.all([
      readGalleryPhotoRows<{ gallery_id: string }>(admin, 'id, gallery_id',
        q => q.in('gallery_id', galleryIds).eq('favorite', true), TALLY_MAX_PAGES),
      readGalleryPhotoRows<{ gallery_id: string; download_count: number | null }>(admin, 'id, gallery_id, download_count',
        q => q.in('gallery_id', galleryIds).gt('download_count', 0), TALLY_MAX_PAGES),
    ]);
    // A short tally would look like a real number, so a failed read shows NO
    // number (null — the cabinet hides the badge) rather than a wrong one,
    // and the list itself still loads.
    if (fav.error) console.error('[photographers/galleries] favorites tally failed:', fav.error);
    else for (const r of fav.rows) favByGallery[r.gallery_id] = (favByGallery[r.gallery_id] || 0) + 1;
    if (dl.error) console.error('[photographers/galleries] downloads tally failed:', dl.error);
    else for (const r of dl.rows) photoDlByGallery[r.gallery_id] = (photoDlByGallery[r.gallery_id] || 0) + (r.download_count || 0);
    favFailed = !!fav.error;
    dlFailed = !!dl.error;
  }

  // «Завантажити все»: скільки спроб почали і скільки не дійшли до кінця
  // (gallery_zip_attempts, 2026-09-24). Агрегат у базі — рядок на галерею,
  // тож стеля в тисячу рядків тут не діє. Відмова (наприклад, міграцію ще не
  // накатано) не валить список: кабінет просто не покаже розбивки.
  const zipStats: Record<string, { started: number; completed: number; unfinished: number; failed: number }> = {};
  if (galleryIds.length) {
    const { data: stats, error: statsError } = await admin.rpc('gallery_zip_attempt_stats', { gallery_ids: galleryIds });
    if (statsError) console.error('[photographers/galleries] zip attempts tally failed:', statsError.message);
    else for (const r of (stats || []) as any[]) {
      zipStats[r.gallery_id] = {
        started: Number(r.started) || 0,
        completed: Number(r.completed) || 0,
        unfinished: Number(r.unfinished) || 0,
        failed: Number(r.failed) || 0,
      };
    }
  }

  // Cover thumbnail for the cabinet list: the photographer's explicit pick,
  // else the first uploaded photo — same rule as the client gallery hero.
  // One photographer has few galleries, so per-gallery lookups are cheap.
  // The cabinet shows it at 64–380 px, so it is the smallest screen copy, and
  // the original only while the photo has no copies yet.
  const coverThumb = (c: any) => {
    const url = fileUrl(c.storage_path, c.storage_provider);
    return galleryThumbUrl({ url, sources: gallerySources(c, path => fileUrl(path, c.storage_provider), url) });
  };
  const coverByGallery: Record<string, string | null> = {};
  await Promise.all((galleries || []).map(async (g: any) => {
    if (g.cover_photo_id) {
      const { data: c } = await admin
        .from('photographer_gallery_photos')
        .select(`storage_path, storage_provider, media_type, ${VARIANT_COLUMNS}`)
        .eq('id', g.cover_photo_id)
        .maybeSingle();
      if (c?.storage_path) {
        coverByGallery[g.id] = c.media_type === 'video' ? fileUrl(c.storage_path, c.storage_provider) : coverThumb(c);
        return;
      }
    }
    const { data: first } = await admin
      .from('photographer_gallery_photos')
      .select(`storage_path, storage_provider, ${VARIANT_COLUMNS}`)
      .eq('gallery_id', g.id)
      .eq('media_type', 'photo')
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();
    coverByGallery[g.id] = first?.storage_path ? coverThumb(first) : null;
  }));

  return NextResponse.json({
    galleries: (galleries || []).map((g: any) => ({
      ...g,
      photo_count: g.photographer_gallery_photos?.[0]?.count || 0,
      favorite_count: favFailed ? null : favByGallery[g.id] || 0,
      photo_downloads: dlFailed ? null : photoDlByGallery[g.id] || 0,
      days_left: g.files_purged_at ? 0 : daysLeft(g.expires_at),
      cover_url: coverByGallery[g.id] || null,
      zip_attempts: zipStats[g.id] || null,
      photographer_gallery_photos: undefined,
    })),
  });
}

/** Create a gallery (auth = cabinet token). */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const photographer = await getPhotographerByToken(String(body?.token || ''));
    if (!photographer) return NextResponse.json({ error: 'Кабінет не знайдено' }, { status: 404 });

    const title = String(body?.title || '').trim();
    if (!title) return NextResponse.json({ error: 'Вкажіть назву галереї' }, { status: 400 });
    // Storage term picked at creation (30 is the default the column carries).
    const termDays = Number(body?.term_days || 30);
    if (![30, 60, 90].includes(termDays)) return NextResponse.json({ error: 'Термін: 30, 60 або 90 днів' }, { status: 400 });

    const admin = getAdminClient();
    const { data: gallery, error } = await admin
      .from('photographer_galleries')
      .insert({
        photographer_id: photographer.id,
        title,
        client_name: String(body?.client_name || '').trim() || null,
        shoot_date: body?.shoot_date || null,
        expires_at: new Date(Date.now() + termDays * 86400000).toISOString(),
      })
      .select('id, client_token, title, client_name, shoot_date, expires_at, created_at')
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ gallery });
  } catch {
    return NextResponse.json({ error: 'Некоректний запит' }, { status: 400 });
  }
}
