import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { putFile, removeFiles } from '@/lib/photographers/storage';

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
// required). Only these two ids survive the Pexels CDN's datacenter blocking
// — the rest of the gallery is topped up from Openverse below.
const DEMO_PHOTOS: { id: number; desc: string }[] = [
  { id: 16910979, desc: 'bride portrait in forest — cover' },
  { id: 1721942,  desc: 'bride in white gown with bouquet' },
];
// Target size of the demo gallery; missing slots are filled from Openverse
// (api.openverse.org — public search over openly-licensed images). We ask
// for CC0/PDM only: public domain, no attribution required, safe to show.
const DEMO_TARGET = 9;
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

export async function GET(req: Request) {
  try {
    const admin = getAdminClient();
    const mode = new URL(req.url).searchParams.get('mode') || '';

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

    const pexelsPaths = new Set(DEMO_PHOTOS.map(p => `${ph!.id}/${gallery!.id}/demo-${p.id}.jpg`));
    // Stock = files this seeder itself placed (demo-*). Anything else is a
    // MANUAL upload (Diana's real photos via the demo cabinet) — the seeder
    // must never touch those.
    const isStock = (path: string) => /\/demo-[\w-]+\.jpg$/.test(path);
    const isWanted = (path: string) =>
      pexelsPaths.has(path) || path.includes('/demo-ov-');

    const { data: existing } = await admin
      .from('photographer_gallery_photos')
      .select('id, storage_path, storage_provider')
      .eq('gallery_id', gallery.id);
    const manualCount = (existing || []).filter(r => !isStock(r.storage_path)).length;

    // mode=clear-stock: real photos have been uploaded manually — remove the
    // stock set and stop. Guarded so the gallery can never end up empty.
    if (mode === 'clear-stock') {
      if (manualCount < 4) {
        return NextResponse.json({ error: `Замало власних фото (${manualCount}) — спершу завантажте їх у демо-кабінеті`, manual: manualCount }, { status: 400 });
      }
      let cleared = 0;
      for (const row of existing || []) {
        if (!isStock(row.storage_path)) continue;
        await removeFiles([{ path: row.storage_path, provider: (row as any).storage_provider }]);
        await admin.from('photographer_gallery_photos').delete().eq('id', row.id);
        cleared += 1;
      }
      return NextResponse.json({ ok: true, cleared, manual: manualCount });
    }

    // With manual photos present the gallery is real content now — never
    // top it up with stock or delete anything.
    if (manualCount > 0) {
      return NextResponse.json({ ok: true, manual: manualCount, note: 'manual photos present — seeding skipped' });
    }

    // Drop leftovers from earlier seeding attempts (picsum placeholders,
    // pexels ids that never downloaded).
    let removed = 0;
    for (const row of existing || []) {
      if (isWanted(row.storage_path)) continue;
      await removeFiles([{ path: row.storage_path, provider: (row as any).storage_provider }]);
      await admin.from('photographer_gallery_photos').delete().eq('id', row.id);
      removed += 1;
    }
    const have = new Set((existing || []).map(p => p.storage_path).filter(isWanted));

    const saveBuf = async (path: string, fileName: string, buf: Buffer) => {
      const put = await putFile(path, buf, 'image/jpeg');
      if ('error' in put) return put.error;
      await admin.from('photographer_gallery_photos').insert({
        gallery_id: gallery!.id,
        storage_path: path,
        file_name: fileName,
        size_bytes: buf.length,
        storage_provider: put.provider,
      });
      have.add(path);
      return null;
    };

    let added = 0;
    const failures: Record<string, string> = {};

    for (const photo of DEMO_PHOTOS) {
      const path = `${ph.id}/${gallery.id}/demo-${photo.id}.jpg`;
      if (have.has(path)) continue;
      const got = await fetchPexels(photo.id);
      if ('fail' in got) { failures[String(photo.id)] = got.fail; continue; }
      const err = await saveBuf(path, `demo-${photo.id}.jpg`, got.buf);
      if (err) { failures[String(photo.id)] = err; continue; }
      added += 1;
    }

    // Top the gallery up to DEMO_TARGET with public-domain wedding photos
    // from Openverse (direct source URLs, mostly Flickr — fetchable from
    // serverless without the CDN games Pexels plays).
    if (have.size < DEMO_TARGET) {
      try {
        const ovRes = await fetch(
          'https://api.openverse.org/v1/images/?q=wedding%20bride%20groom&license=cc0,pdm&per_page=30',
          { headers: { 'User-Agent': PEXELS_UA, Accept: 'application/json' } },
        );
        const ov = ovRes.ok ? await ovRes.json() : null;
        const candidates: any[] = (ov?.results || []).filter(
          (r: any) => (r.width || 0) >= 900 && typeof r.url === 'string' && /\.jpe?g(\?|$)/i.test(r.url),
        );
        for (const cand of candidates) {
          if (have.size >= DEMO_TARGET) break;
          const safeId = String(cand.id || '').replace(/[^\w-]/g, '').slice(0, 40);
          if (!safeId) continue;
          const path = `${ph.id}/${gallery.id}/demo-ov-${safeId}.jpg`;
          if (have.has(path)) continue;
          try {
            const res = await fetch(cand.url, { redirect: 'follow', headers: { 'User-Agent': PEXELS_UA, Accept: 'image/*' } });
            if (!res.ok) { failures[`ov-${safeId}`] = String(res.status); continue; }
            const buf = Buffer.from(await res.arrayBuffer());
            if (buf.length < 40_000) continue; // skip thumbnails/broken files
            const err = await saveBuf(path, `demo-ov-${safeId}.jpg`, buf);
            if (err) { failures[`ov-${safeId}`] = err; continue; }
            added += 1;
          } catch (e: any) {
            failures[`ov-${safeId}`] = e?.message || 'fetch failed';
          }
        }
      } catch (e: any) {
        failures['openverse'] = e?.message || 'search failed';
      }
    }

    return NextResponse.json({ ok: true, gallery_id: gallery.id, added, removed, total: have.size, failures });
  } catch (err: any) {
    console.error('[photographers/demo-seed]', err);
    return NextResponse.json({ error: err.message || 'Помилка' }, { status: 500 });
  }
}
