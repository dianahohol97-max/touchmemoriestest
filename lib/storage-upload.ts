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
 */
export async function uploadImageToStorage(
  supabase: any,
  bucket: string,
  path: string,
  file: File,
  opts: UploadOpts = {},
): Promise<{ data: any; error: any; file: File }> {
  const prepared = await prepareImageForUpload(file, opts);
  // order-files has an owner-scoped SELECT policy (each customer sees only their
  // own files). An upsert compiles to INSERT ... ON CONFLICT, and Postgres runs
  // a conflict-arbiter check that needs SELECT visibility on the target row.
  // Anonymous customers (not logged in) can't see any order-files row, so the
  // upsert fails every time with "new row violates row-level security policy" —
  // the recurring checkout error. A plain INSERT has no arbiter step and works
  // for anon. Overwrite is never needed here: every order upload uses a unique
  // per-order path, so forcing upsert off is both the fix and the safer default.
  const useUpsert = bucket === 'order-files' ? false : (opts.upsert ?? true);
  const { data, error } = await supabase.storage.from(bucket).upload(path, prepared, {
    upsert: useUpsert,
    contentType: safeImageContentType(prepared),
    ...(opts.cacheControl ? { cacheControl: opts.cacheControl } : {}),
  });
  return { data, error, file: prepared };
}
