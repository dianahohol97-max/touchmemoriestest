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
  /** Free-text label of the flow doing the upload, e.g. 'order-page' or a
   *  constructor name. Stored on the attempt log so failures are traceable. */
  context?: string;
  /** Order id, when the upload happens in a flow that already has one. */
  orderId?: string;
}

/**
 * Record one upload attempt (success or failure) in upload_attempt_log.
 *
 * Fire-and-forget: this must NEVER slow down or break an upload. Every path is
 * swallowed — a logging failure is invisible to the customer. The table has a
 * public INSERT policy ("Anyone can log an upload attempt") so the browser's
 * anon/authenticated client can write it directly; admins read it back.
 *
 * Why it exists: before this, a failed customer upload left no trace anywhere
 * (the file 400'd, so no storage row and no order were created), so we could
 * never answer "how many people failed to upload". Now every attempt is counted.
 */
function logUploadAttempt(
  supabase: any,
  row: {
    bucket: string;
    file_name: string;
    file_size?: number;
    mime_type?: string;
    status: 'success' | 'error';
    error_message?: string | null;
    context?: string | null;
    order_id?: string | null;
  },
): void {
  try {
    void supabase
      .from('upload_attempt_log')
      .insert({
        bucket: row.bucket,
        file_name: row.file_name,
        file_size: row.file_size ?? null,
        mime_type: row.mime_type ?? null,
        status: row.status,
        error_message: row.error_message ?? null,
        context: row.context ?? null,
        order_id: row.order_id ?? null,
        user_agent:
          typeof navigator !== 'undefined' ? navigator.userAgent : null,
      })
      .then(
        () => {},
        () => {}, // never surface a logging error to the caller
      );
  } catch {
    // navigator/client unavailable, or any sync throw — ignore entirely.
  }
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
  const contentType = safeImageContentType(prepared);
  let data: any = null;
  let error: any = null;

  if (SERVER_UPLOAD_BUCKETS.has(bucket)) {
    // Customer-upload buckets go through the server (service role), which
    // bypasses storage RLS entirely — the definitive fix for the recurring
    // "new row violates row-level security policy" checkout error. See the
    // function doc above for why the direct browser upsert failed for anon.
    try {
      const fd = new FormData();
      fd.append('file', prepared, path.split('/').pop() || 'photo.jpg');
      fd.append('path', path);
      fd.append('bucket', bucket);
      const resp = await fetch('/api/upload/order-file', { method: 'POST', body: fd });
      if (!resp.ok) {
        const j = await resp.json().catch(() => ({}));
        error = { message: j?.error || `upload failed (${resp.status})` };
      } else {
        const j = await resp.json().catch(() => ({}));
        data = { path: j?.path || path };
      }
    } catch (e: any) {
      error = { message: e?.message || 'upload failed' };
    }
  } else {
    // Other buckets (admin assets, etc.) keep the direct client upload.
    const { data: d, error: e } = await supabase.storage.from(bucket).upload(path, prepared, {
      upsert: opts.upsert ?? true,
      contentType,
      ...(opts.cacheControl ? { cacheControl: opts.cacheControl } : {}),
    });
    data = d;
    error = e;
  }

  // Record every attempt (both paths, success or error). Non-blocking and
  // fully swallowed — this is what makes "how many uploads failed, and why"
  // answerable at any time, so a silent upload failure can never go unseen.
  logUploadAttempt(supabase, {
    bucket,
    file_name: path,
    file_size: prepared.size,
    mime_type: contentType,
    status: error ? 'error' : 'success',
    error_message: error ? (error.message || String(error)) : null,
    context: opts.context ?? null,
    order_id: opts.orderId ?? null,
  });

  return { data, error, file: prepared };
}
