import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { getManagerByToken } from '@/lib/sales/commission';
import { BUSINESS_TYPE_LABELS, type LeadBusinessType } from '@/lib/leads/offers';

export const dynamic = 'force-dynamic';

const TYPES = Object.keys(BUSINESS_TYPE_LABELS) as LeadBusinessType[];
const STATUSES = ['new', 'contacted', 'replied', 'qualified', 'won', 'lost'];

/**
 * Leads owned by one sales manager. They add their own contacts here (Diana,
 * 2026-08-05: «важливо щоб вони самостійно могли вносити цих лідів»), and
 * every row is stamped with their id, which is also what the commission
 * attribution later hangs off.
 *
 * A manager can only ever touch rows carrying their own sales_manager_id — the
 * filter is applied server-side, never taken from the request.
 */

/** POST — create a lead. */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const admin = getAdminClient();
  const manager = await getManagerByToken(admin, String(body?.token || ''));
  if (!manager) return NextResponse.json({ error: 'Кабінет не знайдено' }, { status: 404 });

  const businessName = String(body?.business_name || '').trim();
  if (!businessName) return NextResponse.json({ error: 'Вкажіть назву бізнесу' }, { status: 400 });

  const email = body?.email ? String(body.email).trim().toLowerCase() : null;
  if (email) {
    // A lead already worked by someone else must not be silently re-owned:
    // the manager is told who has it instead of creating a duplicate.
    const { data: dup } = await admin
      .from('leads')
      .select('id, sales_manager_id, business_name')
      .ilike('email', email)
      .maybeSingle();
    if (dup) {
      const mine = dup.sales_manager_id === manager.id;
      return NextResponse.json({
        error: mine
          ? `«${dup.business_name}» вже є у вашому списку`
          : 'Контакт з таким email уже веде інший менеджер',
      }, { status: 409 });
    }
  }

  const businessType = TYPES.includes(body?.business_type) ? body.business_type : 'other';
  const { data, error } = await admin
    .from('leads')
    .insert({
      business_type: businessType,
      business_name: businessName.slice(0, 200),
      contact_name: body?.contact_name ? String(body.contact_name).slice(0, 120) : null,
      email,
      phone: body?.phone ? String(body.phone).slice(0, 40) : null,
      website: body?.website ? String(body.website).slice(0, 300) : null,
      instagram: body?.instagram ? String(body.instagram).replace(/^@/, '').slice(0, 100) : null,
      city: body?.city ? String(body.city).slice(0, 100) : null,
      notes: body?.notes ? String(body.notes).slice(0, 2000) : null,
      source: 'manager',
      status: 'new',
      sales_manager_id: manager.id,
    })
    .select('*')
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ lead: data });
}

/** PATCH — update status or notes of an own lead. */
export async function PATCH(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const admin = getAdminClient();
  const manager = await getManagerByToken(admin, String(body?.token || ''));
  if (!manager) return NextResponse.json({ error: 'Кабінет не знайдено' }, { status: 404 });

  const id = String(body?.lead_id || '');
  const { data: lead } = await admin
    .from('leads').select('id, sales_manager_id').eq('id', id).maybeSingle();
  if (!lead || lead.sales_manager_id !== manager.id) {
    return NextResponse.json({ error: 'Ліда не знайдено' }, { status: 404 });
  }

  const patch: Record<string, any> = { updated_at: new Date().toISOString() };
  if (body?.status && STATUSES.includes(String(body.status))) patch.status = body.status;
  if (typeof body?.notes === 'string') patch.notes = body.notes.slice(0, 2000);
  if (typeof body?.contact_name === 'string') patch.contact_name = body.contact_name.slice(0, 120);
  if (typeof body?.phone === 'string') patch.phone = body.phone.slice(0, 40);

  const { error } = await admin.from('leads').update(patch).eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
