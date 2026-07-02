import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * POST /api/upload/order-file   (multipart/form-data)
 *
 * Server-side upload of a customer file into the order-files bucket using the
 * service role, which bypasses storage RLS entirely.
 *
 * Why this exists: customers (especially guests, but also logged-in users
 * whose folder name doesn't match their auth.uid) kept hitting
 * "new row violates row-level security policy" when the magazine/journal
 * brief uploaded their photos directly from the browser. The bucket's
 * upsert-on-conflict path also turns into an UPDATE, which the owner-scoped
 * UPDATE policy rejects for anyone whose auth.uid != the folder prefix.
 * Routing the write through the server with the service role removes that
 * whole class of failure — uploads succeed regardless of auth state.
 *
 * Accepts:
 *   file   — the binary (required)
 *   path   — destination path inside the bucket, e.g.
 *            "magazine-brief-1782.../001_photo.jpg" (required)
 *   bucket — defaults to "order-files"; only the customer-upload buckets
 *            are allowed (no writing to products/admin buckets).
 */
const ALLOWED_BUCKETS = new Set(['order-files', 'photobook-uploads', 'poster-exports']);
const ALLOWED_CT = new Set([
  'image/jpeg', 'image/png', 'image/webp', 'image/gif',
  'image/heic', 'image/heif', 'image/avif', 'application/pdf',
  // Small config/descriptor blobs that constructors save alongside images.
  'application/json', 'text/plain',
]);
const MAX_BYTES = 50 * 1024 * 1024; // 50 MB per file

export async function POST(request: NextRequest) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: 'expected multipart/form-data' }, { status: 400 });
  }

  const file = form.get('file');
  const path = String(form.get('path') || '');
  const bucket = String(form.get('bucket') || 'order-files');

  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'file is required' }, { status: 400 });
  }
  if (!path || path.includes('..') || path.startsWith('/')) {
    return NextResponse.json({ error: 'invalid path' }, { status: 400 });
  }
  if (!ALLOWED_BUCKETS.has(bucket)) {
    return NextResponse.json({ error: 'bucket not allowed' }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'file too large' }, { status: 413 });
  }

  let contentType = (file.type || '').toLowerCase();
  if (contentType === 'image/jpg') contentType = 'image/jpeg';
  if (!ALLOWED_CT.has(contentType)) contentType = 'application/octet-stream';

  const admin = getAdminClient();
  if (!admin) {
    return NextResponse.json({ error: 'storage unavailable' }, { status: 503 });
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const { error } = await admin.storage
      .from(bucket)
      .upload(path, buffer, { upsert: true, contentType, cacheControl: '31536000' });

    if (error) {
      console.error('[upload/order-file] storage error:', error.message, { bucket, path });
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, path, bucket });
  } catch (e: any) {
    console.error('[upload/order-file] exception:', e?.message || e);
    return NextResponse.json({ error: e?.message || 'upload failed' }, { status: 500 });
  }
}
