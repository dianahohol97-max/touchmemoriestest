import type { SupabaseClient } from '@supabase/supabase-js';
import { accrueOrderCommission } from '@/lib/sales/commission';
import { likeEscape } from '@/lib/supabase/like-escape';
import { bindClientToPartner, findBinding, isSelfReferral } from '@/lib/agency/binding';

/**
 * The PREMIUM commission bucket — earns travelbook_rate (default 5%); every
 * other item earns other_rate (default 3%).
 *
 * Diana's rule (2026-08-04): «5% на тревелбуки і журнали, решта 3%». The
 * bucket therefore holds travelbooks AND glossy magazines. The column keeps
 * its historical name travelbook_rate — renaming it would touch every payout
 * query for no behavioural gain; this matcher is the single place that
 * decides what the rate applies to.
 *
 * Matched by slug/name substrings, robust to size variants
 * (travelbook-20x30) and to the magazine slugs actually in the catalog
 * (personalized-glossy-magazine, фотожурнал…).
 */
function isPremiumRateItem(item: any): boolean {
  const hay = `${String(item?.slug || '')} ${String(item?.product_name || item?.name || '')}`.toLowerCase();
  return hay.includes('travelbook') || hay.includes('travel-book') || hay.includes('travel book')
    || hay.includes('magazine') || hay.includes('zhurnal') || hay.includes('журнал');
}

/**
 * Комісія рахується від суми ДО знижки клієнта (Діана, 16.09.2026).
 *
 * На тревелбуку за 1000 ₴ клієнт за партнерським кодом платить 950 ₴, а
 * партнер отримує 50 ₴, тобто пʼять відсотків від тисячі, а не від девʼятисот
 * пʼятдесяти. `total_price` позицій — це саме повна ціна: знижка ніколи не
 * розкладається по позиціях, вона живе в різниці між orders.subtotal і
 * orders.total. Правило досі ніде не було записане, і його легко було
 * прийняти за недогляд — тому воно тут.
 */
function itemTotal(item: any): number {
  const t = Number(item?.total_price);
  if (Number.isFinite(t)) return t;
  const unit = Number(item?.unit_price) || 0;
  const qty = Number(item?.quantity) || 1;
  return unit * qty;
}

/**
 * Перерахувати total_earned і total_paid_out партнера з журналу нарахувань.
 *
 * Раніше обидві колонки оновлювалися читанням і записом назад. Два вебхуки,
 * що прийшли одночасно за різними замовленнями одного партнера, читали те саме
 * значення і писали ту саму суму: одне нарахування зникало з кабінету назовсім,
 * бо джерелом правди була сама колонка, а не журнал. Функція в базі робить це
 * одним оператором UPDATE із підзапитом, тобто атомарно, і будь-який повторний
 * виклик дає той самий результат. Помилка тут ніколи не валить нарахування —
 * рядок у журналі вже є, а зведення перерахується з наступним викликом.
 */
async function syncPartnerTotals(admin: SupabaseClient, agencyId: string): Promise<void> {
  const { error } = await admin.rpc('recalc_agency_partner_totals', { p_agency_id: agencyId });
  if (error) console.error('[agency-commission] totals recalc failed:', error.message);
}

/**
 * Process an agency referral commission when an order transitions to paid.
 *
 * ЯК ЗНАХОДИТЬСЯ ПАРТНЕР (модель «лише посилання + довічна привʼязка», Діана,
 * 16.09.2026). Три джерела, у порядку спадання надійності:
 *
 *  1. `orders.referral_partner_id` — те, що чекаут визначив і записав при
 *     створенні замовлення. Головне джерело: воно переживає введення звичайного
 *     промокоду поверх партнерського посилання, бо лежить окремо від promo_code.
 *  2. Привʼязка за поштою покупця — клієнт, якого партнер привів колись.
 *     Саме вона робить комісію довічною: жодного переходу, localStorage чи
 *     реєстрації для цього не потрібно.
 *  3. `orders.promo_code` — старий шлях, лишений для замовлень, створених до
 *     цієї зміни, і для ручного оформлення в адмінці.
 *
 * Idempotent (a UNIQUE(order_id) on agency_commissions + an existence check
 * make webhook retries safe): splits the order items into travelbook vs other
 * subtotals, applies the agency's OWN per-partner rates (travelbook_rate /
 * other_rate — set at approval, defaulting to 5% travelbook / 3% other), writes
 * one agency_commissions row, and recomputes the agency's totals from the
 * ledger.
 *
 * ПОБІЧНА ДІЯ, заради якої модель і працює: на першому оплаченому замовленні з
 * партнерською атрибуцією пошта покупця закріплюється за партнером назавжди.
 * Рядок нарахування позначається `kind='new_client'`, усі наступні — 'repeat'.
 *
 * Returns the commission amount granted, or 0 if no partner applied — a
 * self-referral (buyer email == partner email) counts as "no commission" and
 * creates no binding either.
 */
