import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import {
  getPhotographerByToken, galleryPhotoPath,
  MAX_PHOTO_BYTES, MAX_PHOTOS_PER_GALLERY,
} from '@/lib/photographers/helpers';
import { putFile, fileUrl, removeFiles } from '@/lib/photographers/storage';
import { checkQuota } from '@/lib/photographers/usage';
import { notifyStorageAfterUpload } from '@/lib/photographers/storage-notice';
import { readAllGalleryPhotos } from '@/lib/photographers/gallery-photos';
import { galleryFilesToRemove, gallerySources, VARIANT_COLUMNS } from '@/lib/photographers/gallery-variant-paths';
import { galleryThumbUrl } from '@/lib/photographers/gallery-image';
import { planOf, canUploadVideo, isVideoFile, videoRefusal } from '@/lib/photographers/plan-rules';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

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
 * Upload photos into a gallery. Multipart form: token, files[].
 * Writes go through the service role (project rule: the browser never writes
 * to storage buckets directly — see eslint no-restricted-syntax guard).
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: galleryId } = await params;
  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: 'Очікується multipart/form-data' }, { status: 400 });

  const ctx = await ownGallery(String(form.get('token') || ''), galleryId);
  if ('error' in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });

  const files = form.getAll('files').filter((f): f is File => f instanceof File);
  if (files.length === 0) return NextResponse.json({ error: 'Немає файлів' }, { status: 400 });

  const admin = getAdminClient();
  const { count } = await admin
    .from('photographer_gallery_photos')
    .select('id', { count: 'exact', head: true })
    .eq('gallery_id', galleryId);
  if ((count || 0) + files.length > MAX_PHOTOS_PER_GALLERY) {
    return NextResponse.json({ error: `Ліміт ${MAX_PHOTOS_PER_GALLERY} фото на галерею` }, { status: 400 });
  }

  const uploaded: any[] = [];
  let uploadedBytes = 0;
  for (const file of files) {
    // This route takes photos only; a video named as a photo (image/jpeg type,
    // .mp4 name) is caught by its name. On the free plan the refusal says why.
    if (isVideoFile({ contentType: file.type, fileName: file.name }) && !canUploadVideo(planOf(ctx.photographer))) {
      return NextResponse.json({ error: videoRefusal(file.name), video_not_allowed: true, uploaded }, { status: 403 });
    }
    if (!file.type.startsWith('image/') || isVideoFile({ fileName: file.name })) {
      return NextResponse.json({ error: `«${file.name}» не є зображенням` }, { status: 400 });
    }
    if (file.size > MAX_PHOTO_BYTES) {
      return NextResponse.json({ error: `«${file.name}» більший за ${Math.round(MAX_PHOTO_BYTES / 1024 / 1024)} МБ` }, { status: 400 });
    }
    // Storage plan limit. Checked per file so a long batch stops exactly at
    // the cap instead of overshooting it; 402 tells the cabinet to show the
    // upgrade dialog rather than a generic error.
    const quotaErr = await checkQuota(ctx.photographer, file.size);
    if (quotaErr) {
      await notifyStorageAfterUpload(ctx.photographer, uploadedBytes);
      return NextResponse.json({ error: quotaErr, quota: true, uploaded }, { status: 402 });
    }
    const path = galleryPhotoPath(ctx.photographer.id, galleryId, file.name);
    const put = await putFile(path, Buffer.from(await file.arrayBuffer()), file.type);
    if ('error' in put) return NextResponse.json({ error: `Аплоад «${file.name}»: ${put.error}` }, { status: 500 });

    const { data: row, error: insErr } = await admin
      .from('photographer_gallery_photos')
      .insert({
        gallery_id: galleryId, storage_path: path, file_name: file.name,
        size_bytes: file.size, storage_provider: put.provider,
      })
      .select('id, storage_path, file_name, size_bytes, storage_provider, created_at')
      .single();
    if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });
    uploaded.push({ ...row, url: fileUrl(path, put.provider) });
    uploadedBytes += file.size;
  }

  // «Місце закінчується» — один раз на весь запит, а не на кожен файл.
  // Ніколи не кидає, тож аплоад лишається успішним за будь-якої відмови пошти.
  await notifyStorageAfterUpload(ctx.photographer, uploadedBytes);
  return NextResponse.json({ uploaded });
}

/** List photos of an own gallery (auth = cabinet token). */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: galleryId } = await params;
  const ctx = await ownGallery(req.nextUrl.searchParams.get('token') || '', galleryId);
  if ('error' in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });

  const admin = getAdminClient();
  // Paged: up to 2000 files per gallery against PostgREST's silent 1000.
  const { rows: photos, error } = await readAllGalleryPhotos<any>(
    admin, galleryId, `id, storage_path, file_name, size_bytes, favorite, media_type, storage_provider, created_at, ${VARIANT_COLUMNS}`,
  );
  if (error) return NextResponse.json({ error }, { status: 500 });
  // `url` stays the original (the cabinet downloads by it); tiles show
  // `thumb_url`, the smallest screen copy, or the original while there is none.
  return NextResponse.json({
    photos: photos.map(p => {
      const url = fileUrl(p.storage_path, p.storage_provider);
      const sources = p.media_type === 'video' ? [] : gallerySources(p, path => fileUrl(path, p.storage_provider), url);
      return { ...p, url, thumb_url: galleryThumbUrl({ url, sources }) };
    }),
  });
}

/** Delete one photo (body: token, photo_id). */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: galleryId } = await params;
  const body = await req.json().catch(() => ({}));
  const ctx = await ownGallery(String(body?.token || ''), galleryId);
  if ('error' in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });

  const admin = getAdminClient();
  const { data: photo } = await admin
    .from('photographer_gallery_photos')
    .select(`id, storage_path, storage_provider, ${VARIANT_COLUMNS}`)
    .eq('id', String(body?.photo_id || ''))
    .eq('gallery_id', galleryId)
    .maybeSingle();
  if (!photo) return NextResponse.json({ error: 'Фото не знайдено' }, { status: 404 });

  // The row is the only way to find the file again, so it goes only after
  // storage confirmed the file is gone. The result used to be ignored: with
  // R2 off, or a key DeleteObjects quietly refused, the row vanished and the
  // file stayed in the bucket for good.
  // The screen copies go in the same call: one of them left behind would be
  // an orphan nobody can find (lib/photographers/gallery-variant-paths.ts).
  const rmErr = await removeFiles(galleryFilesToRemove(photo));
  if (rmErr) {
    console.error('[photographers/photos] file delete failed', { photo: photo.id, error: rmErr });
    // The raw reason (S3 codes, key names) goes to the log; the cabinet shows
    // this text verbatim in an alert, so it has to be plain Ukrainian.
    return NextResponse.json({ error: 'Не вдалося видалити файл зі сховища, спробуйте пізніше' }, { status: 502 });
  }
  const { error } = await admin.from('photographer_gallery_photos').delete().eq('id', photo.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
