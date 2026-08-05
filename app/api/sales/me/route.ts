import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { getManagerByToken } from '@/lib/sales/commission';

export const dynamic = 'force-dynamic';

/**
 * Everything the sales cabinet shows on load: who the manager is, their leads,
 * the partners they brought, their commission rows and the money summary.
 * Auth is the private cabinet token — the manager only ever sees their own
 * rows, because every query is filtered by their id server-side.
 */
export async function GET(req: NextRequest) {
  const admin = getAdminClient();
  const manager = await getManagerByToken(admin, req.nextUrl.searchParams.get('token') || '');
  if (!manager) return NextResponse.json({ error: 'Кабінет не знайдено' }, { status: 404 });

  const [{ data: leads }, { data: partners }, { data: photographers }, { data: commissions }] = await Promise.all([
    admin.from('leads')
      .select('id, business_type, business_name, contact_name, email, phone, website, instagram, city, status, offer_sent_at, notes, created_at')
      .eq('sales_manager_id', manager.id)
      .order('created_at', { ascending: false })
      .limit(500),
    admin.from('agency_partners')
      .select('id, agency_name, partner_kind, referral_code, status, total_earned, created_at')
      .eq('sales_manager_id', manager.id)
      .order('created_at', { ascending: false }),
    admin.from('photographers')
      .select('id, name, email, plan, plan_expires_at, created_at')
      .eq('sales_manager_id', manager.id)
      .order('created_at', { ascending: false }),
    admin.from('sales_commissions')
      .select('id, kind, base_amount, rate, amount, status, note, created_at, paid_at')
      .eq('manager_id', manager.id)
      .order('created_at', { ascending: false })
      .limit(300),
  ]);

  const rows = commissions || [];
  const sum = (f: (r: any) => boolean) => rows.filter(f).reduce((s, r) => s + Number(r.amount || 0), 0);

  return NextResponse.json({
    manager: {
      id: manager.id, name: manager.name, email: manager.email,
      rate_order: Number(manager.rate_order), rate_gallery: Number(manager.rate_gallery),
      payout_account: manager.payout_account || null,
    },
    leads: leads || [],
    partners: partners || [],
    photographers: photographers || [],
    commissions: rows,
    money: {
      total: Math.round(sum(() => true) * 100) / 100,
      pending: Math.round(sum(r => r.status === 'pending') * 100) / 100,
      paid: Math.round(sum(r => r.status === 'paid') * 100) / 100,
    },
  });
}
