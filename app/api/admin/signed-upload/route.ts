import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/guards';
import { getAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

// Buckets the admin content/media uploader is allowed to write to.
const ALLOWED_BUCKETS = new Set([
  'touch-memories-assets',
  'videos',
  'travel-covers',
  'category-images',
  'products',
]);

// Returns a short-lived signed upload URL + token so the browser can upload a
// file DIRECTLY to Supabase Storage, bypassing this Vercel function entirely.
//
// Why this exists: the older /api/admin/upload route streams the file through
// the function, which is capped at ~4.5 MB by Vercel. Homepage videos in the
// `videos` bucket can be up to 200 MB, so anything bigger than ~4.5 MB failed
// with a 413. A signed upload URL is generated server-side (service role, no
// body), and the actual bytes go straight from the client to Storage, so the
// full bucket limit applies.
//
// Gate is requireAdmin() (Diana, 2026-09-22) — this used to be requireStaff()
// plus a hand-rolled re-check against ONLY admin_users, which is a strict
// SUBSET of what requireAdmin() already checks (admin_users OR staff with
// role admin/owner). Аліна логіниться як mozgovayaaa18@gmail.com — вона є в
// `staff` з роллю owner (тобто по суті повний адмін), але не має власного
// рядка в admin_users, тож стара перевірка мовчки відмовляла їй у завантаженні
// фото ("Forbidden") на сторінці кольорів велюру. requireAdmin() — та сама
// функція, якою вже перевіряється доступ в інших чутливих admin-роутах, —
// коректно визнає staff.role IN ('admin','owner') повним адміном.
export async function POST(req: Request) {
    const guard = await requireAdmin();
    if (!guard.ok) return guard.response;

  const admin = getAdminClient();
  let body: { bucket?: string; folder?: string; ext?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const bucket = String(body.bucket || '');
  const folder = String(body.folder || '').replace(/^\/+|\/+$/g, '');
  const ext = String(body.ext || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '') || 'bin';

  if (!ALLOWED_BUCKETS.has(bucket)) return NextResponse.json({ error: 'Bucket not allowed' }, { status: 400 });

  // Extension allowlist. These buckets are PUBLIC, so an .svg/.html would be
  // served from our domain and could run script (stored XSS). Only raster
  // images (and video in the videos bucket). Size is enforced by the bucket's
  // own file-size limit since the bytes never pass through this function.
  const isVideoBucket = bucket === 'videos';
  const ALLOWED_EXT = isVideoBucket
    ? ['mp4', 'webm', 'mov', 'm4v']
    : ['jpg', 'jpeg', 'png', 'webp', 'gif', 'avif'];
  if (!ALLOWED_EXT.includes(ext)) {
    return NextResponse.json({ error: 'Недозволений тип файлу' }, { status: 400 });
  }

  const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const path = folder ? `${folder}/${fileName}` : fileName;

  const { data, error } = await admin.storage.from(bucket).createSignedUploadUrl(path);
  if (error || !data) return NextResponse.json({ error: error?.message || 'Failed to create signed URL' }, { status: 500 });

  const { data: { publicUrl } } = admin.storage.from(bucket).getPublicUrl(path);
  return NextResponse.json({ token: data.token, path: data.path, publicUrl });
}
