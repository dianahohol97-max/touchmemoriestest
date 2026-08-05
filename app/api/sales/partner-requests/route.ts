import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { getManagerByToken } from '@/lib/sales/commission';
import { DEFAULT_PARTNER_TERMS } from '@/lib/agency/create-partner';
import { leadTypeToPartnerKind, PARTNER_KINDS } from '@/lib/sales/partner-activation';

export const dynamic = 'force-dynamic';

/**
 * Заявка менеджера на оформлення ліда партнером (Diana, 2026-08-06).
 *
 * Менеджер домовився — далі одна кнопка замість трьох ручних кроків в
 * адмінці. Але сам партнер тут НЕ створюється: партнер означає живий
 * промокод зі знижкою на сайті, а менеджер має відсоток із кожного
 * залученого партнера, тож видавати знижки самому собі він не повинен.
 * Заявка лягає адміністратору, і вже підтвердження створює код, привʼязує
 * менеджера, переводить ліда в «Угоду» і надсилає партнеру лист.
 *
 * Умови (знижка клієнту та ставки комісії) сюди не приймаються взагалі —
 * заявка створюється зі стандартними значеннями, змінити їх може лише
 * адміністратор перед підтвердженням.
 */

/** POST — подати заявку по власному ліду. */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const admin = getAdminClient();
  const manager = await getManagerByToken(admin, String(body?.token || ''));
  if (!manager) return NextResponse.json({ error: 'Кабінет не знайдено' }, { status: 404 });

  const { data: lead } = await admin
    .from('leads').select('*').eq('id', String(body?.lead_id || '')).maybeSingle();
  if (!lead || lead.sales_manager_id !== manager.id) {
    return NextResponse.json({ error: 'Ліда не знайдено' }, { status: 404 });
  }

  // Пошта обовʼязкова навіть тоді, коли лід вели в директі: на неї йде код,
  // умови й посилання на партнерський кабінет, і за нею партнер згодом
  // привʼязує свій акаунт на сайті.
  const email = String(body?.email || lead.email || '').trim().toLowerCase();
  if (!email || !email.includes('@')) {
    return NextResponse.json({
      error: 'Потрібен email партнера — на нього прийде код і посилання на кабінет',
    }, { status: 400 });
  }

  const partnerKind = PARTNER_KINDS.includes(body?.partner_kind)
    ? body.partner_kind
    : leadTypeToPartnerKind(lead.business_type);

  // Партнер із такою поштою вже може існувати — наприклад, фотограф сам
  // увімкнув реферальний код у своєму кабінеті. Другий код тій самій людині
  // означав би дві знижки й розбите нарахування.
  const { data: existingPartner } = await admin
    .from('agency_partners')
    .select('id, agency_name, referral_code, sales_manager_id')
    .ilike('email', email)
    .maybeSingle();
  if (existingPartner) {
    return NextResponse.json({
      error: existingPartner.sales_manager_id === manager.id
        ? `«${existingPartner.agency_name}» вже ваш партнер, код ${existingPartner.referral_code}`
        : 'Партнер із такою поштою вже є в програмі. Напишіть Діані, щоб перевірити, хто його веде.',
    }, { status: 409 });
  }

  const { data, error } = await admin
    .from('partner_activation_requests')
    .insert({
      lead_id: lead.id,
      manager_id: manager.id,
      business_name: String(lead.business_name).slice(0, 200),
      contact_name: body?.contact_name ? String(body.contact_name).slice(0, 120) : lead.contact_name,
      email,
      phone: body?.phone ? String(body.phone).slice(0, 40) : lead.phone,
      website: lead.website,
      instagram: lead.instagram,
      partner_kind: partnerKind,
      client_discount: DEFAULT_PARTNER_TERMS.clientDiscount,
      travelbook_rate: DEFAULT_PARTNER_TERMS.travelbookRate,
      other_rate: DEFAULT_PARTNER_TERMS.otherRate,
      comment: body?.comment ? String(body.comment).slice(0, 2000) : null,
    })
    .select('*')
    .single();

  if (error) {
    // 23505 = частковий UNIQUE по lead_id серед відкритих заявок.
    if ((error as any).code === '23505') {
      return NextResponse.json({ error: 'Заявка по цьому ліду вже на розгляді' }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Лід переходить у «Кваліфікований», якщо був раніше: угода домовлена, але
  // «Угоду» ставить уже підтвердження — статус не має випереджати реальність.
  if (['new', 'contacted', 'replied'].includes(lead.status)) {
    await admin.from('leads')
      .update({ status: 'qualified', updated_at: new Date().toISOString() })
      .eq('id', lead.id);
  }
  if (email !== (lead.email || '').toLowerCase()) {
    await admin.from('leads').update({ email }).eq('id', lead.id);
  }

  return NextResponse.json({ request: data });
}
