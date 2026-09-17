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

/**
 * Перерахувати total_earned і total_paid менеджера з журналу нарахувань.
 *
 * Раніше обидві суми правилися читанням і записом назад — total_earned тут, при
 * нарахуванні, а total_paid в адмінці, при зміні статусу рядка. Два вебхуки за
 * різними замовленнями одного менеджера, що прийшли одночасно, читали те саме
 * значення і писали ту саму суму: одне нарахування зникало з кабінету назовсім,
 * і зійтися назад воно не могло, бо джерелом правди була сама колонка.
 *
 * Функція в базі робить це одним оператором UPDATE із підзапитами, тобто
 * атомарно, і повторний виклик дає той самий результат. Помилка тут ніколи не
 * валить нарахування — рядок у журналі вже є, а зведення перерахується з
 * наступним викликом. Точна пара до syncPartnerTotals у lib/agency/commission.
 */
export async function syncManagerTotals(admin: SupabaseClient, managerId: string): Promise<void> {
  const { error } = await admin.rpc('recalc_sales_manager_totals', { p_manager_id: managerId });
  if (error) console.error('[sales-commission] totals recalc failed:', error.message);
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
  // Зведення для шапки кабінету — похідне від рядків, а не окрема правда.
  await syncManagerTotals(admin, row.manager_id);
  return row.amount;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * An order was paid with a partner's referral code. Credits the manager who
 * brought that partner, if there is one.
 */
export async function accrueOrderCommission(
  admin: SupabaseClient,
  opts: { orderId: string; promoCode: string | null; orderTotal: number; partnerId?: string | null },
): Promise<AccrueResult> {
  const code = String(opts.promoCode || '').trim().toUpperCase();
  if (!opts.orderTotal) return { amount: 0 };

  /**
   * Партнера шукаємо за id, коли він переданий, і лише інакше — за кодом.
   *
   * У моделі з довічною привʼязкою (Діана, 16.09.2026) повторне замовлення
   * привʼязаного клієнта не несе ні коду, ні знижки: партнера визначає пошта.
   * Пошук виключно за кодом лишав би менеджера без відсотка саме на тих
   * замовленнях, заради яких привʼязку й зробили, і зникала б ця комісія тихо —
   * просто нічого не нараховувалося б.
   */
  let partner: any = null;
  if (opts.partnerId) {
    const { data } = await admin
      .from('agency_partners')
      .select('id, sales_manager_id, status, agency_name')
      .eq('id', opts.partnerId)
      .maybeSingle();
    partner = data;
  } else if (code) {
    const { data } = await admin
      .from('agency_partners')
      .select('id, sales_manager_id, status, agency_name')
      .ilike('referral_code', likeEscape(code))
      .maybeSingle();
    partner = data;
  }
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
    // Повторне замовлення привʼязаного клієнта коду не має — і рядок у журналі
    // менеджера має це казати, а не вигадувати код, якого не було.
    note: code
      ? `Замовлення за кодом ${code} (${partner.agency_name || 'партнер'})`
      : `Замовлення привʼязаного клієнта (${partner.agency_name || 'партнер'})`,
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

/**
 * Зняти менеджерське нарахування за скасованим замовленням.
 *
 * ЧОМУ ЦЕ ЗʼЯВИЛОСЯ ОКРЕМО ВІД ПАРТНЕРСЬКОГО. 16.09.2026 скасування навчили
 * знімати комісію ПАРТНЕРА (reverseAgencyCommission), і на тому зупинилися.
 * Менеджерське нарахування за тим самим замовленням лишалося в журналі зі
 * статусом 'pending' і далі йшло у виплату — тобто замовлення, якого більше
 * немає, платило менеджеру рівно так само, як до того платило партнеру.
 * Половина лікування виглядала як ціле саме тому, що обидва нарахування
 * робляться одним викликом processAgencyCommission, а знімалося лише одне.
 *
 * ЩО САМЕ ЗНІМАЄТЬСЯ. Тільки рядок за ЗАМОВЛЕННЯМ (`kind='order'`). Нарахування
 * за оплачений тариф памʼяті фотографа має свій `source_id` і до скасування
 * замовлення стосунку не має; фільтр по виду стоїть у запиті, щоб випадковий
 * збіг ідентифікаторів не зняв чужі гроші.
 *
 * ЛИШЕ НЕВИПЛАЧЕНЕ, як і в партнера. Якщо гроші менеджеру вже пішли, рядок
 * лишається зі статусом 'paid' недоторканим: повертати виплачене назад — це
 * розмова з людиною, а не дія скрипта. Рядок не видаляється, а переходить у
 * 'cancelled', тож у кабінеті видно і саме нарахування, і те, що воно зняте.
 *
 * Ідемпотентна: умова status='pending' стоїть у самому UPDATE, тож повторне
 * скасування чи повтор запиту не знімає нічого вдруге. Повертає суму, яку
 * зняли, або 0.
 */
export async function reverseSalesCommission(
  admin: SupabaseClient,
  opts: { orderId: string },
): Promise<number> {
  const { data: reversed } = await admin
    .from('sales_commissions')
    .update({ status: 'cancelled' })
    // source_id у цій таблиці текстовий, а не uuid — приводимо явно, щоб
    // порівняння не залежало від того, що надішле клієнт Supabase.
    .eq('source_id', String(opts.orderId))
    .eq('kind', 'order')
    .eq('status', 'pending')
    .select('manager_id, amount');

  const row = reversed?.[0];
  if (!row) return 0;

  await syncManagerTotals(admin, row.manager_id);
  return Number(row.amount) || 0;
}