export async function processAgencyCommission(
  admin: SupabaseClient,
  opts: { orderId: string; promoCode: string | null; items: any[] },
): Promise<number> {
  const { orderId, promoCode, items } = opts;

  // Замовлення потрібне і для пошти покупця, і для записаної атрибуції.
  const { data: order } = await admin
    .from('orders')
    .select('customer_email, referral_partner_id')
    .eq('id', orderId)
    .maybeSingle();
  const buyerEmail = String((order as any)?.customer_email || '').trim().toLowerCase();

  // ── 1. Атрибуція, записана при створенні замовлення ──────────────
  let agency: any = null;
  const attributedId = (order as any)?.referral_partner_id || null;
  if (attributedId) {
    const { data } = await admin
      .from('agency_partners')
      .select('id, email, travelbook_rate, other_rate, status')
      .eq('id', attributedId)
      .maybeSingle();
    agency = data;
  }

  // ── 2. Довічна привʼязка за поштою ───────────────────────────────
  // Клієнт, якого цей партнер привів колись. Саме ця гілка нараховує комісію
  // на повторних замовленнях, де немає ні переходу, ні знижки, ні промокоду.
  if (!agency && buyerEmail) {
    const binding = await findBinding(admin, buyerEmail);
    if (binding) {
      const { data } = await admin
        .from('agency_partners')
        .select('id, email, travelbook_rate, other_rate, status')
        .eq('id', binding.partner_id)
        .maybeSingle();
      agency = data;
    }
  }

  // ── 3. Старий шлях за промокодом ─────────────────────────────────
  // Замовлення, створені до переходу на нову модель, несуть партнера тільки
  // тут; ручне оформлення в адмінці тежіде цим шляхом.
  const code = String(promoCode || '').trim().toUpperCase();
  if (!agency && code) {
    const { data } = await admin
      .from('agency_partners')
      .select('id, email, travelbook_rate, other_rate, status')
      .ilike('referral_code', likeEscape(code))
      .maybeSingle();
    agency = data;
  }

  if (!agency || agency.status !== 'active') return 0;

  /**
   * Самореферал: знижка так, комісія ні (Діана, 16.09.2026).
   *
   * Партнер, який замовляє за власним посиланням, лишається клієнтом і свої
   * мінус пʼять відсотків отримує — це нормальна умова партнерства. А от
   * платити йому ще й комісію означало б віддавати відсоток за покупку, яку він
   * зробив сам собі. У новій моделі ціна помилки вища за стару: без цієї
   * перевірки партнер привʼязав би сам себе і отримував би відсоток із КОЖНОЇ
   * власної покупки до кінця часів, а не один раз.
   *
   * Перевірка стоїть тут, а не в місцях виклику, бо їх пʼять — вебхук
   * Монобанку, «Позначити оплаченим», звірка платежу, редактор замовлення і
   * ручне створення, — і забути її в одному з них було б надто легко. Менеджер
   * партнера за таке замовлення теж нічого не отримує, тому перевірка йде до
   * нарахування менеджеру.
   */
  if (isSelfReferral(buyerEmail, agency.email)) {
    console.warn(`[agency-commission] self-referral skipped: order ${orderId}, partner ${agency.id}`);
    return 0;
  }

  // Split items into travelbook vs other subtotals.
  let travelbookSubtotal = 0;
  let otherSubtotal = 0;
  for (const item of Array.isArray(items) ? items : []) {
    const total = itemTotal(item);
    if (isPremiumRateItem(item)) travelbookSubtotal += total;
    else otherSubtotal += total;
  }

  // The sales manager who brought this partner earns their percentage of the
  // same order. Deliberately BEFORE the agency idempotency check and in its
  // own try: it has its own UNIQUE guard, so a re-run can still create a
  // missing manager accrual (attribution is sometimes set after the fact), and
  // a failure here must never stop the agency from being credited.
  try {
    await accrueOrderCommission(admin, {
      orderId,
      promoCode: code,
      // Партнер уже знайдений — передаємо його явно. На повторному замовленні
      // коду немає взагалі, і пошук за кодом лишив би менеджера без відсотка
      // саме на тих замовленнях, які приносить довічна привʼязка.
      partnerId: agency.id,
      orderTotal: travelbookSubtotal + otherSubtotal,
    });
  } catch (e) {
    console.error('[sales-commission] order accrual failed (agency commission unaffected):', e);
  }

  // Already recorded for this order? (idempotency)
  const { data: existing } = await admin
    .from('agency_commissions')
    .select('id')
    .eq('order_id', orderId)
    .maybeSingle();
  if (existing) return 0;

  /**
   * Закріпити клієнта за партнером. САМЕ ТУТ, на оплаті, а не на створенні
   * замовлення: привʼязка довічна, і купувати її за невиконане замовлення, яке
   * так і лишиться неоплаченим, не можна.
   *
   * Повертає true лише тоді, коли привʼязку створив цей виклик — звідси й
   * береться `kind`. Пошта вже за кимось закріплена означає, що це повторне
   * замовлення привʼязаного клієнта, навіть якщо він щойно перейшов за чужим
   * посиланням: перша привʼязка не перезаписується.
   */
  const boundNow = await bindClientToPartner(admin, {
    email: buyerEmail,
    partnerId: agency.id,
    orderId,
  });

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
    // «Новий клієнт» — це замовлення, яке щойно створило привʼязку. Усе інше
    // приходить від клієнта, якого партнер привів раніше, і в кабінеті стоїть
    // окремим рядком: привести людину і отримати від неї повторне замовлення —
    // різна робота.
    kind: boundNow ? 'new_client' : 'repeat',
  });
  if (insErr) return 0; // likely the UNIQUE(order_id) race guard — already credited

  await syncPartnerTotals(admin, agency.id);

  return totalCommission;
}

