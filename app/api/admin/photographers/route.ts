import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/auth/guards';

export const dynamic = 'force-dynamic';

export async function GET() {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const admin = getAdminClient();
  const { data, error } = await admin
    .from('photographers')
    .select('*, photographer_galleries(count)')
    .order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    photographers: (data || []).map((p: any) => ({
      ...p,
      gallery_count: p.photographer_galleries?.[0]?.count || 0,
      photographer_galleries: undefined,
    })),
  });
}

export async function POST(req: NextRequest) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const body = await req.json().catch(() => ({}));
  const name = String(body?.name || '').trim();
  const email = String(body?.email || '').trim().toLowerCase();
  const slug = String(body?.slug || '').trim().toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '');
  if (!name || !email || !slug) {
    return NextResponse.json({ error: "Обов'язкові поля: name, email, slug" }, { status: 400 });
  }

  const admin = getAdminClient();
  const { data, error } = await admin
    .from('photographers')
    .insert({ name, email, slug, phone: body?.phone || null, instagram: body?.instagram || null })
    .select('*')
    .single();
  if (error) {
    const msg = error.code === '23505' ? 'Такий slug або домен уже існує' : error.message;
    return NextResponse.json({ error: msg }, { status: 400 });
  }
  return NextResponse.json({ photographer: data });
}
