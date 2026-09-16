import type { SupabaseClient } from '@supabase/supabase-js';
import { accrueOrderCommission } from '@/lib/sales/commission';
import { likeEscape } from '@/lib/supabase/like-escape';
import { findBinding, isSelfReferral, normalizeBindingEmail } from '@/lib/agency/binding';

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
  // `product_slug` тут не про запас: потік «з дизайнером» пише саме його і
  // `slug` не ставить узагалі (63 позиції в базі). Сьогодні бакет для тих
  // позицій вгадується назвою — «Travel Book», «Глянцевий журнал» — і тому
  // працює, але тримати ставку на випадковому збігу назви означає та сама
  // пастка, що вже спіймала itemTotal: перейменують товар, і тревелбук тихо
  // поїде за ставкою «решти».
  const hay = `${String(item?.slug || '')} ${String(item?.product_slug || '')} ${String(item?.product_name || item?.name || '')}`.toLowerCase();
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
 *
 * ТРИ НАЗВИ ОДНІЄЇ ЦІНИ, і це не запас про всяк випадок.
 *
 * Позиції замовлення складають три різні місця, і вони домовилися не до кінця.
 * Чекаут пише `unit_price` і `total_price`. Бриф журналу теж. А потік «з
 * дизайнером» (app/[locale]/order/page.tsx) пише саме `price` — і жодної з двох
 * перших назв не ставить.
 *
 * Поки читалися тільки перші дві, для потоку дизайнера ця функція повертала
 * НУЛЬ: `total_price` немає, `unit_price` немає, отже `0 × 1`. Наслідок був би
 * тихий і саме там, де його найважче помітити — партнер отримував би
 * привʼязаного клієнта й нульову комісію, бо нарахування відсікається умовою
 * «сума більша за нуль» нижче. Менеджеру партнера теж не діставалося б нічого:
 * accrueOrderCommission рахує від цієї ж суми. Знайдено при підготовці
 * тестового переходу TM-001326 в оплачено (Діана, 16.09.2026) — до того, як
 * воно встигло коштувати комісії.
 *
 * Порядок саме такий: `total_price` — це вже сума по позиції, тож множити її на
 * кількість не можна; решта — ціни за одиницю.
 */
export function itemTotal(item: any): number {
  const t = Number(item?.total_price);
  if (Number.isFinite(t)) return t;
  const qty = Number(item?.quantity) || 1;
  const unit = Number(item?.unit_price);
  if (Number.isFinite(unit)) return unit * qty;
  const price = Number(item?.price);
  if (Number.isFinite(price)) return price * qty;
  return 0;
}

/**
 * Наскільки сума позицій може бути меншою за orders.subtotal і це ще нормально.
 *
 * Один відсоток. Число не з голови: на 815 оплачених замовленнях у базі сума
 * позицій не була меншою за subtotal ЖОДНОГО разу — 763 збіглися до копійки, а
 * 52, що розійшлися, усі дзеркалені з KeyCRM і всі в інший бік (позиції
 * БІЛЬШІ за subtotal на 3–8%, бо знижка в CRM стоїть на замовленні, а не на
 * позиціях). Тобто поріг сьогодні не відсіює нічого і спрацює лише тоді, коли
 * зʼявиться справді нова форма позиції — рівно тоді, коли він і потрібен.
 */
export const ITEMS_SUBTOTAL_TOLERANCE = 0.01;

export type ItemsSubtotalVerdict = 'ok' | 'legit_zero' | 'suspect';

/**
 * Чи можна вірити сумі, яку дали позиції замовлення.
 *
 * ЗАДАЧА, ЯКУ ЦЕ РОЗВʼЯЗУЄ. Комісія нуль буває з двох геть різних причин, і
 * поводитися з ними треба протилежно. Законний нуль — це партнер зі ставками
 * 0% або замовлення, за яке справді нічого не платили: клієнт при цьому
 * справжній, і привʼязати його треба, щоб наступні замовлення приносили
 * комісію. Нуль через ваду — це позиції, ціну яких читач не впізнав: там не
 * можна ні нараховувати, ні привʼязувати, бо привʼязка довічна, а нарахування
 * захищене UNIQUE(order_id) і другого шансу не буде.
 *
 * РОЗРІЗНЯЄ ЇХ НЕ ФОРМА ПОЗИЦІЇ, А ГРОШІ ЗАМОВЛЕННЯ. Перелічувати відомі назви
 * полів — це та сама латка, яка вже підвела: наступна назва знову буде
 * невідомою. Натомість поруч лежить незалежне число, `orders.subtotal`, яке
 * пише той самий потік, що й позиції, але окремо від них. Якщо замовлення
 * каже «шістсот сімдесят пʼять», а позиції дають нуль, то зламані позиції, і
 * це видно без жодного знання про їхню форму.
 */
