import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import {
  getPhotographerByToken, galleryPhotoPath,
  MAX_VIDEO_BYTES, MAX_PHOTO_BYTES, MAX_PHOTOS_PER_GALLERY,
} from '@/lib/photographers/helpers';
import { presignUpload, fileExists, fileUrl, activeProvider, removeFiles } from '@/lib/photographers/storage';
import { planOf, canUploadVideo, isVideoFile, videoRefusal } from '@/lib/photographers/plan-rules';
import { checkQuota } from '@/lib/photographers/usage';
import { notifyStorageAfterUpload } from '@/lib/photographers/storage-notice';

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
 * Direct upload for any file too big to pass through a Vercel function —
 * every video, and photos above ~4 MB (a full-frame JPEG easily exceeds that,
 * which is why the advertised 25 MB photo limit was never actually reachable
 * through the multipart route). Two stages, because multipart through a
 * function is capped at ~4.5 MB:
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
    // Video by the declared type OR by the file extension: the type is the
    // client's word, and a video sent as image/jpeg must not pass for a photo.
    const isVideo = isVideoFile({ contentType, fileName });
    const isPhoto = !isVideo && contentType.startsWith('image/');
    if (!isVideo && !isPhoto) {
      return NextResponse.json({ error: `«${fileName}» не є фото чи відео` }, { status: 400 });
    }
    // Video is a paid-plan feature (from «Старт»). Refused BEFORE the signed
    // URL is minted, so the file never reaches storage. Photos on the free plan
    // go through this same route and are not affected. `video_not_allowed`
    // lets the cabinet skip the file and carry on with the rest of the batch.
    if (isVideo && !canUploadVideo(planOf(ctx.photographer))) {
      return NextResponse.json({ error: videoRefusal(fileName), video_not_allowed: true }, { status: 403 });
    }
    const maxBytes = isVideo ? MAX_VIDEO_BYTES : MAX_PHOTO_BYTES;
    if (!size || size > maxBytes) {
      const limit = maxBytes >= 1024 ** 3
        ? `${Math.round(maxBytes / 1024 ** 3)} ГБ`
        : `${Math.round(maxBytes / 1024 ** 2)} МБ`;
      return NextResponse.json({ error: `«${fileName}» більший за ${limit}` }, { status: 400 });
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
    // The server decides what the file is: a video if the client says so OR
    // the name says so. media_type alone is the client's word.
    const mediaType = String(body.media_type || 'video') === 'photo' && !isVideoFile({ fileName }) ? 'photo' : 'video';
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

    // Second gate for video: a client that skipped `sign`'s refusal (another
    // name at sign, a video name here) would otherwise register a video on the
    // free plan. The object is removed, so it does not sit in storage unseen.
    if (mediaType === 'video' && !canUploadVideo(planOf(ctx.photographer))) {
      const rmErr = await removeFiles([{ path, provider }]);
      if (rmErr) console.error('[photographers/videos] refused video left in storage', { path, error: rmErr });
      return NextResponse.json({ error: videoRefusal(fileName), video_not_allowed: true }, { status: 403 });
    }

    const { data: row, error } = await admin
      .from('photographer_gallery_photos')
      .insert({
        gallery_id: galleryId,
        storage_path: path,
        file_name: fileName,
        size_bytes: head.size ?? null,
        media_type: mediaType,
        storage_provider: provider,
      })
      .select('id, storage_path, file_name, size_bytes, storage_provider, created_at')
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    // «Місце закінчується» — лише після того, як рядок справді є. Ніколи не
    // кидає, тож confirm лишається успішним за будь-якої відмови пошти.
    await notifyStorageAfterUpload(ctx.photographer, head.size ?? 0);
    return NextResponse.json({ uploaded: { ...row, url: fileUrl(path, provider) } });
  }

  return NextResponse.json({ error: 'Невідомий stage' }, { status: 400 });
}
