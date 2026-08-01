import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { requireStaff } from '@/lib/auth/guards';
import { buildCoverColorIndex } from '@/lib/cover-colors';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/cover-colors
 *
 * The active cover-colour index (code, name, hex, cover type) for the admin UI.
 *
 * New orders carry their colour code from /api/orders/submit, but every order
 * placed before that stores only the name — and a name alone is not enough to
 * order material («Темно-зелений» is В-13 in velour, Ш-21 in leatherette). The
 * admin order page uses this to resolve those historical orders at display
 * time, so the workshop sees a code instead of a guess.
 */
export async function GET() {
  const guard = await requireStaff();
  if (!guard.ok) return guard.response;

  const admin = getAdminClient();
  const { data, error } = await admin
    .from('cover_colors')
    .select('code, name, hex_approx, cover_type:cover_types(name)')
    .eq('active', true)
    .order('sort_order', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ colors: buildCoverColorIndex(data || []) });
}
