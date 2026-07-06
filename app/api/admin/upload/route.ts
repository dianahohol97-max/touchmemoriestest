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

// Uploads a file to Supabase Storage using the service-role key. Going through
// the server avoids the client-side RLS / session ambiguity that left homepage
// photo and video uploads silently failing. The caller must be a logged-in
// admin (verified via their session cookie against admin_users).
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

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 });
  }

  const file = form.get('file');
  const bucket = String(form.get('bucket') || '');
  const folder = String(form.get('folder') || '').replace(/^\/+|\/+$/g, '');

  if (!(file instanceof File)) return NextResponse.json({ error: 'No file' }, { status: 400 });
  if (!ALLOWED_BUCKETS.has(bucket)) return NextResponse.json({ error: 'Bucket not allowed' }, { status: 400 });

  const ext = (file.name.split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '');
  const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const path = folder ? `${folder}/${fileName}` : fileName;

  const buffer = Buffer.from(await file.arrayBuffer());
  const { error } = await admin.storage.from(bucket).upload(path, buffer, {
    contentType: file.type || undefined,
    upsert: false,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data: { publicUrl } } = admin.storage.from(bucket).getPublicUrl(path);
  return NextResponse.json({ url: publicUrl });
}
