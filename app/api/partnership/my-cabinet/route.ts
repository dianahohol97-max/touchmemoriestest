import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { likeEscape } from '@/lib/supabase/like-escape';

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
 *
 * Відколи 16.09.2026 картка партнера зʼявилася ще й у кабінеті клієнта, той
 * самий маршрут віддає `partner` — усе, що потрібно для картки: посилання,
 * код, ставки й суму до виплати. Окремого маршруту не заводимо, щоб пошук
 * партнера за поштою не роздвоївся.
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
    .select('id, cabinet_token, agency_name, status, partner_kind, referral_code, travelbook_rate, other_rate, promo_code_id')
    .ilike('email', likeEscape(email))
    .order('created_at', { ascending: false })
    .limit(1);
  const partner = partners?.[0];

  // Картка в кабінеті клієнта показується лише для ЧИННОГО партнерства. Для
  // призупиненого рекламувати кабінет і код було б обіцянкою, якої система не
  // дотримає: код у promo_codes на той час уже вимкнений.
  const active = partner && String(partner.status || '').trim().toLowerCase() === 'active';

  let block: Record<string, any> | null = null;
  if (active) {
    // Знижка клієнта живе в промокоді, а не в партнері — беремо звідти, щоб у
    // картці не зʼявилося число, якого насправді немає в чекауті.
    const [{ data: promo }, { data: commissions }] = await Promise.all([
      partner.promo_code_id
        ? admin.from('promo_codes').select('type, value, is_active').eq('id', partner.promo_code_id).maybeSingle()
        : Promise.resolve({ data: null } as any),
      admin.from('agency_commissions')
        .select('total_commission, payout_status')
        .eq('agency_id', partner.id)
        .eq('payout_status', 'pending'),
    ]);

    const pending = (commissions || []).reduce((sum: number, row: any) => sum + (Number(row.total_commission) || 0), 0);

    block = {
      agency_name: partner.agency_name,
      partner_kind: partner.partner_kind,
      referral_code: partner.referral_code,
      travelbook_rate: Number(partner.travelbook_rate) || 0,
      other_rate: Number(partner.other_rate) || 0,
      // Нуль у картці не показуємо зовсім, тож сюди він і не їде.
      pending_payout: pending > 0 ? Math.round(pending) : 0,
      client_discount: promo?.is_active && promo?.type === 'percent' ? Number(promo.value) || 0 : 0,
    };
  }

  return NextResponse.json({
    loggedIn: true,
    cabinet_token: partner?.cabinet_token || null,
    agency_name: partner?.agency_name || null,
    partner: block,
  });
}
