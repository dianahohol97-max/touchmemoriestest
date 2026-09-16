import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { requireStaff, requirePartnerApprover } from '@/lib/auth/guards';
import { sendPartnerWelcomeEmail } from '@/lib/agency/welcome-email';
import { findLeadAttribution, attachManagerToPartner, logAttributionClaim } from '@/lib/sales/attribution';

export const dynamic = 'force-dynamic';

// Створення партнера цілком живе в lib/agency/create-partner: цей роут,
// підтвердження заявки менеджера і кабінет фотографа заводять партнера однією
// функцією, тож розійтися в умовах чи в перевірках їм більше немає де.
import { createAgencyPartner, DEFAULT_PARTNER_TERMS } from '@/lib/agency/create-partner';
import { PARTNER_KINDS, type PartnerKind } from '@/lib/sales/partner-activation';
import { likeEscape } from '@/lib/supabase/like-escape';

// GET — list all agency partners with their commission totals + pending payout
export async function GET() {
  const guard = await requireStaff();
  if (!guard.ok) return guard.response;
  const admin = getAdminClient();

  const { data: partners } = await admin
    .from('agency_partners')
    .select('*')
    .order('created_at', { ascending: false });

  // Комісії партнера + скільки замовлень і виручки пройшло за його кодом
  // (Diana, 2026-08-06). Рядок в agency_commissions зʼявляється лише після
  // підтвердженої оплати, тож це оплачені замовлення, а не створені кошики.
  //
  // Рахує Postgres. Раніше тут вибирався ВЕСЬ журнал і складався в циклі —
  // вибірка без ліміту, тобто тисяча рядків, які PostgREST віддає мовчки, і
  // список партнерів показував би занижені суми без жодної помилки. Скасовані
  // нарахування (payout_status='cancelled') функція не рахує ні в замовлення,
  // ні у виручку, ні в суму до виплати.
  const { data: statRows, error: statErr } = await admin.rpc('agency_commission_stats');
  if (statErr) console.error('[agency-partners] commission stats failed:', statErr.message);
  const statByAgency = new Map<string, any>((statRows || []).map((r: any) => [r.agency_id, r]));

  // Переходи за посиланням, теж порахованi в Postgres і тим самим індексом.
  // Дають те, чого зі списку не було видно: партнер без замовлень міг або не
  // ділитися посиланням узагалі, або ділитися, але без результату.
  const { data: visitRows, error: visitErr } = await admin.rpc('referral_visit_stats');
  if (visitErr) console.error('[agency-partners] visit stats failed:', visitErr.message);
  const visitsByCode = new Map<string, any>(
    (visitRows || []).map((r: any) => [String(r.referral_code || '').toUpperCase(), r]),
  );

  const enriched = (partners || []).map(p => {
    const stat = statByAgency.get(p.id);
    const visit = visitsByCode.get(String(p.referral_code || '').toUpperCase());
    return {
      ...p,
      pending_payout: Number(stat?.pending_sum || 0),
      orders_count: Number(stat?.orders_count || 0),
      orders_revenue: Math.round(Number(stat?.revenue || 0)),
      visits: Number(visit?.visits || 0),
      last_visit_at: visit?.last_visit_at || null,
    };
  });

  return NextResponse.json({ partners: enriched });
}

/**
 * POST — approve a partnership request into an agency partner (creates the
 * personal promo code + the agency_partners row). Body: { requestId } OR the
 * raw fields { agencyName, email, ... }.
 *
 * Створення партнера тут було ВЛАСНОЮ копією того, що робить
 * createAgencyPartner: цей роут старший за спільну функцію, і коли її винесли
 * для заявок менеджерів, сюди її не завели. Копія встигла розʼїхатися рівно
 * так, як це завжди буває. Вона не перевіряла, чи немає вже партнера з тією ж
 * поштою, — а новіший роут /api/admin/partner-requests перевіряє, — тож дві
 * заявки від одного бізнесу давали два коди, дві знижки й нарахування,
 * розбите між ними навпіл. Вона знала лише два види з чотирьох, тож заявка
 * фотографа з сайту ставала «тревел-агенцією». І в примітці промокоду вона
 * завжди писала «тревел-агенції», навіть коли партнер був блогером.
 * Тепер обидва шляхи ведуть в одну функцію.
 */
