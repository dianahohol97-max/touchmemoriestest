'use client';

import { normalizeImageFile } from './heic-to-jpeg';
import { downscaleImageIfLarge } from './downscale-image';

// One place that makes every customer photo upload reliable:
//  • HEIC/HEIF (iPhone) → JPEG
//  • a content-type the storage bucket actually accepts (phones sometimes
//    report "image/jpg" or an empty/odd type, which buckets reject)
//  • optional downscale of only very large images (for brief/reference photos;
//    leave OFF for print-resolution uploads so we never lose quality)

const ALLOWED_CT = new Set([
  'image/jpeg', 'image/png', 'image/webp', 'image/gif',
  'image/heic', 'image/heif', 'image/avif', 'application/pdf',
]);

export function safeImageContentType(file: File | Blob): string {
  let t = ((file as File).type || '').toLowerCase();
  if (t === 'image/jpg') t = 'image/jpeg';
  return ALLOWED_CT.has(t) ? t : 'application/octet-stream';
}

export interface PrepareOpts {
  downscale?: boolean;
  maxEdge?: number;
  quality?: number;
}

/** Normalise HEIC→JPEG always; downscale only when asked. Never throws. */
export async function prepareImageForUpload(file: File, opts: PrepareOpts = {}): Promise<File> {
  let out = await normalizeImageFile(file);
  if (opts.downscale) out = await downscaleImageIfLarge(out, opts.maxEdge, opts.quality);
  return out;
}

export interface UploadOpts extends PrepareOpts {
  upsert?: boolean;
  cacheControl?: string;
}

/**
 * Prepare a customer photo and upload it to Supabase Storage with a
 * bucket-accepted content-type. Returns the usual { data, error } plus the
 * prepared file so callers can record the real (post-prepare) size.
 *
 * For customer-upload buckets (order-files, photobook-uploads) the write goes
 * through the server-side /api/upload/order-file endpoint, which uses the
 * service role and therefore bypasses storage RLS. Direct browser uploads to
 * order-files fail for guests and for logged-in users whose folder prefix
 * isn't their auth.uid, because the bucket's UPDATE policy is owner-scoped and
 * upsert turns the write into an UPDATE — the "new row violates row-level
 * security policy" error customers kept hitting at checkout. Routing through
 * the server fixes every constructor and order flow at once, since they all
 * funnel through this one function.
 */
const SERVER_UPLOAD_BUCKETS = new Set(['order-files', 'photobook-uploads']);

export async function uploadImageToStorage(
  supabase: any,
  bucket: string,
  path: string,
  file: File,
  opts: UploadOpts = {},
): Promise<{ data: any; error: any; file: File }> {
  const prepared = await prepareImageForUpload(file, opts);

  // Customer-upload buckets go through the server (service role), which
  // bypasses storage RLS entirely — the definitive fix for the recurring
  // "new row violates row-level security policy" checkout error. See the
  // function doc above for why the direct browser upsert failed for anon.
  if (SERVER_UPLOAD_BUCKETS.has(bucket)) {
    try {
      const fd = new FormData();
      fd.append('file', prepared, path.split('/').pop() || 'photo.jpg');
      fd.append('path', path);
      fd.append('bucket', bucket);
      const resp = await fetch('/api/upload/order-file', { method: 'POST', body: fd });
      if (!resp.ok) {
        const j = await resp.json().catch(() => ({}));
        return { data: null, error: { message: j?.error || `upload failed (${resp.status})` }, file: prepared };
      }
      const j = await resp.json().catch(() => ({}));
      return { data: { path: j?.path || path }, error: null, file: prepared };
    } catch (e: any) {
      return { data: null, error: { message: e?.message || 'upload failed' }, file: prepared };
    }
  }

  // Other buckets (admin assets, etc.) keep the direct client upload. For any
  // bucket with an owner-scoped SELECT policy, an upsert compiles to
  // INSERT ... ON CONFLICT whose arbiter step needs SELECT visibility on the
  // target row — which anon customers lack — so we force plain INSERT there.
  const useUpsert = bucket === 'order-files' ? false : (opts.upsert ?? true);
  const { data, error } = await supabase.storage.from(bucket).upload(path, prepared, {
    upsert: useUpsert,
    contentType: safeImageContentType(prepared),
    ...(opts.cacheControl ? { cacheControl: opts.cacheControl } : {}),
  });
  return { data, error, file: prepared };
}
