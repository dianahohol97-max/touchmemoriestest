import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { computePaymentAmounts, getAvailablePaymentOptions, type CartItemPayment } from '@/lib/payment/options';
import { resolvePriceMultiplier, resolveDisplayCurrency, normalizeShipRegion, shipRegionToPaymentRegion, computeIntlShippingUah } from '@/lib/payment/pricing-region';
import { getEurRate, getIntlShippingConfig } from '@/lib/i18n/exchangeRate';
import { getB2bSession } from '@/lib/b2b/session';
import { getRoleConfig } from '@/lib/b2b/config';
import { checkCertificateForPayment } from '@/lib/certificates/redeemCertificate';
import type { Currency } from '@/lib/i18n/currency';

export const dynamic = 'force-dynamic';

/**
 * Server-side order submission.
 *
 * Customers never write into `orders` directly. The server validates the
 * payload (so a malicious client can't set payment_status='paid' or skip
 * Monobank), generates the order_number, and inserts via the service role.
 *
 * Payment type validation: the server re-checks whether the cart is
 * actually eligible for split payment (queries products.payment_mode by
 * slug). A client can't unlock split by lying — if any item is full_only,
 * the order is forced to payment_type='full' regardless of payload.
 */

interface OrderItem {
  product_type: string;
  product_name: string;
  format?: string;
  cover_type?: string;
  pages?: number;
  quantity: number;
  unit_price: number;
  total_price: number;
  options?: Record<string, unknown>;
  slug?: string; // needed for payment_mode lookup
  metadata?: Record<string, unknown>; // structured per-item data (e.g. gift cert)
}

interface OrderPayload {
  customer_name?: string;
  customer_phone?: string;
  customer_email?: string;
  customer_telegram?: string;
  items: OrderItem[];
  subtotal: number;
  delivery_cost: number;
  total: number;
  delivery_method: string;
  delivery_address?: unknown;
  notes?: string;
  with_designer?: boolean;
  designer_service_fee?: number;
  payment_type?: 'full' | 'split';
  // Pricing context resolved at checkout (server re-derives the multiplier).
  // subtotal/total in the payload are BASE UAH (pre-markup); the server applies
  // the +20% intl markup itself so the client can't undercharge.
  ship_region?: string;   // 'UA' | 'INTL'
  locale?: string;        // interface language (uk vs non-uk)
  display_currency?: string; // what the customer saw (UAH/EUR/...)
}

function isValidPhone(s: unknown): s is string {
  if (typeof s !== 'string') return false;
  const cleaned = s.trim().replace(/[\s\-\(\)\+\.]/g, '');
  // After stripping formatting chars, must have 7–15 digits
  return /^[0-9]{7,15}$/.test(cleaned);
}
function isValidEmail(s: unknown): s is string {
  return typeof s === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());
}

