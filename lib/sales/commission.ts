import type { SupabaseClient } from '@supabase/supabase-js';
import { likeEscape } from '@/lib/supabase/like-escape';

/**
 * Sales-manager commissions.
 *
 * A manager brings a partner into the program — a photographer, a wedding or a
 * travel agency. From then on that partner earns them money in two ways
 * (Diana, 2026-08-05):
 *
 *   1 % of every order that came through the partner's referral code
 *       (the partner's own orders and their clients' orders alike — both carry
 *       the same promo code, which is how the partner program already works)
 *   5 % of every gallery storage plan a photographer they brought pays for
 *
 * Rates are per manager, so a different deal for one person needs no code.
 *
 * Every accrual writes one sales_commissions row with a UNIQUE (kind,
 * source_id); a repeated webhook therefore inserts nothing instead of paying
 * twice. Money is never granted from a request body — both call sites run
 * after the payment has already been confirmed server-side.
 */

export type CommissionKind = 'order' | 'gallery';

interface AccrueResult {
  amount: number;
  managerId?: string;
}

async function insertCommission(
  admin: SupabaseClient,
  row: {
    manager_id: string; kind: CommissionKind; source_id: string;
    partner_id?: string | null; photographer_id?: string | null;
    base_amount: number; rate: number; amount: number; note?: string;
  },
): Promise<number> {
  const { error } = await admin.from('sales_commissions').insert(row);
  if (error) {
    // 23505 = the UNIQUE(kind, source_id) guard: this source was already paid.
    if ((error as any).code === '23505') return 0;
    console.error('[sales-commission] insert failed', error.message);
    return 0;
  }
  // Running total for the cabinet header; the rows stay the source of truth.
  const { data: mgr } = await admin
    .from('sales_managers').select('total_earned').eq('id', row.manager_id).maybeSingle();
  await admin
    .from('sales_managers')
    .update({ total_earned: Number(mgr?.total_earned || 0) + row.amount, updated_at: new Date().toISOString() })
    .eq('id', row.manager_id);
  return row.amount;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * An order was paid with a partner's referral code. Credits the manager who
 * brought that partner, if there is one.
 */
export async function accrueOrderCommission(
  admin: SupabaseClient,
  opts: { orderId: string; promoCode: string | null; orderTotal: number },
): Promise<AccrueResult> {
  const code = String(opts.promoCode || '').trim().toUpperCase();
  if (!code || !opts.orderTotal) return { amount: 0 };

  const { data: partner } = await admin
    .from('agency_partners')
    .select('id, sales_manager_id, status, agency_name')
    .ilike('referral_code', likeEscape(code))
    .maybeSingle();
  if (!partner?.sales_manager_id || partner.status !== 'active') return { amount: 0 };

  const { data: manager } = await admin
    .from('sales_managers')
    .select('id, rate_order, is_active')
    .eq('id', partner.sales_manager_id)
    .maybeSingle();
  if (!manager?.is_active) return { amount: 0 };

  const rate = Number(manager.rate_order) || 0;
  if (rate <= 0) return { amount: 0 };
  const amount = round2(opts.orderTotal * rate / 100);
  if (amount <= 0) return { amount: 0 };

  const paid = await insertCommission(admin, {
    manager_id: manager.id, kind: 'order', source_id: opts.orderId,
    partner_id: partner.id, base_amount: opts.orderTotal, rate, amount,
    note: `Замовлення за кодом ${code} (${partner.agency_name || 'партнер'})`,
  });
  return { amount: paid, managerId: manager.id };
}

/**
 * A photographer paid for a gallery storage plan. Credits the manager who
 * brought that photographer.
 */
export async function accrueGalleryCommission(
  admin: SupabaseClient,
  opts: { subscriptionId: string; photographerId: string; amountUah: number; planName?: string },
): Promise<AccrueResult> {
  if (!opts.amountUah) return { amount: 0 };

  const { data: photographer } = await admin
    .from('photographers')
    .select('id, name, sales_manager_id')
    .eq('id', opts.photographerId)
    .maybeSingle();
  if (!photographer?.sales_manager_id) return { amount: 0 };

  const { data: manager } = await admin
    .from('sales_managers')
    .select('id, rate_gallery, is_active')
    .eq('id', photographer.sales_manager_id)
    .maybeSingle();
  if (!manager?.is_active) return { amount: 0 };

  const rate = Number(manager.rate_gallery) || 0;
  if (rate <= 0) return { amount: 0 };
  const amount = round2(opts.amountUah * rate / 100);
  if (amount <= 0) return { amount: 0 };

  const paid = await insertCommission(admin, {
    manager_id: manager.id, kind: 'gallery', source_id: opts.subscriptionId,
    photographer_id: photographer.id, base_amount: opts.amountUah, rate, amount,
    note: `Тариф пам'яті${opts.planName ? ` «${opts.planName}»` : ''} — ${photographer.name || 'фотограф'}`,
  });
  return { amount: paid, managerId: manager.id };
}

/** Resolve a manager by their private cabinet link. */
export async function getManagerByToken(admin: SupabaseClient, token: string) {
  if (!token) return null;
  const { data } = await admin
    .from('sales_managers')
    .select('*')
    .eq('cabinet_token', token)
    .eq('is_active', true)
    .maybeSingle();
  return data;
}
