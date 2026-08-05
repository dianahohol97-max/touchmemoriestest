import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/guards';
import { getAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

/**
 * Admin side of the sales-manager program: create managers, adjust their
 * rates, attach the partners they closed, and mark commissions as paid out.
 *
 * Attribution is set here rather than by the manager, for the obvious reason —
 * whoever gets credited for a partner must not be able to credit themselves.
 */

export async function GET() {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const admin = getAdminClient();
  const [{ data: managers }, { data: commissions }, { data: partners }, { data: photographers }] = await Promise.all([
    admin.from('sales_managers').select('*').order('created_at', { ascending: false }),
    admin.from('sales_commissions').select('*').order('created_at', { ascending: false }).limit(500),
    admin.from('agency_partners').select('id, agency_name, partner_kind, referral_code, sales_manager_id').order('created_at', { ascending: false }),
    admin.from('photographers').select('id, name, email, plan, sales_manager_id').eq('is_active', true).order('created_at', { ascending: false }),
  ]);

  const leadCounts: Record<string, number> = {};
  const { data: leads } = await admin.from('leads').select('sales_manager_id');
  (leads || []).forEach((l: any) => {
    if (l.sales_manager_id) leadCounts[l.sales_manager_id] = (leadCounts[l.sales_manager_id] || 0) + 1;
  });

  return NextResponse.json({
    managers: managers || [],
    commissions: commissions || [],
    partners: partners || [],
    photographers: photographers || [],
    lead_counts: leadCounts,
  });
}

/** POST — create a manager. Returns the cabinet link to hand over. */
export async function POST(request: Request) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const body = await request.json().catch(() => ({}));
  const name = String(body?.name || '').trim();
  if (!name) return NextResponse.json({ error: 'Вкажіть імʼя менеджера' }, { status: 400 });

  const admin = getAdminClient();
  const { data, error } = await admin
    .from('sales_managers')
    .insert({
      name: name.slice(0, 120),
      email: body?.email ? String(body.email).trim().toLowerCase() : null,
      phone: body?.phone ? String(body.phone).slice(0, 40) : null,
      rate_order: Number(body?.rate_order) > 0 ? Number(body.rate_order) : 1,
      rate_gallery: Number(body?.rate_gallery) > 0 ? Number(body.rate_gallery) : 5,
      payout_account: body?.payout_account ? String(body.payout_account).slice(0, 200) : null,
    })
    .select('*')
    .single();
  if (error) {
    const dup = (error as any).code === '23505';
    return NextResponse.json({ error: dup ? 'Менеджер з таким email уже є' : error.message }, { status: dup ? 409 : 500 });
  }
  return NextResponse.json({ manager: data });
}

/**
 * PATCH — one of:
 *   { manager_id, rate_order?, rate_gallery?, is_active?, payout_account? }
 *   { assign: 'partner' | 'photographer', target_id, manager_id | null }
 *   { commission_id, status: 'paid' | 'pending' | 'cancelled' }
 */
export async function PATCH(request: Request) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const body = await request.json().catch(() => ({}));
  const admin = getAdminClient();

  if (body?.assign) {
    const table = body.assign === 'partner' ? 'agency_partners' : 'photographers';
    const managerId = body?.manager_id ? String(body.manager_id) : null;
    const { error } = await admin
      .from(table)
      .update({ sales_manager_id: managerId })
      .eq('id', String(body?.target_id || ''));
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (body?.commission_id) {
    const status = ['paid', 'pending', 'cancelled'].includes(String(body?.status)) ? String(body.status) : null;
    if (!status) return NextResponse.json({ error: 'Невідомий статус' }, { status: 400 });

    const { data: row } = await admin
      .from('sales_commissions').select('id, manager_id, amount, status')
      .eq('id', String(body.commission_id)).maybeSingle();
    if (!row) return NextResponse.json({ error: 'Рядок не знайдено' }, { status: 404 });

    const { error } = await admin
      .from('sales_commissions')
      .update({ status, paid_at: status === 'paid' ? new Date().toISOString() : null })
      .eq('id', row.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Keep the manager's paid total in step with the ledger.
    if (row.status !== status) {
      const { data: mgr } = await admin
        .from('sales_managers').select('total_paid').eq('id', row.manager_id).maybeSingle();
      const delta = status === 'paid' ? Number(row.amount) : row.status === 'paid' ? -Number(row.amount) : 0;
      if (delta !== 0) {
        await admin.from('sales_managers')
          .update({ total_paid: Math.max(0, Number(mgr?.total_paid || 0) + delta) })
          .eq('id', row.manager_id);
      }
    }
    return NextResponse.json({ ok: true });
  }

  const managerId = String(body?.manager_id || '');
  if (!managerId) return NextResponse.json({ error: 'Некоректний запит' }, { status: 400 });
  const patch: Record<string, any> = { updated_at: new Date().toISOString() };
  if (body?.rate_order !== undefined) patch.rate_order = Number(body.rate_order) || 0;
  if (body?.rate_gallery !== undefined) patch.rate_gallery = Number(body.rate_gallery) || 0;
  if (body?.is_active !== undefined) patch.is_active = Boolean(body.is_active);
  if (body?.payout_account !== undefined) patch.payout_account = String(body.payout_account || '').slice(0, 200);

  const { error } = await admin.from('sales_managers').update(patch).eq('id', managerId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
