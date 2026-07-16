import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { getPhotographerByToken, daysLeft } from '@/lib/photographers/helpers';

export const dynamic = 'force-dynamic';

/** List own galleries with photo counts (auth = cabinet token). */
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token') || '';
  const photographer = await getPhotographerByToken(token);
  if (!photographer) return NextResponse.json({ error: 'Кабінет не знайдено' }, { status: 404 });

  const admin = getAdminClient();
  const { data: galleries, error } = await admin
    .from('photographer_galleries')
    .select('id, client_token, title, client_name, shoot_date, expires_at, files_purged_at, created_at, photographer_gallery_photos(count)')
    .eq('photographer_id', photographer.id)
    .order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    galleries: (galleries || []).map((g: any) => ({
      ...g,
      photo_count: g.photographer_gallery_photos?.[0]?.count || 0,
      days_left: g.files_purged_at ? 0 : daysLeft(g.expires_at),
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

    const admin = getAdminClient();
    const { data: gallery, error } = await admin
      .from('photographer_galleries')
      .insert({
        photographer_id: photographer.id,
        title,
        client_name: String(body?.client_name || '').trim() || null,
        shoot_date: body?.shoot_date || null,
      })
      .select('id, client_token, title, client_name, shoot_date, expires_at, created_at')
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ gallery });
  } catch {
    return NextResponse.json({ error: 'Некоректний запит' }, { status: 400 });
  }
}
