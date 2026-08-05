import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/guards';
import { getAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

/**
 * Дашборд партнерської програми (Diana, 2026-08-06: «ліди, замовлення,
 * конверсія — було б круто бачити по партнерках»).
 *
 * Одна відповідь на все, що показує сторінка: воронка лідів зі статусами,
 * розріз по менеджерах, партнери, замовлення за партнерськими кодами й
 * комісії. Замовлення беруться з agency_commissions — рядок там зʼявляється
 * лише після ПІДТВЕРДЖЕНОЇ оплати замовлення з кодом партнера, тож «замовлення
 * за кодами» тут означає оплачені, а не створені.
 */
export async function GET() {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const admin = getAdminClient();
  const monthAgo = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();

  const [
    { data: leads },
    { data: managers },
    { data: partners },
    { data: agencyRows },
    { data: salesRows },
    { data: pendingRequests },
  ] = await Promise.all([
    admin.from('leads').select('id, status, source, sales_manager_id, created_at'),
    admin.from('sales_managers').select('id, name, is_active, total_earned, total_paid'),
    admin.from('agency_partners').select('id, status, partner_kind, sales_manager_id, total_earned, created_at'),
    admin.from('agency_commissions').select('agency_id, travelbook_subtotal, other_subtotal, total_commission, created_at'),
    admin.from('sales_commissions').select('manager_id, amount, status'),
    admin.from('partner_activation_requests').select('id').eq('status', 'pending'),
  ]);

  // --- Воронка лідів ---
  const funnel: Record<string, number> = { new: 0, contacted: 0, replied: 0, qualified: 0, won: 0, lost: 0 };
  const bySource: Record<string, number> = {};
  (leads || []).forEach((l: any) => {
    funnel[l.status] = (funnel[l.status] || 0) + 1;
    bySource[l.source || 'manual'] = (bySource[l.source || 'manual'] || 0) + 1;
  });
  const leadsTotal = (leads || []).length;

  // --- Розріз по менеджерах ---
  const managerRows = (managers || []).map((m: any) => {
    const own = (leads || []).filter((l: any) => l.sales_manager_id === m.id);
    const won = own.filter((l: any) => l.status === 'won').length;
    const ownPartners = (partners || []).filter((p: any) => p.sales_manager_id === m.id);
    const pending = (salesRows || [])
      .filter((c: any) => c.manager_id === m.id && c.status === 'pending')
      .reduce((s: number, c: any) => s + Number(c.amount || 0), 0);
    return {
      id: m.id,
      name: m.name,
      is_active: m.is_active,
      leads: own.length,
      won,
      conversion: own.length ? Math.round((won / own.length) * 1000) / 10 : null,
      partners: ownPartners.length,
      earned: Number(m.total_earned || 0),
      pending: Math.round(pending * 100) / 100,
    };
  });

  // --- Партнери ---
  const partnerStats = {
    total: (partners || []).length,
    active: (partners || []).filter((p: any) => p.status === 'active').length,
    via_manager: (partners || []).filter((p: any) => p.sales_manager_id).length,
    self_came: (partners || []).filter((p: any) => !p.sales_manager_id).length,
  };

  // --- Замовлення за партнерськими кодами (оплачені) ---
  const orderStats = (rows: any[]) => ({
    orders: rows.length,
    revenue: Math.round(rows.reduce((s, r) => s + Number(r.travelbook_subtotal || 0) + Number(r.other_subtotal || 0), 0)),
    partner_commission: Math.round(rows.reduce((s, r) => s + Number(r.total_commission || 0), 0)),
  });
  const all = agencyRows || [];
  const recent = all.filter((r: any) => r.created_at >= monthAgo);

  // Конверсія «партнер → продає»: скільки партнерів мають хоч одне замовлення.
  const sellingPartners = new Set(all.map((r: any) => r.agency_id)).size;

  return NextResponse.json({
    leads: {
      total: leadsTotal,
      funnel,
      by_source: bySource,
      conversion: leadsTotal ? Math.round((funnel.won / leadsTotal) * 1000) / 10 : null,
      free_pool: (leads || []).filter((l: any) => !l.sales_manager_id).length,
    },
    managers: managerRows,
    partners: { ...partnerStats, selling: sellingPartners },
    orders: {
      last_30_days: orderStats(recent),
      all_time: orderStats(all),
    },
    pending_requests: (pendingRequests || []).length,
  });
}
