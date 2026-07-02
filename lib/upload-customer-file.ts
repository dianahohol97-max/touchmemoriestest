/**
 * The one and only way a browser should put a customer file into the
 * order-files (or photobook-uploads) bucket.
 *
 * Every constructor and order flow MUST use this instead of
 * supabase.storage.from('order-files').upload(...). Direct browser uploads to
 * order-files fail for guests with "new row violates row-level security
 * policy": the bucket's INSERT is public but its UPDATE is owner-scoped, and
 * upsert-on-existing-path compiles to an UPDATE that guests (auth.uid null)
 * can't pass. That single mismatch caused the recurring "can't upload photo" /
 * "no print files in admin" reports across many different products.
 *
 * This routes the write through /api/upload/order-file, which uses the service
 * role and bypasses storage RLS entirely, so it works the same for guests and
 * logged-in users. Accepts Blob | File | string (JSON/text) so it covers both
 * rendered images and the small config/descriptor blobs constructors save.
 *
 * Returns { error } shaped like the supabase upload result, so call sites can
 * keep their existing `if (error) …` handling.
 */
export async function uploadCustomerFile(
  path: string,
  body: Blob | File | string,
  opts: { bucket?: 'order-files' | 'photobook-uploads'; contentType?: string; fileName?: string } = {},
): Promise<{ error: { message: string } | null; path: string }> {
  const bucket = opts.bucket || 'order-files';
  try {
    let fileBlob: Blob;
    if (typeof body === 'string') {
      fileBlob = new Blob([body], { type: opts.contentType || 'application/json' });
    } else {
      fileBlob = body;
    }
    const fileName = opts.fileName || path.split('/').pop() || 'file';
    const fd = new FormData();
    fd.append('file', fileBlob, fileName);
    fd.append('path', path);
    fd.append('bucket', bucket);

    const resp = await fetch('/api/upload/order-file', { method: 'POST', body: fd });
    if (!resp.ok) {
      const j = await resp.json().catch(() => ({}));
      return { error: { message: j?.error || `upload failed (${resp.status})` }, path };
    }
    return { error: null, path };
  } catch (e: any) {
    return { error: { message: e?.message || 'upload failed' }, path };
  }
}
