import { NextResponse } from 'next/server';
import { requireStaff } from '@/lib/auth/guards';
import { getAdminClient } from '@/lib/supabase/admin';
import { processAgencyCommission } from '@/lib/agency/commission';
import { processReferralReward } from '@/lib/referral/referral';
import { redeemOrderCertificate } from '@/lib/certificates/redeemCertificate';

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/orders/[id]/check-payment
 *
 * Manual payment reconciliation: asks Monobank for the invoice status
 * directly and, if the bank says 'success', marks the order paid with the
 * same idempotent guard the webhook uses (only pending → paid; never
 * downgrades). Built for the TM-001043 case: customer paid, webhook never
 * landed, admin showed 'Очікує оплати' with no way to fix it but SQL.
 *
 * Tries every active Monobank token (dual-account routing) plus env
 * fallbacks until one recognizes the invoice. Side effects on transition:
 * customer confirmation email (fire-and-forget). Inventory/referrals are
 * NOT touched here — if the webhook later arrives it will be a no-op on
 * payment_status but will still run its own guarded side effects; and for
 * manual recovery cases Diana controls stock by hand anyway.
 */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
    const guard = await requireStaff();
    if (!guard.ok) return guard.response;

    const { id } = await params;
    const admin = getAdminClient();

    const { data: order } = await admin
        .from('orders')
        .select('id, order_number, payment_status, monobank_invoice_id, promo_code, items, customer_id, total, certificate_code, certificate_redeemed, certificate_applied')
        .eq('id', id)
        .maybeSingle();
    if (!order) return NextResponse.json({ error: 'Замовлення не знайдено' }, { status: 404 });
    if (!order.monobank_invoice_id) {
        return NextResponse.json({ status: 'no_invoice', message: 'У замовлення немає інвойсу Monobank.' });
    }
    if (order.payment_status === 'paid') {
        return NextResponse.json({ status: 'paid', message: 'Замовлення вже позначене оплаченим.' });
    }

    // Collect candidate tokens: all active DB accounts + env fallbacks.
    const tokens: string[] = [];
    const { data: accounts } = await admin
        .from('bank_accounts')
        .select('api_key')
        .eq('bank_name', 'Monobank')
        .eq('is_active', true);
    for (const a of accounts || []) if (a.api_key) tokens.push(a.api_key);
    if (process.env.MONOBANK_TOKEN) tokens.push(process.env.MONOBANK_TOKEN);
    if (process.env.MONOBANK_TOKEN_INTL) tokens.push(process.env.MONOBANK_TOKEN_INTL);
    if (tokens.length === 0) {
        return NextResponse.json({ error: 'Немає жодного токена Monobank' }, { status: 500 });
    }

    let bankStatus: string | null = null;
    let lastErr = '';
    for (const token of Array.from(new Set(tokens))) {
        try {
            const r = await fetch(
                `https://api.monobank.ua/api/merchant/invoice/status?invoiceId=${encodeURIComponent(order.monobank_invoice_id)}`,
                { headers: { 'X-Token': token }, cache: 'no-store' },
            );
            if (r.ok) {
                const j = await r.json();
                bankStatus = j?.status || null;
                if (bankStatus) break;
            } else {
                lastErr = `HTTP ${r.status}`;
            }
        } catch (e: any) { lastErr = e?.message || 'fetch failed'; }
    }
    if (!bankStatus) {
        return NextResponse.json({ status: 'unknown', message: `Банк не відповів (${lastErr}). Спробуйте пізніше.` });
    }

    if (bankStatus !== 'success') {
        return NextResponse.json({ status: bankStatus, message: `Статус у банку: ${bankStatus}. Оплату не підтверджено.` });
    }

    // Bank confirmed → idempotent transition pending → paid.
    const { data: updated, error } = await admin
        .from('orders')
        .update({ payment_status: 'paid', updated_at: new Date().toISOString() })
        .eq('id', id)
        .neq('payment_status', 'paid')
        .select('id')
        .maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    if (updated) {
        // Paid-transition accruals — the same ones the Monobank webhook runs.
        // This path confirms payments the webhook missed, so without them the
        // partner commission and friend-referral bonus would silently skip.
        // Both are idempotent via their UNIQUE(order_id) ledger guards.
        try {
            await processAgencyCommission(admin, {
                orderId: order.id,
                promoCode: (order as any).promo_code ?? null,
                items: (order as any).items,
            });
        } catch (e) { console.error('[check-payment] agency commission failed:', e); }
        try {
            await processReferralReward(admin, {
                orderId: order.id,
                customerId: (order as any).customer_id ?? null,
                orderTotal: Number((order as any).total) || 0,
            });
        } catch (e) { console.error('[check-payment] referral reward failed:', e); }

        // Certificate redemption — mirror the webhook so a cert used on an order
        // reconciled here is flipped to redeemed; otherwise it becomes spendable
        // again after the 24h reservation TTL (double-spend). Idempotent.
        if ((order as any).certificate_code && !(order as any).certificate_redeemed) {
            try {
                await redeemOrderCertificate(admin, {
                    orderId: order.id,
                    code: (order as any).certificate_code,
                    applied: Number((order as any).certificate_applied) || 0,
                    customerId: (order as any).customer_id ?? null,
                });
            } catch (e) { console.error('[check-payment] certificate redemption failed:', e); }
        }

        // Customer confirmation email — same guarded fire-and-forget as webhook.
        try {
            const base = (process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://touchmemories.com.ua').replace(/\/$/, '');
            await fetch(`${base}/api/email/transactional`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-cron-secret': process.env.CRON_SECRET || '' },
                body: JSON.stringify({ action: 'paid', orderId: id }),
                signal: AbortSignal.timeout(8000),
            }).catch(() => {});
        } catch { /* never block */ }
    }

    return NextResponse.json({ status: 'paid', message: 'Банк підтвердив оплату — замовлення позначено оплаченим' });
}
