import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { getPhotographerByToken, daysLeft, publicUrl } from '@/lib/photographers/helpers';

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

  // How many photos the client hearted in each gallery (what to print).
  // Favorite selections are small, so one flat query + JS tally is cheapest.
  const galleryIds = (galleries || []).map((g: any) => g.id);
  const favByGallery: Record<string, number> = {};
  const photoDlByGallery: Record<string, number> = {};
  if (galleryIds.length) {
    const { data: favRows } = await admin
      .from('photographer_gallery_photos')
      .select('gallery_id')
      .in('gallery_id', galleryIds)
      .eq('favorite', true);
    for (const r of favRows || []) favByGallery[r.gallery_id] = (favByGallery[r.gallery_id] || 0) + 1;

    // Single-photo download tally per gallery (ZIP counts live on the
    // gallery row itself).
    const { data: dlRows } = await admin
      .from('photographer_gallery_photos')
      .select('gallery_id, download_count')
      .in('gallery_id', galleryIds)
      .gt('download_count', 0);
    for (const r of dlRows || []) photoDlByGallery[r.gallery_id] = (photoDlByGallery[r.gallery_id] || 0) + (r.download_count || 0);
  }

  // Cover thumbnail for the cabinet list: the photographer's explicit pick,
  // else the first uploaded photo — same rule as the client gallery hero.
  // One photographer has few galleries, so per-gallery lookups are cheap.
  const coverByGallery: Record<string, string | null> = {};
  await Promise.all((galleries || []).map(async (g: any) => {
    if (g.cover_photo_id) {
      const { data: c } = await admin
        .from('photographer_gallery_photos')
        .select('storage_path')
        .eq('id', g.cover_photo_id)
        .maybeSingle();
      if (c?.storage_path) { coverByGallery[g.id] = publicUrl(c.storage_path); return; }
    }
    const { data: first } = await admin
      .from('photographer_gallery_photos')
      .select('storage_path')
      .eq('gallery_id', g.id)
      .eq('media_type', 'photo')
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();
    coverByGallery[g.id] = first?.storage_path ? publicUrl(first.storage_path) : null;
  }));

  return NextResponse.json({
    galleries: (galleries || []).map((g: any) => ({
      ...g,
      photo_count: g.photographer_gallery_photos?.[0]?.count || 0,
      favorite_count: favByGallery[g.id] || 0,
      photo_downloads: photoDlByGallery[g.id] || 0,
      days_left: g.files_purged_at ? 0 : daysLeft(g.expires_at),
      cover_url: coverByGallery[g.id] || null,
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
