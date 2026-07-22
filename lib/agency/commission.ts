import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * A travelbook item is identified by its slug. All travelbook products use a
 * slug starting with "travelbook" and sit in the "travelbooks" category. We
 * match on the slug prefix (robust to size variants like travelbook-20x30).
 */
function isTravelbookItem(item: any): boolean {
  const slug = String(item?.slug || '').toLowerCase();
  return slug.startsWith('travelbook') || slug.includes('travel-book');
}

function itemTotal(item: any): number {
  const t = Number(item?.total_price);
  if (Number.isFinite(t)) return t;
  const unit = Number(item?.unit_price) || 0;
  const qty = Number(item?.quantity) || 1;
  return unit * qty;
}

/**
 * Process an agency referral commission when an order transitions to paid.
 *
 * Idempotent (a UNIQUE(order_id) on agency_commissions + an existence check
 * make webhook retries safe). Looks up the agency by the order's promo_code,
 * splits the order items into travelbook vs other subtotals, applies the
 * agency's OWN per-partner rates (travelbook_rate / other_rate — set at
 * approval, defaulting to 5% travelbook / 3% other), writes one
 * agency_commissions row, and bumps the agency's total_earned.
 *
 * Returns the commission amount granted, or 0 if no agency code applied.
 */
export async function processAgencyCommission(
  admin: SupabaseClient,
  opts: { orderId: string; promoCode: string | null; items: any[] },
): Promise<number> {
  const { orderId, promoCode, items } = opts;
  if (!promoCode) return 0;
  const code = promoCode.trim().toUpperCase();
  if (!code) return 0;

  // Is this promo code an agency partner code?
  const { data: agency } = await admin
    .from('agency_partners')
    .select('id, travelbook_rate, other_rate, total_earned, status')
    .ilike('referral_code', code)
    .maybeSingle();
  if (!agency || agency.status !== 'active') return 0;

  // Already recorded for this order? (idempotency)
  const { data: existing } = await admin
    .from('agency_commissions')
    .select('id')
    .eq('order_id', orderId)
    .maybeSingle();
  if (existing) return 0;

  // Split items into travelbook vs other subtotals.
  let travelbookSubtotal = 0;
  let otherSubtotal = 0;
  for (const item of Array.isArray(items) ? items : []) {
    const total = itemTotal(item);
    if (isTravelbookItem(item)) travelbookSubtotal += total;
    else otherSubtotal += total;
  }

  const tbRate = Number(agency.travelbook_rate) || 0;
  const otherRate = Number(agency.other_rate) || 0;
  const travelbookCommission = Math.round(travelbookSubtotal * tbRate) / 100;
  const otherCommission = Math.round(otherSubtotal * otherRate) / 100;
  const totalCommission = travelbookCommission + otherCommission;
  if (totalCommission <= 0) return 0;

  // Insert the commission ledger row. UNIQUE(order_id) guards double-credit;
  // if a concurrent webhook retry beat us, the insert fails and we stop.
  const { error: insErr } = await admin.from('agency_commissions').insert({
    agency_id: agency.id,
    order_id: orderId,
    travelbook_subtotal: travelbookSubtotal,
    other_subtotal: otherSubtotal,
    travelbook_commission: travelbookCommission,
    other_commission: otherCommission,
    total_commission: totalCommission,
    payout_status: 'pending',
  });
  if (insErr) return 0; // likely the UNIQUE(order_id) race guard — already credited

  // Bump the agency running total.
  await admin
    .from('agency_partners')
    .update({ total_earned: Number(agency.total_earned || 0) + totalCommission })
    .eq('id', agency.id);

  return totalCommission;
}
