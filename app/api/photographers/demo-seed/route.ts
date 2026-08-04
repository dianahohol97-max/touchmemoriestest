import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { GALLERY_BUCKET } from '@/lib/photographers/helpers';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Seeds the public DEMO gallery shown on /photographers (Diana, 2026-08-04:
 * «на сторінці для фотографів відразу відобразити превʼю галереї з
 * прикладами фото»). Sample photos are fetched server-side from picsum
 * (fixed ids → stable, safe stock images) because this must run where the
 * internet is reachable — Vercel, not the dev container.
 *
 * Idempotent and safe to expose: it only (re)creates one fixed demo
 * photographer/gallery and skips photos that already exist, so repeated
 * calls are no-ops. The demo gallery never expires (client API 404s expired
 * galleries) and its photographer has no cabinet exposure beyond this.
 */
const DEMO_EMAIL = 'demo-gallery@touchmemories.com.ua';
const DEMO_CLIENT_TOKEN = 'a0000000-0000-4000-8000-000000000001';
const DEMO_PHOTOS: { id: number; w: number; h: number }[] = [
  { id: 1011, w: 1600, h: 1067 },  // canoe on a lake — cover
  { id: 1027, w: 1200, h: 1600 },  // portrait
  { id: 1035, w: 1600, h: 1067 },  // mountains
  { id: 64,   w: 1200, h: 1600 },  // portrait
  { id: 177,  w: 1600, h: 1067 },  // forest road
  { id: 342,  w: 1200, h: 1600 },  // architecture
  { id: 429,  w: 1600, h: 1067 },  // beach
  { id: 823,  w: 1200, h: 1600 },  // couple silhouette
];

export async function GET() {
  try {
    const admin = getAdminClient();

    let { data: ph } = await admin
      .from('photographers')
      .select('id')
      .ilike('email', DEMO_EMAIL)
      .maybeSingle();
    if (!ph) {
      const { data: created, error } = await admin
        .from('photographers')
        .insert({
          name: 'Touch.Memories Studio',
          email: DEMO_EMAIL,
          slug: 'demo-gallery-studio',
          bio: 'Це демонстраційна галерея — саме так виглядатиме ваша.',
          instagram: 'touch.memories',
        })
        .select('id')
        .single();
      if (error || !created) return NextResponse.json({ error: error?.message || 'photographer' }, { status: 500 });
      ph = created;
    }

    let { data: gallery } = await admin
      .from('photographer_galleries')
      .select('id')
      .eq('client_token', DEMO_CLIENT_TOKEN)
      .maybeSingle();
    if (!gallery) {
      const { data: created, error } = await admin
        .from('photographer_galleries')
        .insert({
          photographer_id: ph.id,
          client_token: DEMO_CLIENT_TOKEN,
          title: 'Весілля Марії та Андрія',
          client_name: 'Марія та Андрій',
          shoot_date: '2026-06-20',
          expires_at: '2035-01-01T00:00:00Z',
          design: { bg: 'light', font: 'playfair', font_scale: 'm', cover: 'classic', lang: 'uk' },
        })
        .select('id')
        .single();
      if (error || !created) return NextResponse.json({ error: error?.message || 'gallery' }, { status: 500 });
      gallery = created;
    }

    const { data: existing } = await admin
      .from('photographer_gallery_photos')
      .select('storage_path')
      .eq('gallery_id', gallery.id);
    const have = new Set((existing || []).map(p => p.storage_path));

    let added = 0;
    for (const photo of DEMO_PHOTOS) {
      const path = `${ph.id}/${gallery.id}/demo-${photo.id}.jpg`;
      if (have.has(path)) continue;
      const res = await fetch(`https://picsum.photos/id/${photo.id}/${photo.w}/${photo.h}.jpg`, { redirect: 'follow' });
      if (!res.ok) continue;
      const buf = Buffer.from(await res.arrayBuffer());
      const { error: upErr } = await admin.storage
        .from(GALLERY_BUCKET)
        .upload(path, buf, { contentType: 'image/jpeg', upsert: true });
      if (upErr) continue;
      await admin.from('photographer_gallery_photos').insert({
        gallery_id: gallery.id,
        storage_path: path,
        file_name: `demo-${photo.id}.jpg`,
        size_bytes: buf.length,
      });
      added += 1;
    }

    return NextResponse.json({ ok: true, gallery_id: gallery.id, added, total: have.size + added });
  } catch (err: any) {
    console.error('[photographers/demo-seed]', err);
    return NextResponse.json({ error: err.message || 'Помилка' }, { status: 500 });
  }
}
