import { getAdminClient } from '@/lib/supabase/admin';
import { CheckboxService } from '@/lib/checkbox';

//
// Fiscalise a PAID order via Checkbox.
//
// Rules:
//  - Cash register ← the ФОП that received the money: fiscal_accounts.region
//    matches orders.payment_region ('ua' → ФОП Коблик, 'international' → Гоголь).
//  - Whether to fiscalise at all + the receipt type ← fiscal_rules, keyed by
//    payment_type ('full'/'split'), gated by is_enabled. Default receipt type:
//    'sell' for full, 'prepayment' for split (50% prepaid).
//  - Idempotent: skips if the order already has a fiscal_id.
//  - Never throws — fiscalisation must not break the payment webhook. Failures
//    are recorded on the order (fiscal_status='error') + order_history.
//
export async function fiscalizeOrder(orderId: string): Promise<{ ok: boolean; reason?: string; fiscalId?: string }> {
  const supabase = getAdminClient();

  try {
    const { data: order } = await supabase
      .from('orders')
      .select('id, order_number, total, items, customer_email, payment_region, payment_type, fiscal_id, fiscal_status')
      .eq('id', orderId)
      .single();

    if (!order) return { ok: false, reason: 'order_not_found' };
    if (order.fiscal_id) return { ok: true, reason: 'already_fiscalised', fiscalId: order.fiscal_id };

    // Gate: is fiscalisation enabled for this order's payment type?
    // orders.payment_type is 'full' | 'split'; fiscal_rules keys are
    // 'full' (sell receipt) and 'prepayment' (50% prepaid → prepayment receipt).
    const isSplit = order.payment_type === 'split';
    const ruleKey = isSplit ? 'prepayment' : 'full';
    const { data: rule } = await supabase
      .from('fiscal_rules')
      .select('is_enabled, receipt_type, fiscal_account_id')
      .eq('payment_type', ruleKey)
      .maybeSingle();

    if (!rule || !rule.is_enabled) {
      return { ok: false, reason: 'fiscalisation_disabled' };
    }

    // Cash register: by region (the ФОП that got the money). A rule may also
    // pin a specific account; region match wins for correctness, falling back
    // to the rule's account, then any active account.
    const region = order.payment_region === 'international' ? 'international' : 'ua';
    let { data: account } = await supabase
      .from('fiscal_accounts')
      .select('login, password, license_key, cashier_name')
      .eq('region', region)
      .eq('is_active', true)
      .maybeSingle();

    if (!account && rule.fiscal_account_id) {
      const r = await supabase
        .from('fiscal_accounts')
        .select('login, password, license_key, cashier_name')
        .eq('id', rule.fiscal_account_id)
        .maybeSingle();
      account = r.data;
    }

    if (!account || !account.login || !account.license_key) {
      await supabase.from('orders').update({ fiscal_status: 'error' }).eq('id', orderId);
      await supabase.from('order_history').insert({
        order_id: orderId,
        action: 'fiscal_error',
        notes: `Фіскалізація: не знайдено активної каси для регіону "${region}"`,
      });
      return { ok: false, reason: 'no_fiscal_account' };
    }

    const receiptType: 'sell' | 'prepayment' =
      (rule.receipt_type === 'prepayment' || isSplit) ? 'prepayment' : 'sell';

    const checkbox = new CheckboxService({
      login: account.login,
      password: account.password,
      licenseKey: account.license_key,
      cashierName: account.cashier_name,
    });

    const receipt = await checkbox.createReceipt(order, receiptType);

    await supabase.from('orders').update({
      fiscal_id: receipt.id,
      fiscal_url: receipt.fiscalUrl,
      fiscal_status: 'done',
      updated_at: new Date().toISOString(),
    }).eq('id', orderId);

    await supabase.from('order_history').insert({
      order_id: orderId,
      action: 'fiscal_receipt_created',
      notes: `Чек пробито (${region === 'international' ? 'ФОП Гоголь' : 'ФОП Коблик'}, ${receiptType}). ID: ${receipt.id}`,
    });

    return { ok: true, fiscalId: receipt.id };
  } catch (e: any) {
    try {
      await supabase.from('orders').update({ fiscal_status: 'error' }).eq('id', orderId);
      await supabase.from('order_history').insert({
        order_id: orderId,
        action: 'fiscal_error',
        notes: `Помилка фіскалізації: ${e?.message || 'unknown'}`.slice(0, 500),
      });
    } catch { /* swallow */ }
    console.error('[fiscalizeOrder] failed:', e);
    return { ok: false, reason: e?.message || 'error' };
  }
}

