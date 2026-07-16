import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

/**
 * Resolve the logged-in user's travel-partner cabinet from their account, so
 * agencies/bloggers can reach the cabinet through login instead of the emailed
 * token link. Partners are admin-created (no account of their own), so the link
 * is by email: a partner signs in with an account registered on the same email
 * as their agency_partners row.
 *
 * Returns { loggedIn, cabinet_token, agency_name } — the /partner/cabinet entry
 * page redirects to the real token URL, or shows a login / apply prompt.
 */
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ loggedIn: false });

  const email = (user.email || '').toLowerCase();
  if (!email) return NextResponse.json({ loggedIn: true, cabinet_token: null });

  const admin = getAdminClient();
  const { data: partners } = await admin
    .from('agency_partners')
    .select('cabinet_token, agency_name, status')
    .ilike('email', email)
    .order('created_at', { ascending: false })
    .limit(1);
  const partner = partners?.[0];

  return NextResponse.json({
    loggedIn: true,
    cabinet_token: partner?.cabinet_token || null,
    agency_name: partner?.agency_name || null,
  });
}
