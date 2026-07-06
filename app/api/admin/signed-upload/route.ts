import { NextResponse } from 'next/server';
import { requireStaff } from '@/lib/auth/guards';
import { createClient } from '@/lib/supabase/server';
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
// The caller must be a logged-in admin (verified via session cookie against
// admin_users) — same gate as the legacy upload route.
export async function POST(req: Request) {
    const guard = await requireStaff();
    if (!guard.ok) return guard.response;

  const cookieClient = await createClient();
  const { data: { user } } = await cookieClient.auth.getUser();
  if (!user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = getAdminClient();
  const { data: adminRow } = await admin
    .from('admin_users')
    .select('id')
    .eq('email', user.email.toLowerCase())
    .maybeSingle();
  if (!adminRow) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

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

  const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const path = folder ? `${folder}/${fileName}` : fileName;

  const { data, error } = await admin.storage.from(bucket).createSignedUploadUrl(path);
  if (error || !data) return NextResponse.json({ error: error?.message || 'Failed to create signed URL' }, { status: 500 });

  const { data: { publicUrl } } = admin.storage.from(bucket).getPublicUrl(path);
  return NextResponse.json({ token: data.token, path: data.path, publicUrl });
}