/**
 * Close a 50/50 split order's prepayment chain when the remainder is collected
 * at delivery (Nova Poshta COD). Fires a postpayment receipt for (total −
 * prepaid_amount) and lets Checkbox email it to the customer.
 *
 * Triggered on the delivered transition (sync-tracking). Guards:
 *  - only split orders that already have a prepayment receipt (fiscal_id)
 *  - skips if already postpaid (fiscal_status === 'postpaid')
 *  - gated by the 'postpayment' fiscal_rule being enabled
 * Idempotent + non-throwing.
 */
export async function fiscalizePostpayment(orderId: string): Promise<{ ok: boolean; reason?: string }> {
  const supabase = getAdminClient();
  try {
    const { data: order } = await supabase
      .from('orders')
      .select('id, order_number, total, prepaid_amount, items, customer_email, payment_region, payment_type, fiscal_id, fiscal_status')
      .eq('id', orderId)
      .single();

    if (!order) return { ok: false, reason: 'order_not_found' };
    if (order.payment_type !== 'split') return { ok: false, reason: 'not_split' };
    if (!order.fiscal_id) return { ok: false, reason: 'no_prepayment_receipt' };
    if (order.fiscal_status === 'postpaid') return { ok: true, reason: 'already_postpaid' };

    const { data: rule } = await supabase
      .from('fiscal_rules')
      .select('is_enabled')
      .eq('payment_type', 'postpayment')
      .maybeSingle();
    if (!rule || !rule.is_enabled) return { ok: false, reason: 'postpayment_disabled' };

    const region = order.payment_region === 'international' ? 'international' : 'ua';
    const { data: account } = await supabase
      .from('fiscal_accounts')
      .select('login, password, license_key, cashier_name')
      .eq('region', region)
      .eq('is_active', true)
      .maybeSingle();
    if (!account || !account.login || !account.license_key) {
      return { ok: false, reason: 'no_fiscal_account' };
    }

    const remainder = Math.max(0, (Number(order.total) || 0) - (Number(order.prepaid_amount) || 0));
    if (remainder <= 0) return { ok: false, reason: 'nothing_to_settle' };

    const checkbox = new CheckboxService({
      login: account.login,
      password: account.password,
      licenseKey: account.license_key,
      cashierName: account.cashier_name,
    });

    const receipt = await checkbox.createPostpaymentReceipt(order, remainder);

    await supabase.from('orders').update({ fiscal_status: 'postpaid', updated_at: new Date().toISOString() }).eq('id', orderId);
    await supabase.from('order_history').insert({
      order_id: orderId,
      action: 'fiscal_postpayment_created',
      notes: `Чек післяплати пробито на ${remainder} грн. ID: ${receipt.id}`,
    });
    return { ok: true };
  } catch (e: any) {
    try {
      await supabase.from('order_history').insert({
        order_id: orderId,
        action: 'fiscal_error',
        notes: `Помилка чека післяплати: ${e?.message || 'unknown'}`.slice(0, 500),
      });
    } catch { /* swallow */ }
    console.error('[fiscalizePostpayment] failed:', e);
    return { ok: false, reason: e?.message || 'error' };
  }
}
