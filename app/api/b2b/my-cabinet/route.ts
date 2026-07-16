import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { getRoleConfig } from '@/lib/b2b/config';

export const dynamic = 'force-dynamic';

/**
 * Resolve the logged-in user's B2B partner status (role, verification state,
 * discount config) from their customer account. Powers the account-gated
 * partner cabinets — e.g. the wedding-agency cabinet at /wedding-agency/cabinet
 * — the same way /api/photographers/my-cabinet resolves a photographer's token.
 *
 * Wedding agencies (and other discount-only roles) have no unguessable cabinet
 * token: their "cabinet" is simply gated by the account login, so this returns
 * everything the cabinet needs to render the discount state.
 */
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ loggedIn: false });

  const admin = getAdminClient();
  const { data: customer } = await admin
    .from('customers')
    .select('id, email, name, b2b_role, b2b_status')
    .or(`auth_user_id.eq.${user.id},id.eq.${user.id}`)
    .maybeSingle();

  const role = customer?.b2b_role ?? null;
  const status = customer?.b2b_status ?? null;
  const cfg = getRoleConfig(role);

  return NextResponse.json({
    loggedIn: true,
    role,
    status,
    name: customer?.name ?? null,
    email: customer?.email ?? user.email ?? null,
    discountPercent: cfg?.discountPercent ?? 0,
    label: cfg?.label ?? null,
  });
}
