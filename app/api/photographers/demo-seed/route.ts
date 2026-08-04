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
// Wedding photos from Pexels (license: free commercial use, no attribution
// required). Ids verified via pexels.com photo pages; the CDN URL pattern
// serves a resized jpeg. Photos no longer in this list are removed from the
// demo gallery on the next seed run, so swapping the set is a redeploy+call.
const DEMO_PHOTOS: { id: number; desc: string }[] = [
  { id: 19679440, desc: 'wedding couple outdoors — cover' },
  { id: 19816898, desc: 'bride in flowing gown on rustic path' },
  { id: 31048922, desc: 'wedding rings and bouquet close-up' },
  { id: 19639,    desc: 'bride and groom embracing with bouquet' },
  { id: 16910979, desc: 'bride portrait in forest' },
  { id: 3578784,  desc: 'beach ceremony under bamboo arch' },
  { id: 11309259, desc: 'rings by flower bouquet' },
  { id: 1721942,  desc: 'bride in white gown with bouquet' },
  { id: 8845902,  desc: 'couple holding hands at ceremony' },
];
// Pexels' CDN serves some photos as .jpeg and some as .jpg, and rejects
// requests without a browser-like User-Agent — try both suffixes with UA.
const PEXELS_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
// The CDN answers 503 to bursts from datacenter IPs — space the attempts out
// and retry with backoff before giving up on a photo.
async function fetchPexels(id: number): Promise<{ buf: Buffer } | { fail: string }> {
  let last = '';
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) await sleep(1500 * attempt);
    for (const ext of ['jpeg', 'jpg']) {
      const url = `https://images.pexels.com/photos/${id}/pexels-photo-${id}.${ext}?auto=compress&cs=tinysrgb&w=1800`;
      try {
        const res = await fetch(url, { redirect: 'follow', headers: { 'User-Agent': PEXELS_UA, Accept: 'image/*' } });
        if (res.ok) return { buf: Buffer.from(await res.arrayBuffer()) };
        last = `${ext}:${res.status}`;
        if (res.status === 404) break; // wrong suffix won't fix a missing asset
      } catch (e: any) {
        last = `${ext}:${e?.message || 'fetch failed'}`;
      }
      await sleep(400);
    }
  }
  return { fail: last };
}

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

    const wantedPaths = new Set(DEMO_PHOTOS.map(p => `${ph!.id}/${gallery!.id}/demo-${p.id}.jpg`));

    const { data: existing } = await admin
      .from('photographer_gallery_photos')
      .select('id, storage_path')
      .eq('gallery_id', gallery.id);

    // Drop photos that fell out of the curated list (e.g. the first picsum
    // placeholders after the switch to wedding photos).
    let removed = 0;
    for (const row of existing || []) {
      if (wantedPaths.has(row.storage_path)) continue;
      await admin.storage.from(GALLERY_BUCKET).remove([row.storage_path]);
      await admin.from('photographer_gallery_photos').delete().eq('id', row.id);
      removed += 1;
    }
    const have = new Set((existing || []).map(p => p.storage_path).filter(p => wantedPaths.has(p)));

    let added = 0;
    const failures: Record<number, string> = {};
    for (const photo of DEMO_PHOTOS) {
      const path = `${ph.id}/${gallery.id}/demo-${photo.id}.jpg`;
      if (have.has(path)) continue;
      await sleep(800); // space requests out — bursts trip the CDN's 503
      const got = await fetchPexels(photo.id);
      if ('fail' in got) { failures[photo.id] = got.fail; continue; }
      const { error: upErr } = await admin.storage
        .from(GALLERY_BUCKET)
        .upload(path, got.buf, { contentType: 'image/jpeg', upsert: true });
      if (upErr) { failures[photo.id] = upErr.message; continue; }
      await admin.from('photographer_gallery_photos').insert({
        gallery_id: gallery.id,
        storage_path: path,
        file_name: `demo-${photo.id}.jpg`,
        size_bytes: got.buf.length,
      });
      added += 1;
    }

    return NextResponse.json({ ok: true, gallery_id: gallery.id, added, removed, total: have.size + added, failures });
  } catch (err: any) {
    console.error('[photographers/demo-seed]', err);
    return NextResponse.json({ error: err.message || 'Помилка' }, { status: 500 });
  }
}
