import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { getRuntimeBaseUrl } from '@/lib/runtimeUrl';
import { deliveryToPaymentRegion } from '@/lib/payment/pricing-region';

export const dynamic = 'force-dynamic';

const MONOBANK_API_URL = 'https://api.monobank.ua/api/merchant/invoice/create';

export async function POST(req: Request) {
    try {
        const { orderId } = await req.json();

        if (!orderId) {
            return NextResponse.json({ error: 'Order ID is required' }, { status: 400 });
        }

        const supabase = getAdminClient();

        // The payment region is derived SERVER-SIDE from the order itself.
        // The route used to trust a paymentRegion field from the request body
        // (and even wrote it back onto the order), so anyone who knew an order
        // UUID could re-issue the invoice with paymentRegion='international'
        // and steer a Ukrainian order's money onto the other ФОП's account.
        const { data: order, error: orderError } = await supabase
            .from('orders')
            .select('id, total, customer_name, customer_email, customer_phone, order_number, payment_type, prepaid_amount, monobank_invoice_id, payment_region, payment_status, delivery_method, delivery_address')
            .eq('id', orderId)
            .single();

        if (orderError || !order) {
            return NextResponse.json({ error: 'Order not found' }, { status: 404 });
        }

        // A paid order never needs a new invoice — re-issuing one for it is
        // either a stale client or someone probing with a leaked UUID.
        if (order.payment_status === 'paid') {
            return NextResponse.json({ error: 'Замовлення вже оплачено — нове посилання на оплату не потрібне.' }, { status: 409 });
        }

        const paymentRegion: 'ua' | 'international' =
            order.payment_region === 'international' || order.payment_region === 'ua'
                ? order.payment_region
                : deliveryToPaymentRegion(order.delivery_method, (order.delivery_address as any)?.country);
        const isInternational = paymentRegion === 'international';

        // ──────────────────────────────────────────────────────────────
        // Account routing: take the Monobank api_key from the active
        // bank_accounts row whose region matches the shipping destination.
        //   international → ФОП Гоголь Діана   ua → ФОП Коблик Тамара
        // Env tokens (MONOBANK_TOKEN / MONOBANK_TOKEN_INTL) are kept ONLY as
        // a fallback if the DB row is missing/inactive, so a misconfigured
        // table can't take payments fully offline.
        // ──────────────────────────────────────────────────────────────
        // Look up the row for this region REGARDLESS of is_active, so a
        // disabled account can't silently fall through to an env token that
        // belongs to a different ФОП. Until today the 'ua' row carried the
        // wrong owner's token; a silent fallback would re-create exactly that
        // class of error, and money landing on the wrong entity is not
        // something an error log can undo.
        const { data: bankAccount } = await supabase
            .from('bank_accounts')
            .select('api_key, is_active, label')
            .eq('region', paymentRegion)
            .eq('bank_name', 'Monobank')
            .maybeSingle();

        if (bankAccount && !bankAccount.is_active) {
            return NextResponse.json(
                { error: `Рахунок Monobank для регіону ${paymentRegion} (${bankAccount.label}) вимкнено. Увімкніть його в адмінці — оплату не створено, щоб гроші не пішли на інший ФОП.` },
                { status: 503 },
            );
        }

        const envToken = isInternational
            ? process.env.MONOBANK_TOKEN_INTL
            : process.env.MONOBANK_TOKEN;
        if (!bankAccount?.api_key && envToken) {
            console.warn(`[create-invoice] No bank_accounts row for region ${paymentRegion} — falling back to env token. Verify which ФОП owns it.`);
        }
        const token = bankAccount?.api_key || envToken;

        if (!token) {
            const which = isInternational ? 'international (ФОП Гоголь)' : 'ua (ФОП Коблик)';
            return NextResponse.json(
                { error: `Monobank-ключ для регіону ${which} не знайдено: ні в bank_accounts, ні у env` },
                { status: 500 }
            );
        }

        // Persist the derived region only when the order didn't carry one yet
        // (legacy/manual orders) — never overwrite an existing value.
        if (order.payment_region !== paymentRegion) {
            await supabase.from('orders')
                .update({ payment_region: paymentRegion, updated_at: new Date().toISOString() })
                .eq('id', orderId)
                .is('payment_region', null);
        }

        // ──────────────────────────────────────────────────────────────
        // Invoice amount:
        //   - If payment_type='split' and prepaid_amount is set, charge prepaid_amount (= 50%)
        //   - Otherwise charge the full total
        // The remaining 50% (for split orders) is collected on delivery:
        //   - Nova Poshta: via BackwardDeliveryData (cod_amount) when TTN is created
        //   - Pickup: as pickup_unpaid_balance, collected cash by the manager
        // ──────────────────────────────────────────────────────────────
        const isSplit = order.payment_type === 'split' && Number(order.prepaid_amount) > 0;
        const chargeAmount = isSplit
            ? Number(order.prepaid_amount)
            : Number(order.total);
        const amountInKopecks = Math.round(chargeAmount * 100);

        // A 0 (or negative) amount can never be invoiced — Monobank rejects it
        // with a cryptic error that the checkout then mistakes for "payment not
        // configured". Fail loudly and clearly instead. This also catches
        // designer/quote-later orders (total=0) that should never reach online
        // payment in the first place.
        if (!Number.isFinite(amountInKopecks) || amountInKopecks <= 0) {
            return NextResponse.json(
                { error: `Сума замовлення дорівнює 0 — оплату онлайн неможливо створити. Перевірте ціну позицій або зверніться до менеджера.` },
                { status: 400 }
            );
        }

        // Runtime host (NOT the SEO/brand domain): the webhook + redirect must
        // hit a host that is actually serving this deployment, or payments
        // silently never confirm. See lib/runtimeUrl.
        const baseUrl = getRuntimeBaseUrl();

        const monoResponse = await fetch(MONOBANK_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Token': token
            },
            body: JSON.stringify({
                amount: amountInKopecks,
                ccy: 980, // UAH
                merchantPaymInfo: {
                    reference: orderId,
                    destination: isSplit
                        ? `Передоплата 50% за замовлення TouchMemories ${order.order_number || orderId.substring(0, 8)}`
                        : `Замовлення TouchMemories ${order.order_number || orderId.substring(0, 8)}`,
                    comment: order.customer_name || '',
                    basketOrder: [{
                        name: isSplit
                            ? `Передоплата 50% — замовлення ${order.order_number || '#' + orderId.substring(0, 8)}`
                            : `Замовлення ${order.order_number || '#' + orderId.substring(0, 8)}`,
                        qty: 1,
                        sum: amountInKopecks,
                        code: orderId
                    }]
                },
                redirectUrl: `${baseUrl}/dyakuiemo?order=${orderId}`,
                webHookUrl: `${baseUrl}/api/monobank/webhook`,
                validity: 86400,
                paymentType: 'debit'
            })
        });

        const monoData = await monoResponse.json();

        if (!monoResponse.ok) {
            return NextResponse.json(
                { error: 'Monobank API error', details: monoData.errText || monoData.errorDescription || 'Unknown error' },
                { status: monoResponse.status }
            );
        }

        const { invoiceId, pageUrl } = monoData;

        if (!invoiceId || !pageUrl) {
            return NextResponse.json({ error: 'Invoice not created' }, { status: 500 });
        }

        await supabase.from('orders').update({
            monobank_invoice_id: invoiceId,
            monobank_payment_url: pageUrl,
            updated_at: new Date().toISOString()
        }).eq('id', orderId);

        // First invoice for this order → email the customer "замовлення
        // прийнято" WITH a pay button. Safety net for lost redirects
        // (Instagram webview, closed tabs): TM-001043's customer finished
        // checkout, the redirect never landed, and the site had no visible
        // way for a guest to pay. Fire-and-forget; mail can never break
        // invoice creation. Re-created invoices (retries) don't re-send.
        try {
            const firstInvoice = !(order as any).monobank_invoice_id;
            if (firstInvoice && order.customer_email) {
                const base = (process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://touchmemories.com.ua').replace(/\/$/, '');
                // AWAITED: fire-and-forget dies on Vercel — the lambda freezes
                // right after the response is returned, so the request was
                // never actually sent (email_logs stayed empty for two days
                // of invoices). ~300ms of latency buys a real email.
                await fetch(`${base}/api/email/transactional`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'x-cron-secret': process.env.CRON_SECRET || '' },
                    body: JSON.stringify({ action: 'placed', orderId }),
                    signal: AbortSignal.timeout(8000),
                }).catch(() => {});
            }
        } catch { /* never block payment */ }

        await supabase.from('order_history').insert({
            order_id: orderId,
            action: 'payment_link_created',
            notes: isSplit
                ? `Посилання на передоплату 50% створено (${isInternational ? 'міжнародний рахунок' : 'Україна'}). Сума: ${chargeAmount} ₴. Invoice: ${invoiceId}`
                : `Посилання на оплату створено (${isInternational ? 'міжнародний рахунок' : 'Україна'}). Invoice: ${invoiceId}`,
            added_by: null
        });

        return NextResponse.json({ success: true, invoiceId, pageUrl, amount: chargeAmount, isSplit });

    } catch (error: any) {
        return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
    }
}