export async function POST(request: Request) {
  // Approval mints a client-facing discount promo code and a partner row —
  // не для будь-кого зі staff, але й не тільки для власників: підтверджувати
  // партнерів мають право ті самі люди, що й у /api/admin/partner-requests
  // (Діана, 15.09.2026). Без цього кнопка «Підтвердити та видати код» на
  // /admin/agency-partners і далі відповідала б 403 усім, крім адміністраторів,
  // хоча права на підтвердження вже видані.
  const guard = await requirePartnerApprover();
  if (!guard.ok) return guard.response;
  const admin = getAdminClient();

  const body = await request.json().catch(() => ({}));
  let { agencyName, contactName, email, phone, website, requestId } = body;
  const travelbookRate = Number(body?.travelbookRate ?? DEFAULT_PARTNER_TERMS.travelbookRate);
  const otherRate = Number(body?.otherRate ?? DEFAULT_PARTNER_TERMS.otherRate);
  const clientDiscount = Number(body?.clientDiscount ?? DEFAULT_PARTNER_TERMS.clientDiscount); // % discount the code gives the client
  let partnerKind: PartnerKind = PARTNER_KINDS.includes(body?.kind) ? body.kind : 'travel_agency';

  // If approving an existing request, pull its details.
  if (requestId) {
    const { data: req } = await admin
      .from('partnership_requests')
      .select('*')
      .eq('id', requestId)
      .maybeSingle();
    if (req) {
      // Підтверджувати вдруге нічого: перше підтвердження вже випустило код і
      // надіслало лист. Без цієї перевірки друге натискання (чи дві вкладки
      // адмінки) створювало другого партнера на ту саму заявку.
      if (req.status === 'approved') {
        return NextResponse.json({ error: 'Заявку вже підтверджено' }, { status: 409 });
      }
      agencyName = agencyName || req.agency_name;
      contactName = contactName || req.contact_name;
      email = email || req.email;
      phone = phone || req.phone;
      website = website || req.website;
      if (!body?.kind && PARTNER_KINDS.includes(req.kind)) partnerKind = req.kind;
    }
  }

  if (!agencyName || !email) {
    return NextResponse.json({ error: 'agencyName and email required' }, { status: 400 });
  }

  // Партнер із такою поштою вже може існувати: людина, з якою домовлялися в
  // директі, часто йде на сайт і подає заявку сама, а фотограф міг увімкнути
  // реферальний код у власному кабінеті. Другий код їй не потрібен — це були б
  // дві знижки й нарахування, розбите між двома рядками.
  const { data: clash } = await admin
    .from('agency_partners')
    .select('id, agency_name, referral_code')
    .ilike('email', likeEscape(String(email)))
    .maybeSingle();
  if (clash) {
    return NextResponse.json({
      error: `Партнер із поштою ${email} уже існує: ${clash.agency_name}, код ${clash.referral_code}`,
    }, { status: 409 });
  }

  let partner: any;
  try {
    partner = await createAgencyPartner(admin, {
      name: agencyName,
      email,
      contactName: contactName || null,
      phone: phone || null,
      website: website || null,
      partnerKind,
      clientDiscount,
      travelbookRate,
      otherRate,
      sourceRequestId: requestId || null,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Не вдалося створити партнера' }, { status: 500 });
  }

  const code = partner.referral_code;

  // Mark the source request approved.
  if (requestId) {
    await admin.from('partnership_requests').update({ status: 'approved' }).eq('id', requestId);
  }

  /**
   * Хто привів (Diana, 2026-08-06). Заявка з форми на сайті нічого не знає про
   * менеджерів, тому партнер тут завжди створювався з порожнім
   * sales_manager_id — навіть коли менеджер до того місяць вів цю саму студію
   * в директі, а вона просто дійшла до сайту сама. Шукаємо лід із тими самими
   * контактами (пошта або нікнейм, зокрема з поля «сайт», куди часто дають
   * посилання на Instagram) і записуємо його менеджера.
   *
   * Привʼязка зворотна: у списку партнерів менеджера видно і можна змінити.
   */
  let creditedManager: string | null = null;
  try {
    const attribution = await findLeadAttribution(admin, { email, website });
    if (attribution) {
      await attachManagerToPartner(admin, {
        partnerId: partner.id,
        managerId: attribution.managerId,
        email,
        leadId: attribution.leadId,
      });
      await logAttributionClaim(admin, {
        leadId: attribution.leadId,
        managerId: attribution.managerId,
        partnerId: partner.id,
        businessName: agencyName,
        email,
        comment: `Партнер зареєструвався самостійно, збіг із лідом за ${attribution.matchedBy === 'email' ? 'поштою' : 'Instagram'} від ${new Date(attribution.leadCreatedAt).toLocaleDateString('uk-UA')}`,
      });
      creditedManager = attribution.managerName;
    }
  } catch (e) {
    // Бухгалтерія не має валити оформлення партнера, який уже створений.
    console.error('[agency-partners] manager attribution failed:', e);
  }

  // Welcome email to the partner with their code + terms. Fire-and-forget:
  // a mail failure must never fail the approval (the partner row already
  // exists). The template lives in lib/agency/welcome-email so this route and
  // the manager-request approval can't drift apart on terms wording.
  await sendPartnerWelcomeEmail({
    email,
    name: agencyName,
    code,
    cabinetToken: partner.cabinet_token,
    partnerKind,
    clientDiscount,
    travelbookRate,
    otherRate,
  });

  return NextResponse.json({ partner, credited_manager: creditedManager });
}
