import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

// featured_articles has RLS enabled with no policies, so all reads/writes must
// go through the service role. These endpoints power the "Статті на головній"
// admin tab. Every method verifies the caller is a logged-in admin.
async function requireAdmin() {
  const cookieClient = await createClient();
  const { data: { user } } = await cookieClient.auth.getUser();
  if (!user?.email) return { error: 'Unauthorized', status: 401 as const };
  const admin = getAdminClient();
  const { data: adminRow } = await admin
    .from('admin_users')
    .select('id')
    .eq('email', user.email.toLowerCase())
    .maybeSingle();
  if (!adminRow) return { error: 'Forbidden', status: 403 as const };
  return { admin };
}

const EDITABLE = ['section', 'position', 'title', 'description', 'image_url', 'link_url', 'category_label', 'is_active'];
function pick(body: any) {
  const out: any = {};
  for (const k of EDITABLE) if (k in body) out[k] = body[k];
  return out;
}

export async function GET(req: Request) {
  const auth = await requireAdmin();
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const section = new URL(req.url).searchParams.get('section') || 'travel';
  const { data, error } = await auth.admin
    .from('featured_articles')
    .select('*')
    .eq('section', section)
    .order('position', { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ articles: data || [] });
}

export async function POST(req: Request) {
  const auth = await requireAdmin();
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const body = await req.json().catch(() => ({}));
  const row = pick(body);
  if (!row.section) row.section = 'travel';
  if (row.position === undefined) row.position = 99;
  if (row.is_active === undefined) row.is_active = true;
  const { data, error } = await auth.admin.from('featured_articles').insert(row).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ article: data });
}

export async function PATCH(req: Request) {
  const auth = await requireAdmin();
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const body = await req.json().catch(() => ({}));
  if (!body.id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  const updates = pick(body);
  updates.updated_at = new Date().toISOString();
  const { data, error } = await auth.admin.from('featured_articles').update(updates).eq('id', body.id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ article: data });
}

export async function DELETE(req: Request) {
  const auth = await requireAdmin();
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const id = new URL(req.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  const { error } = await auth.admin.from('featured_articles').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
