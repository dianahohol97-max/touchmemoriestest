import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { getPhotographerByToken } from '@/lib/photographers/helpers';
import { isValidThemeKey } from '@/lib/photographers/themes';

export const dynamic = 'force-dynamic';

/** Photographer cabinet: read own profile (auth = cabinet token). */
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token') || '';
  const photographer = await getPhotographerByToken(token);
  if (!photographer) return NextResponse.json({ error: 'Кабінет не знайдено' }, { status: 404 });
  const { cabinet_token: _hidden, ...safe } = photographer as any;

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

// Only these fields are editable from the cabinet. slug / custom_domain /
// is_active are managed by staff in the admin — a photographer must not be
// able to move their public URL or toggle the paid domain themselves.
const EDITABLE = [
  'name', 'bio', 'phone', 'instagram', 'website', 'pricing', 'portfolio',
  'landing_enabled', 'city', 'specialization', 'landing_theme',
  // booking + direct-to-photographer payment settings
  'booking_enabled', 'pay_mono_enabled', 'pay_mono_link', 'pay_mono_token',
  'pay_wfp_enabled', 'pay_wfp_link', 'pay_wfp_account', 'pay_wfp_secret',
  'pay_requisites_enabled', 'pay_requisites',
] as const;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const photographer = await getPhotographerByToken(String(body?.token || ''));
    if (!photographer) return NextResponse.json({ error: 'Кабінет не знайдено' }, { status: 404 });

    const patch: Record<string, unknown> = {};
    for (const key of EDITABLE) {
      if (key in body) patch[key] = body[key];
    }
    if ('pricing' in patch && !Array.isArray(patch.pricing)) {
      return NextResponse.json({ error: 'pricing має бути списком' }, { status: 400 });
    }
    if ('portfolio' in patch && !Array.isArray(patch.portfolio)) {
      return NextResponse.json({ error: 'portfolio має бути списком' }, { status: 400 });
    }
    if ('landing_theme' in patch && !isValidThemeKey(patch.landing_theme)) {
      return NextResponse.json({ error: 'Невідома тема лендингу' }, { status: 400 });
    }
    for (const linkKey of ['pay_mono_link', 'pay_wfp_link'] as const) {
      if (linkKey in patch && patch[linkKey] && !/^https?:\/\//i.test(String(patch[linkKey]))) {
        return NextResponse.json({ error: 'Посилання на оплату має починатися з http' }, { status: 400 });
      }
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