export async function POST(request: NextRequest) {
  let body: OrderPayload;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  // Validate. Reject anything that doesn't look like a real checkout payload.
  if (!body.customer_name || typeof body.customer_name !== 'string' || body.customer_name.length < 1 || body.customer_name.length > 200) {
    return NextResponse.json({ error: 'customer_name required' }, { status: 400 });
  }
  if (!isValidPhone(body.customer_phone)) {
    return NextResponse.json({ error: 'customer_phone invalid' }, { status: 400 });
  }
  if (body.customer_email && !isValidEmail(body.customer_email)) {
    return NextResponse.json({ error: 'customer_email invalid' }, { status: 400 });
  }
  if (!Array.isArray(body.items) || body.items.length === 0 || body.items.length > 50) {
    return NextResponse.json({ error: 'items must be a non-empty array (max 50)' }, { status: 400 });
  }

  // Normalise книга побажань items before they're persisted into the order.
  // The page count is a fixed 32, but older cart items (saved before that was
  // enforced) may carry a wrong value like "20 сторінок" and these flow
  // straight into the order. Force the correct count at submit time so the
  // admin order always shows 32 regardless of what the cart sent.
  for (const it of body.items as any[]) {
    const slug = String(it?.slug || '');
    const isWishbook = /wish|guest|pobazhan/i.test(slug) || /побажан/i.test(String(it?.product_name || it?.name || ''));
    if (isWishbook && it?.options && typeof it.options === 'object') {
      // Force the fixed 32-page count. Important: only touch the page-COUNT
      // line, not "Колір сторінок" (which also contains the word "сторінок").
      // The previous broad regex overwrote the page colour with "32 сторінки",
      // which is why the colour never reached the admin order.
      const isPageCountKey = (k: string) =>
        /сторінок|сторінки|page/i.test(k) && !/колір|color/i.test(k);
      for (const key of Object.keys(it.options)) {
        if (isPageCountKey(key)) {
          it.options[key] = '32 сторінки';
        }
      }
      // If the page-count line is missing entirely, add it.
      const hasPageLine = Object.keys(it.options).some(isPageCountKey);
      if (!hasPageLine) it.options['Сторінок'] = '32 сторінки';
    }

    // Strip decoration sub-variants that don't match the chosen decoration.
    // The configurator carries default values for "Варіант акрилу" and
    // "Варіант фотовставки" even when "Оздоблення" is "Без оздоблення" (or a
    // different type), which produced the contradictory
    // "Без оздоблення + Варіант акрилу + Варіант фотовставки" on orders like
    // TM-001065. Drop the acrylic-size line unless the decoration is acrylic,
    // and the photo-insert-size line unless it's a photo insert.
    for (const bag of [it?.options, it?.selected_options]) {
      if (!bag || typeof bag !== 'object') continue;
      const decoKey = Object.keys(bag).find(k => /оздоблен/i.test(k));
      const deco = decoKey ? String(bag[decoKey]) : '';
      const isAcrylic = /акрил/i.test(deco);
      const isPhotoInsert = /фото|вставк/i.test(deco);
      for (const key of Object.keys(bag)) {
        if (/варіант\s*акрил/i.test(key) && !isAcrylic) delete bag[key];
        if (/варіант\s*фото/i.test(key) && !isPhotoInsert) delete bag[key];
      }
    }
  }
  const subtotal = Number(body.subtotal);
  const delivery_cost = Number(body.delivery_cost);
  const total = Number(body.total);
  if (!Number.isFinite(subtotal) || subtotal < 0 || subtotal > 10_000_000) {
    return NextResponse.json({ error: 'subtotal out of range' }, { status: 400 });
  }
  if (!Number.isFinite(delivery_cost) || delivery_cost < 0 || delivery_cost > 100_000) {
    return NextResponse.json({ error: 'delivery_cost out of range' }, { status: 400 });
  }
  if (!Number.isFinite(total) || total < 1 || total > 10_000_000) {
    return NextResponse.json({ error: 'total out of range' }, { status: 400 });
  }
  if (!body.delivery_method || typeof body.delivery_method !== 'string') {
    return NextResponse.json({ error: 'delivery_method required' }, { status: 400 });
  }

  // If the caller is authenticated, attach customer_id.
  let customer_id: string | null = null;
  let customerBonusBalance = 0;
  try {
    const userClient = await createClient();
    const { data: { user } } = await userClient.auth.getUser();
    if (user) {
      const admin0 = getAdminClient();
      const { data: customer } = await admin0
        .from('customers')
        .select('id, bonus_balance')
        .or(`auth_user_id.eq.${user.id},id.eq.${user.id}`)
        .maybeSingle();
      customer_id = customer?.id || null;
      customerBonusBalance = Number(customer?.bonus_balance || 0);

      // Belt-and-braces: a DB trigger now creates a customers profile on
      // signup, but if this auth user somehow has none (older account, trigger
      // disabled, direct auth admin creation), create it here so the order is
      // never orphaned. Orphaned orders were invisible in the customer's
      // cabinet and broke bonuses/referrals (TM-001031/1032/1034 all hit this).
      if (!customer_id && user.email) {
        const { data: created } = await admin0
          .from('customers')
          .insert({ id: user.id, auth_user_id: user.id, email: user.email })
          .select('id, bonus_balance')
          .maybeSingle();
        if (created) {
          customer_id = created.id;
          customerBonusBalance = Number(created.bonus_balance || 0);
        }
      }
    }
  } catch (e) {
    console.warn('orders/submit: customer lookup failed, falling back to guest', e);
  }

  // Validate the requested bonus redemption server-side: only logged-in
  // customers, never more than their balance, never more than 50% of the total.
  const requestedBonus = Number((body as any).bonus_redeemed) || 0;
  let bonusToRedeem = 0;
  if (customer_id && requestedBonus > 0) {
    const maxByRate = Math.floor(total * 0.5);
    bonusToRedeem = Math.max(0, Math.min(requestedBonus, customerBonusBalance, maxByRate));
  }

  // ──────────────────────────────────────────────────────────────
  // Server-side price floor check.
  //   Fetch base price for each product slug and verify the client's
  //   subtotal is >= sum of (product.price × quantity). This prevents
  //   a tampered client from submitting subtotal=0 or subtotal=1
  //   on products that cost hundreds of UAH.
  //   We do NOT recompute the full option-driven price server-side
  //   (that logic lives in ProductOptionsSelector and is complex) —
  //   instead we reject orders where subtotal < 80% of the sum of
  //   base prices. The 20% buffer allows for legitimate discounts
  //   (promo codes, split-payment rounding). Options can only add to
  //   the base price, never subtract below it, so this is a safe floor.
  // ──────────────────────────────────────────────────────────────
  {
    const slugs = Array.from(new Set(body.items.map(i => i.slug).filter(Boolean))) as string[];
    if (slugs.length > 0) {
      const priceAdmin = getAdminClient();
      const { data: productPrices } = await priceAdmin
        .from('products')
        .select('slug, price, categories(slug)')
        .in('slug', slugs);
      if (productPrices && productPrices.length > 0) {
        // Resolve the buyer's B2B session once. If they are a verified partner,
        // lower the floor for their discounted categories so a legitimate 10%
        // partner discount is never rejected.
        const b2b = await getB2bSession();
        const b2bCfg = getRoleConfig(b2b.role);
        const b2bCats = (b2b.isB2b && b2bCfg) ? new Set(b2bCfg.categorySlugs) : new Set<string>();
        const b2bPct = (b2b.isB2b && b2bCfg) ? b2bCfg.discountPercent : 0;

        const priceBySlug = new Map<string, number>();
        const catBySlug = new Map<string, string>();
        productPrices.forEach((p: any) => {
          priceBySlug.set(p.slug, Number(p.price) || 0);
          const cat = Array.isArray(p.categories) ? p.categories[0]?.slug : (p.categories as any)?.slug;
          if (cat) catBySlug.set(p.slug, cat);
        });

        const baseFloor = body.items.reduce((sum, item) => {
          const base = priceBySlug.get(item.slug || '') || 0;
          const qty = Number(item.quantity) || 1;
          const cat = catBySlug.get(item.slug || '');
          // Standard floor allows the 20% promo buffer; for verified B2B
          // categories also subtract their discount so the floor matches what
          // the partner legitimately pays.
          const b2bFactor = (cat && b2bCats.has(cat)) ? (1 - b2bPct / 100) : 1;
          return sum + base * qty * b2bFactor;
        }, 0);
        // Allow up to 20% below the (B2B-adjusted) base, but never less than 1₴
        const floor = Math.max(1, Math.round(baseFloor * 0.80));
        if (subtotal < floor) {
          console.warn(`orders/submit: subtotal ${subtotal} < floor ${floor} (base ${baseFloor}) for slugs [${slugs.join(', ')}]`);
          return NextResponse.json(
            { error: 'subtotal_too_low', detail: `Subtotal ${subtotal} is below the minimum expected price for these products.` },
            { status: 422 }
          );
        }
      }
    }
  }

  // ── Stock availability guard ──────────────────────────────────
  // For products with inventory tracking on, never let an order exceed what's
  // actually available. The storefront disables the button, but the API must
  // enforce it too. Made-to-order products (track_inventory off) are skipped.
  {
    const slugs = Array.from(new Set(body.items.map(i => i.slug).filter(Boolean))) as string[];
    if (slugs.length > 0) {
      const stockAdmin = getAdminClient();
      const { data: stockRows } = await stockAdmin
        .from('products')
        .select('slug, track_inventory, product_type, stock_available')
        .in('slug', slugs);
      const availBySlug = new Map<string, number>();
      for (const p of (stockRows || []) as any[]) {
        if (p.track_inventory && p.product_type === 'physical') {
          availBySlug.set(p.slug, Number(p.stock_available) || 0);
        }
      }
      if (availBySlug.size > 0) {
        const wantBySlug = new Map<string, number>();
        for (const it of body.items) {
          if (it.slug && availBySlug.has(it.slug)) {
            wantBySlug.set(it.slug, (wantBySlug.get(it.slug) || 0) + (Number(it.quantity) || 1));
          }
        }
        for (const [slug, want] of wantBySlug) {
          const have = availBySlug.get(slug) ?? 0;
          if (want > have) {
            return NextResponse.json(
              { error: 'out_of_stock', detail: `Товару недостатньо в наявності (доступно ${have}, у замовленні ${want}).`, slug },
              { status: 409 },
            );
          }
        }
      }
    }
  }


  //   - Look up payment_mode for every item slug
  //   - Re-compute allowSplit; if client requested 'split' but it's not allowed → force 'full'
  // ──────────────────────────────────────────────────────────────
  const admin = getAdminClient();

  let payment_type: 'full' | 'split' = body.payment_type === 'split' ? 'split' : 'full';
  const modeBySlug = new Map<string, string>();
  const costBySlug = new Map<string, number>();
  {
    const slugs = Array.from(new Set(body.items.map(i => i.slug).filter(Boolean))) as string[];
    if (slugs.length > 0) {
      const { data: prodRows } = await admin
        .from('products')
        .select('slug, payment_mode, cost_price')
        .in('slug', slugs);
      (prodRows || []).forEach(r => {
        modeBySlug.set(r.slug, r.payment_mode);
        // Snapshot the product's cost price onto the order so the admin
        // profit/cost column isn't 0. Stored per-item at order time so later
        // cost changes don't rewrite historical orders.
        costBySlug.set(r.slug, Number((r as any).cost_price) || 0);
      });
    }
  }
  // Attach the cost snapshot to each item (only if the cart didn't already
  // carry one). cost_price is per single unit, matching the admin's
  // cost_price × qty calculation.
  for (const it of body.items as any[]) {
    if (it && (it.cost_price === undefined || it.cost_price === null || Number(it.cost_price) === 0)) {
      const c = costBySlug.get(it.slug || '');
      if (c && c > 0) it.cost_price = c;
    }
  }
  if (payment_type === 'split') {
    const slugs = Array.from(new Set(body.items.map(i => i.slug).filter(Boolean))) as string[];
    if (slugs.length > 0) {
      const cartForCheck: CartItemPayment[] = body.items.map(i => ({
        slug: i.slug,
        payment_mode: (modeBySlug.get(i.slug || '') as any) || 'full_only',
      }));
      const opts = getAvailablePaymentOptions(cartForCheck);
      if (!opts.allowSplit) {
        // Client requested split but cart isn't eligible — silently downgrade.
        payment_type = 'full';
      }
    } else {
      payment_type = 'full';
    }
  }

  // ──────────────────────────────────────────────────────────────
  // Pricing context (single source: lib/payment/pricing-region).
  //   - subtotal/total in the payload are BASE UAH (pre-markup).
  //   - Server applies the intl markup itself (locale × shipRegion) so a
  //     tampered client can't skip it, computes intl shipping, and freezes
  //     the context on the order so "shown == charged" is auditable.
  // ──────────────────────────────────────────────────────────────
  const shipRegion = normalizeShipRegion(body.ship_region);
  const locale = typeof body.locale === 'string' ? body.locale : 'uk';

  // International orders are full prepayment only — no 50/50 split (there is no
  // internal Nova Poshta COD leg abroad to collect the remainder on).
  if (shipRegion === 'INTL') {
    payment_type = 'full';
  }

  const priceMultiplier = resolvePriceMultiplier(locale, shipRegion);
  const displayCurrency = resolveDisplayCurrency(locale, body.display_currency as Currency | undefined);
  const paymentRegion = shipRegionToPaymentRegion(shipRegion);

  // Need the EUR rate for INTL (free-shipping threshold is in EUR) and/or when
  // the order is displayed in EUR. Fetch once.
  const needsRate = shipRegion === 'INTL' || displayCurrency !== 'UAH';
  const eurRate = needsRate ? await getEurRate() : null;
  const exchangeRate = displayCurrency === 'UAH' ? null : eurRate;

  // Discount the client already applied lives in (base subtotal − base total).
  // Markup hits the canonical price (subtotal); the flat UAH discount is
  // subtracted after; intl shipping is added on top.
  const baseDiscount = Math.max(0, Math.min(subtotal, subtotal - total));
  const markedSubtotal = Math.round(subtotal * priceMultiplier);

  let intlShipping = 0;
  if (shipRegion === 'INTL') {
    const shipCfg = await getIntlShippingConfig();
    intlShipping = computeIntlShippingUah(markedSubtotal, eurRate ?? 0, shipCfg);
  }
  const finalDeliveryCost = shipRegion === 'INTL' ? intlShipping : delivery_cost;
  const orderTotalBeforeCredits = Math.max(1, Math.round(markedSubtotal - baseDiscount + finalDeliveryCost));

  // Certificate payment (applied first, before bonuses). Validate the code
  // server-side; the certificate covers up to the order total, any leftover is
  // credited to the buyer's bonus balance AFTER payment (handled in the webhook).
  let certApplied = 0;
  let certId: string | null = null;
  let certCode: string | null = null;
  const requestedCertCode = typeof (body as any).certificate_code === 'string'
    ? (body as any).certificate_code.trim().toUpperCase() : null;
  if (requestedCertCode) {
    const check = await checkCertificateForPayment(admin, requestedCertCode);
    if (check.valid && check.id) {
      certApplied = Math.min(check.amount || 0, orderTotalBeforeCredits);
      certId = check.id;
      certCode = requestedCertCode;
    }
    // If invalid, we silently ignore it here (client already validated and
    // shows errors); the order proceeds without certificate coverage.
  }

  const markedTotalBeforeBonus = Math.max(0, orderTotalBeforeCredits - certApplied);

  // Re-clamp the bonus against the authoritative server total (≤50%, ≤balance).
  // bonusToRedeem was already bounded by the client-reported total above; this
  // re-bounds it to the real marked total so it's always correct.
  const bonusApplied = Math.max(0, Math.min(bonusToRedeem, customerBonusBalance, Math.floor(markedTotalBeforeBonus * 0.5)));
  const markedTotal = Math.max(1, markedTotalBeforeBonus - bonusApplied);

  // For a split order, full_only items must be charged 100% up front; only the
  // splittable items (+ delivery − discount) are split 50/50. Sum the marked
  // value of every non-splittable item and hand it to computePaymentAmounts.
  let markedFullOnlyPortion = 0;
  if (payment_type === 'split') {
    for (const i of body.items) {
      const mode = modeBySlug.get(i.slug || '') || 'full_only';
      if (mode !== 'full_or_split') {
        markedFullOnlyPortion += Math.round(Number(i.total_price || 0) * priceMultiplier);
      }
    }
    markedFullOnlyPortion = Math.max(0, Math.min(markedFullOnlyPortion, markedTotal));
  }

  const amounts = computePaymentAmounts(markedTotal, payment_type, body.delivery_method, markedFullOnlyPortion);

  const { data: inserted, error } = await admin
    .from('orders')
    .insert({
      // order_number is assigned by the DB sequence default (TM-NNNNNN) and read
      // back below via .select — keeps numbering sequential across all flows.
      customer_id,
      customer_name: body.customer_name.trim(),
      customer_phone: body.customer_phone.trim(),
      customer_email: body.customer_email?.trim() || null,
      customer_telegram: body.customer_telegram?.toString().trim().slice(0, 200) || null,
      items: body.items as any,
      subtotal: markedSubtotal,
      delivery_cost: finalDeliveryCost,
      total: markedTotal,
      certificate_code: certCode,
      certificate_applied: certApplied,
      certificate_redeemed: false,
      ship_region: shipRegion,
      payment_region: paymentRegion,
      price_multiplier: priceMultiplier,
      display_currency: displayCurrency,
      exchange_rate: exchangeRate,
      delivery_method: body.delivery_method,
      delivery_address: body.delivery_address || null,
      notes: body.notes?.toString().slice(0, 5000) || null,
      with_designer: !!body.with_designer || (body.items as any[]).some(it =>
        it?.metadata?.designer_flow || it?.options?.['Оформлення'] === 'Макет робить дизайнер'
      ),
      designer_service_fee: body.with_designer ? (Number(body.designer_service_fee) || 0) : 0,
      order_status: 'new',
      payment_status: 'pending',
      // The applied promo code string — the paid-transition hooks (Monobank
      // webhook, admin check-payment) look up agency partners by this code
      // to accrue their commission. Without it commissions never accrued.
      promo_code: String((body as any).promo_code || '').trim().toUpperCase().slice(0, 64) || null,
      payment_type,
      prepaid_amount: amounts.prepaid_amount,
      cod_amount: amounts.cod_amount,
      pickup_unpaid_balance: amounts.pickup_unpaid_balance,
    })
    .select('id, order_number, payment_type, prepaid_amount, cod_amount, pickup_unpaid_balance')
    .single();

  if (error || !inserted) {
    console.error('orders/submit insert error:', error);
    return NextResponse.json(
      { error: 'Failed to create order', detail: error?.message || null, code: (error as any)?.code || null },
      { status: 500 },
    );
  }

  // Audit trail
  await admin.from('order_history').insert({
    order_id: inserted.id,
    action: 'order_created',
    notes: payment_type === 'split'
      ? `Замовлення створено через checkout (50% передоплата = ${amounts.prepaid_amount} ₴, ${amounts.cod_amount > 0 ? `накладений ${amounts.cod_amount} ₴` : `при отриманні ${amounts.pickup_unpaid_balance} ₴`})`
      : `Замовлення створено через checkout (повна оплата онлайн)`,
  });

  // Debit redeemed bonus from the customer's balance and log it. Done after the
  // order row exists so a failed insert never burns bonuses. Re-reads the
  // current balance and clamps again to avoid races / double-spend.
  if (customer_id && bonusApplied > 0) {
    try {
      const { data: fresh } = await admin
        .from('customers')
        .select('bonus_balance')
        .eq('id', customer_id)
        .maybeSingle();
      const liveBalance = Number(fresh?.bonus_balance || 0);
      const debit = Math.min(bonusApplied, liveBalance);
      if (debit > 0) {
        await admin.from('customers')
          .update({ bonus_balance: liveBalance - debit })
          .eq('id', customer_id);
        await admin.from('bonus_transactions').insert({
          customer_id,
          amount: -debit,
          kind: 'order_redemption',
          order_id: inserted.id,
          note: `Списання бонусів на замовлення ${inserted.order_number}`,
        });
      }
    } catch (e) {
      console.error('orders/submit: bonus debit failed (order still created):', e);
    }
  }

  // Record promo-code usage so single-use / max_uses actually work. Written
  // once per order, after the order row exists. Dedupe key is (promo_code_id,
  // customer_id|email). A failure here never breaks order creation.
  const promoId = (body as any).promo_id;
  if (promoId && typeof promoId === 'string') {
    try {
      const buyerEmail = body.customer_email?.trim().toLowerCase() || null;
      // Guard against double-insert (e.g. retry): skip if a usage row already
      // exists for this exact order.
      const { data: already } = await admin
        .from('promo_code_usages')
        .select('id')
        .eq('promo_code_id', promoId)
        .eq('order_id', inserted.id)
        .limit(1);
      if (!already || already.length === 0) {
        await admin.from('promo_code_usages').insert({
          promo_code_id: promoId,
          customer_id: customer_id || null,
          email: buyerEmail,
          order_id: inserted.id,
          discount_amount: Math.max(0, subtotal - total),
        });
        // Increment uses_count via a fresh read (no atomic rpc available).
        const { data: pc } = await admin
          .from('promo_codes')
          .select('uses_count')
          .eq('id', promoId)
          .maybeSingle();
        await admin.from('promo_codes')
          .update({ uses_count: Number(pc?.uses_count || 0) + 1 })
          .eq('id', promoId);
      }
    } catch (e) {
      console.error('orders/submit: promo usage recording failed (order still created):', e);
    }
  }

  return NextResponse.json({
    success: true,
    order_id: inserted.id,
    order_number: inserted.order_number,
    payment_type: inserted.payment_type,
    prepaid_amount: inserted.prepaid_amount,
    cod_amount: inserted.cod_amount,
    pickup_unpaid_balance: inserted.pickup_unpaid_balance,
  });
}
