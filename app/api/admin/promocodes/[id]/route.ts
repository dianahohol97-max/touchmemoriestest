import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/guards';
import { getAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  // Editing a promo code is a money-affecting change, so this is requireAdmin,
  // not requireStaff. It used to run requireStaff and then re-implement the
  // admin check inline with an UNESCAPED `.ilike('email', user.email)` — the
  // exact wildcard hole likeEscape exists to close (a staff member registered
  // as `_iana@…` matches `diana@…`), and it also skipped the staff is_active
  // check. The canonical guard does both correctly.
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const { id } = await params;
  const admin = getAdminClient();

  const body = await req.json();
  const allowed = ['code','type','value','min_order_amount','applies_to','applicable_product_ids','applicable_category_ids','max_uses','is_single_use_per_customer','valid_from','valid_until','is_active','notes'];
  const updates: any = {};
  for (const k of allowed) if (k in body) updates[k] = body[k];

  const { data, error } = await admin.from('promo_codes').update(updates).eq('id', id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ promo: data });
}
