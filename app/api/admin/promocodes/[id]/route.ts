import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const cookieClient = await createClient();
  const { data: { user } } = await cookieClient.auth.getUser();
  if (!user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = getAdminClient();
  const { data: adminRow } = await admin.from('admin_users').select('id').eq('email', user.email).maybeSingle();
  if (!adminRow) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await req.json();
  const allowed = ['code','type','value','min_order_amount','applies_to','applicable_product_ids','applicable_category_ids','max_uses','is_single_use_per_customer','valid_from','valid_until','is_active','notes'];
  const updates: any = {};
  for (const k of allowed) if (k in body) updates[k] = body[k];

  const { data, error } = await admin.from('promo_codes').update(updates).eq('id', id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ promo: data });
}