export function classifyItemsSubtotal(
  itemsSubtotal: number,
  orderSubtotal: number,
): ItemsSubtotalVerdict {
  const items = Number.isFinite(itemsSubtotal) && itemsSubtotal > 0 ? itemsSubtotal : 0;
  const order = Number.isFinite(orderSubtotal) && orderSubtotal > 0 ? orderSubtotal : 0;

  // Порівнювати нема з чим: у замовленні немає власної суми. Тоді єдине, що
  // можна сказати, — чи дали щось самі позиції.
  if (order <= 0) return items > 0 ? 'ok' : 'legit_zero';

  // Замовлення з грошима, позиції без грошей. Форма позиції невідома.
  if (items <= 0) return 'suspect';

  // Частковий недобір: частину позицій прочитали, частину ні. Мовчазна
  // недоплата партнеру гірша за гучну відмову, бо відмову видно в журналі і
  // прогін можна повторити, а занижений рядок уже не переписати.
  if (items < order * (1 - ITEMS_SUBTOTAL_TOLERANCE)) return 'suspect';

  return 'ok';
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
 * Привʼязка і нарахування пишуться ОДНІЄЮ транзакцією в базі
 * (`record_agency_commission`), тож напівстану «клієнт закріплений, грошей
 * немає» не буває: або зʼявилося і те, і те, або не зʼявилося нічого.
 *
 * ЧОТИРИ ПРИЧИНИ НЕ НАРАХУВАТИ, і вони поводяться по-різному:
 *   — партнер не знайшовся або неактивний: ні комісії, ні привʼязки;
 *   — самореферал (пошта покупця збіглася з поштою партнера): те саме, свідомо;
 *   — сума позицій не сходиться з orders.subtotal: ні комісії, ні привʼязки,
 *     плюс гучний рядок у журналі помилок — форму позиції не впізнали;
 *   — комісія законно нульова (ставки 0% чи безкоштовне замовлення): привʼязка
 *     Є, рядка нарахування немає. Клієнт справжній, і наступне його замовлення
 *     має принести партнеру відсоток.
 *
 * Returns the commission amount granted, or 0 in every one of those cases.
 */
export async function processAgencyCommission(
  admin: SupabaseClient,
  opts: { orderId: string; promoCode: string | null; items: any[] },
): Promise<number> {
  const { orderId, promoCode, items } = opts;

  // Замовлення потрібне і для пошти покупця, і для записаної атрибуції.
  const { data: order } = await admin
    .from('orders')
    .select('customer_email, referral_partner_id, subtotal')
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

  const itemsSubtotal = travelbookSubtotal + otherSubtotal;

  /**
   * Позиції прочитані — але чи правильно? Перевірка стоїть САМЕ ТУТ, до
   * першого запису: нижче йдуть три незворотні дії поспіль — нарахування
   * менеджеру під UNIQUE(kind, source_id), привʼязка клієнта назавжди і
   * нарахування партнеру під UNIQUE(order_id). Кожна з них після запису вже не
   * переписується, тож єдиний момент, коли з хибною сумою ще можна нічого не
   * зробити, — цей.
   *
   * Відмова гучна і зворотна: у журналі лишається рядок із номером замовлення,
   * а коли читач навчиться новій формі позиції, той самий прогін («Позначити
   * оплаченим», звірка платежу, повтор вебхука) пройде вже нормально й
   * нарахує все, що належить. Мовчазна недоплата такого другого шансу не дає.
   */
  const orderSubtotal = Number((order as any)?.subtotal);
  const verdict = classifyItemsSubtotal(itemsSubtotal, orderSubtotal);
  if (verdict === 'suspect') {
    console.error(
      `[agency-commission] items subtotal looks broken, refusing to accrue OR bind: ` +
      `order ${orderId}, partner ${agency.id}, items=${itemsSubtotal}, order.subtotal=${orderSubtotal}`,
    );
    return 0;
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
      orderTotal: itemsSubtotal,
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

  const tbRate = Number(agency.travelbook_rate) || 0;
  const otherRate = Number(agency.other_rate) || 0;
  const travelbookCommission = Math.round(travelbookSubtotal * tbRate) / 100;
  const otherCommission = Math.round(otherSubtotal * otherRate) / 100;
  const totalCommission = travelbookCommission + otherCommission;

  /**
   * Привʼязка і нарахування — одна дія, і робить її база.
   *
   * ЧОМУ НЕ ДВА ВИКЛИКИ ПОСПІЛЬ, ЯК БУЛО. Раніше клієнт закріплювався за
   * партнером окремим запитом, а нарахування йшло наступним, і між ними ще
   * стояла умова «сума більша за нуль». Досить було сумі вийти нульовою через
   * незнайому форму позиції — і лишався напівстан, який нічим не лікується:
   * клієнт закріплений НАЗАВЖДИ, а грошей немає ні партнеру, ні його
   * менеджеру, ні рядком у журналі. Те саме давала будь-яка помилка другого
   * запиту чи смерть процесу між ними.
   *
   * Тепер обидві вставки лежать у тілі однієї функції, тобто в одній
   * транзакції: не лягло нарахування — не лишилося й привʼязки. Функція ж
   * рахує `kind` і перераховує зведення партнера, бо тільки вона знає, чи
   * привʼязку створив саме цей виклик.
   *
   * НУЛЬОВУ КОМІСІЮ ПЕРЕДАЄМО СВІДОМО. Сюди ми доходимо лише після
   * classifyItemsSubtotal, тобто нуль тут може бути тільки законним — ставки
   * партнера нульові або замовлення справді безкоштовне. Такий клієнт
   * справжній, тож привʼязка створюється, а рядка нарахування немає, і наступне
   * його замовлення вже принесе партнеру відсоток.
   */
  const { data: recorded, error: rpcErr } = await admin.rpc('record_agency_commission', {
    p_agency_id: agency.id,
    p_order_id: orderId,
    p_email: normalizeBindingEmail(buyerEmail),
    p_travelbook_subtotal: travelbookSubtotal,
    p_other_subtotal: otherSubtotal,
    p_travelbook_commission: travelbookCommission,
    p_other_commission: otherCommission,
    p_total_commission: totalCommission,
  });
  if (rpcErr) {
    console.error('[agency-commission] record failed (nothing written):', rpcErr.message);
    return 0;
  }

  const row = Array.isArray(recorded) ? recorded[0] : recorded;
  // Нічого не вставили: або комісія законно нульова, або UNIQUE(order_id)
  // спіймав паралельний повтор. В обох випадках грошей цим викликом не додано.
  if (!row?.commission_inserted) return 0;

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
