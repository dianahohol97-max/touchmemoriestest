import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import {
  getPhotographerByToken, galleryPhotoPath, publicUrl,
  GALLERY_BUCKET, MAX_PHOTO_BYTES, MAX_PHOTOS_PER_GALLERY,
} from '@/lib/photographers/helpers';

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
  for (const file of files) {
    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ error: `«${file.name}» не є зображенням` }, { status: 400 });
    }
    if (file.size > MAX_PHOTO_BYTES) {
      return NextResponse.json({ error: `«${file.name}» більший за 25 МБ` }, { status: 400 });
    }
    const path = galleryPhotoPath(ctx.photographer.id, galleryId, file.name);
    const { error: upErr } = await admin.storage
      .from(GALLERY_BUCKET)
      .upload(path, Buffer.from(await file.arrayBuffer()), { contentType: file.type, upsert: false });
    if (upErr) return NextResponse.json({ error: `Аплоад «${file.name}»: ${upErr.message}` }, { status: 500 });

    const { data: row, error: insErr } = await admin
      .from('photographer_gallery_photos')
      .insert({ gallery_id: galleryId, storage_path: path, file_name: file.name, size_bytes: file.size })
      .select('id, storage_path, file_name, size_bytes, created_at')
      .single();
    if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });
    uploaded.push({ ...row, url: publicUrl(path) });
  }

  return NextResponse.json({ uploaded });
}

/** List photos of an own gallery (auth = cabinet token). */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: galleryId } = await params;
  const ctx = await ownGallery(req.nextUrl.searchParams.get('token') || '', galleryId);
  if ('error' in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });

  const admin = getAdminClient();
  const { data: photos, error } = await admin
    .from('photographer_gallery_photos')
    .select('id, storage_path, file_name, size_bytes, favorite, created_at')
    .eq('gallery_id', galleryId)
    .order('created_at', { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ photos: (photos || []).map(p => ({ ...p, url: publicUrl(p.storage_path) })) });
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
    .select('id, storage_path')
    .eq('id', String(body?.photo_id || ''))
    .eq('gallery_id', galleryId)
    .maybeSingle();
  if (!photo) return NextResponse.json({ error: 'Фото не знайдено' }, { status: 404 });

  await admin.storage.from(GALLERY_BUCKET).remove([photo.storage_path]);
  const { error } = await admin.from('photographer_gallery_photos').delete().eq('id', photo.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