/**
 * Зняти нарахування за скасованим замовленням.
 *
 * Досі цього не робив ніхто: при скасуванні поверталися бонуси клієнта, а
 * рядок в agency_commissions лишався і далі йшов у виплату. Замовлення, якого
 * більше немає, платило партнеру комісію.
 *
 * Знімається ЛИШЕ невиплачене (Діана, 16.09.2026). Якщо гроші партнеру вже
 * пішли, рядок лишається зі статусом 'paid' недоторканим: повертати виплачене
 * назад — це розмова з людиною, а не дія скрипта. Рядок не видаляється, а
 * переходить у 'cancelled', тож у журналі кабінету видно і саме нарахування, і
 * те, що воно зняте, а UNIQUE(order_id) далі захищає від повторного
 * зарахування того самого замовлення.
 *
 * Ідемпотентна: умова payout_status='pending' стоїть у самому UPDATE, тож
 * повторне скасування чи повтор запиту не знімає нічого вдруге. Повертає суму,
 * яку зняли, або 0.
 */
export async function reverseAgencyCommission(
  admin: SupabaseClient,
  opts: { orderId: string },
): Promise<number> {
  const { data: reversed } = await admin
    .from('agency_commissions')
    .update({ payout_status: 'cancelled' })
    .eq('order_id', opts.orderId)
    .eq('payout_status', 'pending')
    .select('agency_id, total_commission');

  const row = reversed?.[0];
  if (!row) return 0;

  await syncPartnerTotals(admin, row.agency_id);
  return Number(row.total_commission) || 0;
}
