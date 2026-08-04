import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import {
  getPhotographerByToken, galleryPhotoPath,
  MAX_VIDEO_BYTES, MAX_PHOTOS_PER_GALLERY,
} from '@/lib/photographers/helpers';
import { presignUpload, fileExists, fileUrl, activeProvider } from '@/lib/photographers/storage';
import { checkQuota } from '@/lib/photographers/usage';

export const dynamic = 'force-dynamic';

async function ownGallery(token: string, galleryId: string) {
  const photographer = await getPhotographerByToken(token);
  if (!photographer) return { error: 'Кабінет не знайдено', status: 404 as const };
  const admin = getAdminClient();
  const { data: gallery } = await admin
    .from('photographer_galleries')
    .select('id, photographer_id, files_purged_at')
    .eq('id', galleryId)
    .eq('photographer_id', photographer.id)
    .maybeSingle();
  if (!gallery) return { error: 'Галерею не знайдено', status: 404 as const };
  if (gallery.files_purged_at) return { error: 'Термін дії галереї минув', status: 410 as const };
  return { photographer, gallery };
}

/**
 * Video upload happens in two stages because multipart through a Vercel
 * function is capped at ~4.5 MB while videos run to hundreds:
 *   stage 'sign'    → mint a short-lived signed upload URL; the browser PUTs
 *                     the file straight to Supabase Storage.
 *   stage 'confirm' → after the PUT succeeds, verify the object really exists
 *                     in storage and register the DB row (media_type 'video').
 * This stays within the project rule "the browser never writes to buckets
 * directly": the browser only ever holds a single-use URL scoped to one path,
 * minted by this token-authenticated route — the service key never leaves the
 * server and the client can't touch any other object.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: galleryId } = await params;
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Некоректний запит' }, { status: 400 });

  const ctx = await ownGallery(String(body.token || ''), galleryId);
  if ('error' in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  const admin = getAdminClient();

  const stage = String(body.stage || 'sign');

  if (stage === 'sign') {
    const fileName = String(body.file_name || 'video.mp4');
    const size = Number(body.size || 0);
    const contentType = String(body.content_type || '');
    if (!contentType.startsWith('video/')) {
      return NextResponse.json({ error: `«${fileName}» не є відео` }, { status: 400 });
    }
    if (!size || size > MAX_VIDEO_BYTES) {
      return NextResponse.json({ error: `«${fileName}» більший за ${Math.round(MAX_VIDEO_BYTES / 1024 / 1024)} МБ` }, { status: 400 });
    }
    const { count } = await admin
      .from('photographer_gallery_photos')
      .select('id', { count: 'exact', head: true })
      .eq('gallery_id', galleryId);
    if ((count || 0) + 1 > MAX_PHOTOS_PER_GALLERY) {
      return NextResponse.json({ error: `Ліміт ${MAX_PHOTOS_PER_GALLERY} файлів на галерею` }, { status: 400 });
    }

    // Storage plan limit — refused BEFORE the signed URL is minted, so a
    // over-quota video never reaches the bucket at all.
    const quotaErr = await checkQuota(ctx.photographer, size);
    if (quotaErr) return NextResponse.json({ error: quotaErr, quota: true }, { status: 402 });

    const path = galleryPhotoPath(ctx.photographer.id, galleryId, fileName);
    const signed = await presignUpload(path, contentType);
    if ('error' in signed) return NextResponse.json({ error: signed.error }, { status: 500 });
    return NextResponse.json({ signed_url: signed.url, path, provider: signed.provider });
  }

  if (stage === 'confirm') {
    const path = String(body.path || '');
    const fileName = String(body.file_name || 'video.mp4');
    // The path must belong to this photographer+gallery — a tampered path
    // would otherwise let one cabinet register objects of another.
    if (!path.startsWith(`${ctx.photographer.id}/${galleryId}/`)) {
      return NextResponse.json({ error: 'Некоректний шлях файлу' }, { status: 400 });
    }
    // Trust storage, not the client, for existence and size. The provider is
    // taken from the current config: the signed URL was minted moments ago.
    const provider = activeProvider();
    const head = await fileExists(path, provider);
    if (!head.ok) return NextResponse.json({ error: 'Файл не знайдено у сховищі — повторіть завантаження' }, { status: 400 });

    const { data: row, error } = await admin
      .from('photographer_gallery_photos')
      .insert({
        gallery_id: galleryId,
        storage_path: path,
        file_name: fileName,
        size_bytes: head.size ?? null,
        media_type: 'video',
        storage_provider: provider,
      })
      .select('id, storage_path, file_name, size_bytes, storage_provider, created_at')
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ uploaded: { ...row, url: fileUrl(path, provider) } });
  }

  return NextResponse.json({ error: 'Невідомий stage' }, { status: 400 });
}
