import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { getManagerByToken } from '@/lib/sales/commission';
import { BUSINESS_TYPE_LABELS, type LeadBusinessType } from '@/lib/leads/offers';
import { normalizeInstagram } from '@/lib/leads/contacts';

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
  const instagram = normalizeInstagram(body?.instagram);
  const phone = body?.phone ? String(body.phone).slice(0, 40) : null;

  // Лід без жодного каналу звʼязку — це просто назва: ні написати, ні згодом
  // оформити партнером.
  if (!email && !instagram && !phone) {
    return NextResponse.json({ error: 'Вкажіть email, Instagram або телефон' }, { status: 400 });
  }

  // A lead already worked by someone else must not be silently re-owned: the
  // manager is told who has it instead of creating a duplicate. Instagram
  // рахується так само, як пошта: більшість холодних контактів приходить саме
  // звідти, і без цієї перевірки двоє менеджерів писали б у той самий директ.
  const dupChecks: { column: string; value: string; label: string }[] = [];
  if (email) dupChecks.push({ column: 'email', value: email, label: 'таким email' });
  if (instagram) dupChecks.push({ column: 'instagram', value: instagram, label: 'таким Instagram' });

  for (const check of dupChecks) {
    const { data: dup } = await admin
      .from('leads')
      .select('id, sales_manager_id, business_name')
      .ilike(check.column, check.value)
      .maybeSingle();
    if (dup) {
      const mine = dup.sales_manager_id === manager.id;
      return NextResponse.json({
        error: mine
          ? `«${dup.business_name}» вже є у вашому списку`
          : `Контакт з ${check.label} уже веде інший менеджер`,
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
      phone,
      website: body?.website ? String(body.website).slice(0, 300) : null,
      instagram,
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
  // Пошта й нікнейм дописуються пізніше: контакт із директу спершу існує без
  // email, а email зʼявляється в розмові — і без нього не оформити партнера.
  if (typeof body?.email === 'string') {
    const email = body.email.trim().toLowerCase();
    if (email) {
      const { data: dup } = await admin
        .from('leads').select('id').ilike('email', email).neq('id', id).maybeSingle();
      if (dup) return NextResponse.json({ error: 'Цей email уже стоїть в іншого ліда' }, { status: 409 });
    }
    patch.email = email || null;
  }
  if (typeof body?.instagram === 'string') {
    const instagram = normalizeInstagram(body.instagram);
    if (instagram) {
      const { data: dup } = await admin
        .from('leads').select('id').ilike('instagram', instagram).neq('id', id).maybeSingle();
      if (dup) return NextResponse.json({ error: 'Цей Instagram уже стоїть в іншого ліда' }, { status: 409 });
    }
    patch.instagram = instagram;
  }

  const { error } = await admin.from('leads').update(patch).eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
