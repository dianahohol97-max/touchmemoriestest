import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { fileUrl, presignDownload } from '@/lib/photographers/storage';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Download one gallery file through our own origin. Two jobs, both created by
 * the move to Cloudflare R2 (Diana, 2026-08-06):
 *
 * 1. Single-photo download. The old link appended `?download=<name>` to the
 *    storage URL — a Supabase parameter. R2's public address ignores query
 *    strings, so on R2 the photo opened in a tab instead of saving. This route
 *    redirects to a presigned GET carrying response-content-disposition, so
 *    the bytes still travel browser↔Cloudflare and cost us no egress.
 *
 * 2. `?stream=1` — the archive's fallback. The ZIP is built in the browser
 *    from `fetch(photo.url)`, and a cross-origin fetch needs CORS headers on
 *    the response, unlike an <img>, which needs none. That is exactly why the
 *    photos kept displaying while «Не вдалося сформувати архів» appeared. Here
 *    the bytes are proxied, which does cost our bandwidth — so the client only
 *    asks for it per file whose direct fetch failed. A redirect would not help
 *    that case: the CORS check applies to wherever the redirect lands.
 *
 * Auth is the gallery's unguessable client_token, exactly like the gallery
 * itself, and the photo must belong to that gallery — a tampered id gets 404.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string; photoId: string }> }) {
  const { token, photoId } = await params;
  const stream = req.nextUrl.searchParams.get('stream') === '1';
  const admin = getAdminClient();

  const { data: gallery } = await admin
    .from('photographer_galleries')
    .select('id, expires_at, files_purged_at')
    .eq('client_token', token)
    .maybeSingle();
  if (!gallery) return NextResponse.json({ error: 'Галерею не знайдено' }, { status: 404 });
  if (gallery.files_purged_at || new Date(gallery.expires_at).getTime() < Date.now()) {
    return NextResponse.json({ error: 'Термін зберігання минув' }, { status: 410 });
  }

  const { data: photo } = await admin
    .from('photographer_gallery_photos')
    .select('storage_path, file_name, storage_provider')
    .eq('id', photoId)
    .eq('gallery_id', gallery.id)
    .maybeSingle();
  if (!photo) return NextResponse.json({ error: 'Файл не знайдено' }, { status: 404 });

  const fileName = photo.file_name || 'photo.jpg';

  if (!stream) {
    // R2: a presigned GET that forces «save as» and bypasses our bandwidth.
    const signed = await presignDownload(photo.storage_path, photo.storage_provider, fileName);
    if (signed) return NextResponse.redirect(signed, 302);
    // Supabase understands the same intent as a query parameter.
    if (photo.storage_provider !== 'r2') {
      const url = fileUrl(photo.storage_path, photo.storage_provider);
      return NextResponse.redirect(`${url}${url.includes('?') ? '&' : '?'}download=${encodeURIComponent(fileName)}`, 302);
    }
    // R2 configured away or presign failed — proxying still gets the file to
    // the client, which beats a dead download button.
  }

  const upstream = await fetch(fileUrl(photo.storage_path, photo.storage_provider), { cache: 'no-store' })
    .catch(() => null);
  if (!upstream || !upstream.ok || !upstream.body) {
    return NextResponse.json({ error: 'Файл недоступний у сховищі' }, { status: 502 });
  }

  // Cyrillic file names are common here, so the RFC 5987 form carries the real
  // name and the plain one stays ASCII for older clients.
  const name = fileName;
  const ascii = name.replace(/[^\x20-\x7e]+/g, '_').replace(/"/g, '');
  const headers: Record<string, string> = {
    'Content-Type': upstream.headers.get('content-type') || 'application/octet-stream',
    'Content-Disposition': `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(name)}`,
    'Cache-Control': 'private, no-store',
  };
  const length = upstream.headers.get('content-length');
  if (length) headers['Content-Length'] = length;

  return new NextResponse(upstream.body, { headers });
}
