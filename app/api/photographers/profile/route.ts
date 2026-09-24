import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { getPhotographerByToken } from '@/lib/photographers/helpers';

export const dynamic = 'force-dynamic';

/** Photographer cabinet: read own profile (auth = cabinet token). */
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token') || '';
  const photographer = await getPhotographerByToken(token);
  if (!photographer) return NextResponse.json({ error: 'Кабінет не знайдено' }, { status: 404 });
  // Only the fields the cabinet edits and shows. The whole row used to go
  // out, including the booking payment secrets (pay_mono_token,
  // pay_wfp_secret) of the landing that is gone now.
  const p = photographer as any;
  const safe = {
    id: p.id, name: p.name, bio: p.bio, email: p.email,
    phone: p.phone, instagram: p.instagram, website: p.website,
    logo_url: p.logo_url, avatar_url: p.avatar_url,
  };

  // Surface the linked account's B2B status so the cabinet can tell the
  // photographer whether the 10% shopping discount is active yet (verified),
  // still pending, or not applied for. Matched by customer link or email.
  let b2b_status: string | null = null;
  try {
    const admin = getAdminClient();
    const conds = [
      (photographer as any).customer_id ? `id.eq.${(photographer as any).customer_id}` : '',
      (photographer as any).customer_id ? `auth_user_id.eq.${(photographer as any).customer_id}` : '',
      (photographer as any).email ? `email.ilike.${(photographer as any).email}` : '',
    ].filter(Boolean);
    if (conds.length) {
      const { data: customer } = await admin
        .from('customers')
        .select('b2b_role, b2b_status')
        .or(conds.join(','))
        .maybeSingle();
      if (customer?.b2b_role === 'photographer') b2b_status = customer.b2b_status || null;
    }
  } catch { /* the cabinet works fine without the discount hint */ }

  return NextResponse.json({ photographer: safe, b2b_status });
}

// Only these fields are editable from the cabinet — exactly what the client
// gallery shows (logo and avatar go through /api/photographers/upload).
// The landing («візитка») fields, the booking and its payment settings went
// with the landing (Diana, 2026-09-24). landing_enabled was on this list, so
// any photographer could switch on the unfinished landing past the feature
// flag with one POST; that door is closed with it.
const EDITABLE = ['name', 'bio', 'phone', 'instagram', 'website'] as const;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const photographer = await getPhotographerByToken(String(body?.token || ''));
    if (!photographer) return NextResponse.json({ error: 'Кабінет не знайдено' }, { status: 404 });

    const patch: Record<string, unknown> = {};
    for (const key of EDITABLE) {
      if (key in body) patch[key] = body[key];
    }
    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: 'Немає полів для оновлення' }, { status: 400 });
    }
    patch.updated_at = new Date().toISOString();

    const admin = getAdminClient();
    const { error } = await admin.from('photographers').update(patch).eq('id', photographer.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Некоректний запит' }, { status: 400 });
  }
}
