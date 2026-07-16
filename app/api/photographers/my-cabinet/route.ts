import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

/**
 * Resolve the logged-in user's photographer cabinet token from their account,
 * so they can reach the cabinet without the emailed link. Matched by the
 * photographers.customer_id link or by email.
 *
 * Returns { loggedIn, cabinet_token, slug } — the memorable /photographer/cabinet
 * page uses this to redirect people to their real token URL (or to login /
 * signup when there's nothing to open).
 */
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ loggedIn: false });

  const admin = getAdminClient();
  const { data: customer } = await admin
    .from('customers')
    .select('id, email')
    .or(`auth_user_id.eq.${user.id},id.eq.${user.id}`)
    .maybeSingle();

  const email = customer?.email || user.email || '';
  const conds = [
    customer ? `customer_id.eq.${customer.id}` : '',
    email ? `email.ilike.${email}` : '',
  ].filter(Boolean);
  if (!conds.length) return NextResponse.json({ loggedIn: true, cabinet_token: null });

  const { data: ph } = await admin
    .from('photographers')
    .select('cabinet_token, slug, customer_id, is_active')
    .or(conds.join(','))
    .maybeSingle();

  // Backfill the customer link so future lookups are fast/robust.
  if (ph && !ph.customer_id && customer) {
    await admin.from('photographers').update({ customer_id: customer.id }).eq('cabinet_token', ph.cabinet_token);
  }

  return NextResponse.json({
    loggedIn: true,
    cabinet_token: ph?.is_active ? ph.cabinet_token : null,
    slug: ph?.slug || null,
  });
}
