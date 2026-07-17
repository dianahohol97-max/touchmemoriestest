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

// Overwriting an EXISTING object is only allowed while it is younger than
// this. Legitimate re-writes to the same path all happen within an editing
// session ("Редагувати" from the cart re-exports pending/<cartItemId>/...);
// print files of completed orders must never be silently replaceable by an
// anonymous request that merely knows/guesses the path.
const OVERWRITE_WINDOW_MS = 48 * 60 * 60 * 1000;

export async function POST(request: NextRequest) {
  // CSRF/off-site guard: the route stays open for guests (constructors upload
  // before any order or session exists), but only from our own pages. Direct
  // cross-site scripts get rejected; requests without an Origin header (older
  // in-app webviews) are allowed through.
  const origin = request.headers.get('origin');
  if (origin) {
    let host = '';
    try { host = new URL(origin).hostname; } catch { /* malformed → rejected below */ }
    const ownHost = request.nextUrl.hostname;
    const allowed = host === ownHost
      || host === 'touchmemories.com.ua' || host === 'www.touchmemories.com.ua'
      || host.endsWith('.vercel.app') || host === 'localhost';
    if (!allowed) {
      return NextResponse.json({ error: 'origin not allowed' }, { status: 403 });
    }
  }

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
  if (!path || path.length > 512 || path.includes('..') || path.startsWith('/')) {
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
    // If the target object already exists, only allow the overwrite while it
    // is fresh (same editing session / next-day cart edit). Old order files
    // are immutable through this anonymous route.
    const dir = path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '';
    const name = path.slice(path.lastIndexOf('/') + 1);
    const { data: existing } = await admin.storage
      .from(bucket)
      .list(dir, { search: name, limit: 10 });
    const match = (existing || []).find((f: any) => f.name === name);
    if (match) {
      const createdAt = new Date(match.created_at || match.updated_at || 0).getTime();
      if (!createdAt || Date.now() - createdAt > OVERWRITE_WINDOW_MS) {
        console.warn('[upload/order-file] blocked overwrite of aged object', { bucket, path });
        return NextResponse.json({ error: 'file already exists and can no longer be replaced' }, { status: 409 });
      }
    }

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
