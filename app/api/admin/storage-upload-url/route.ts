/**
 * /api/admin/storage-upload-url — signed upload URL for admin media.
 *
 * Why this exists. The admin product form used to upload straight from the
 * browser with `supabase.storage.from('products').upload(...)`, which runs
 * under the storage RLS policy «Admin upload products»
 * (`bucket_id = 'products' AND is_admin()`). `is_admin()` reads the email claim
 * out of the caller's JWT, so the upload only works while the browser holds a
 * live Supabase session whose token still carries that claim. When it does not,
 * the upload dies with «new row violates row-level security policy» — the exact
 * error Diana hit on 2026-08-20 — even though she is signed into the admin panel
 * and every other admin action works, because those go through server routes
 * guarded by `requireAdmin` and the service-role client.
 *
 * Why not proxy the file through this route. Vercel caps a route handler's
 * request body at a few megabytes. Product photos are allowed up to 10 MB and
 * product videos up to 200 MB, so proxying would trade an RLS failure for a 413.
 *
 * So the server only authorises, and the bytes still go browser → storage
 * directly. `createSignedUploadUrl` issues a one-shot token for one exact path;
 * the browser then calls `uploadToSignedUrl` with it. The token itself is the
 * authorisation, so RLS is not consulted at all and no session claim is needed.
 *
 * The caller never picks the path. It sends a bucket key and a file name, and
 * the server derives the folder, generates the random basename and keeps only a
 * whitelisted extension — otherwise an admin-authenticated caller could aim the
 * signed URL at any object in the bucket and overwrite it.
 */
import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/auth/guards';

/** Buckets this route may hand out upload tokens for, and where inside them. */
const TARGETS: Record<string, { bucket: string; folder: string; extensions: string[] }> = {
  'product-image': {
    bucket: 'products',
    folder: 'products',
    extensions: ['jpg', 'jpeg', 'png', 'webp'],
  },
  'product-video': {
    bucket: 'videos',
    folder: 'product-videos',
    extensions: ['mp4', 'mov', 'avi', 'webm'],
  },
  // The products LIST page (app/admin/products) writes into a different bucket
  // than the edit form does — touch-memories-assets, which is where every
  // existing product image actually lives. Both surfaces are kept working.
  'product-asset-image': {
    bucket: 'touch-memories-assets',
    folder: 'products',
    extensions: ['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif'],
  },
  'product-asset-video': {
    bucket: 'touch-memories-assets',
    folder: 'products/videos',
    extensions: ['mp4', 'mov', 'avi', 'webm'],
  },
};

export async function POST(request: Request) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  let body: { target?: string; fileName?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const target = TARGETS[String(body.target || '')];
  if (!target) {
    return NextResponse.json({ error: 'Unknown upload target' }, { status: 400 });
  }

  const ext = String(body.fileName || '').split('.').pop()?.toLowerCase() || '';
  if (!target.extensions.includes(ext)) {
    return NextResponse.json(
      { error: `Unsupported extension .${ext}. Allowed: ${target.extensions.join(', ')}` },
      { status: 400 },
    );
  }

  // Basename is generated here, never taken from the client — see the note above.
  const basename = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
  const path = `${target.folder}/${basename}.${ext}`;

  const supabase = getAdminClient();
  const { data, error } = await supabase.storage.from(target.bucket).createSignedUploadUrl(path);

  if (error || !data) {
    console.error('[storage-upload-url] createSignedUploadUrl failed:', error?.message);
    return NextResponse.json({ error: error?.message || 'Could not create upload URL' }, { status: 500 });
  }

  const { data: pub } = supabase.storage.from(target.bucket).getPublicUrl(path);

  return NextResponse.json({
    bucket: target.bucket,
    path: data.path,
    token: data.token,
    publicUrl: pub.publicUrl,
  });
}
