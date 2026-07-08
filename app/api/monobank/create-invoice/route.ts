import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { getRuntimeBaseUrl } from '@/lib/runtimeUrl';

export const dynamic = 'force-dynamic';

const MONOBANK_API_URL = 'https://api.monobank.ua/api/merchant/invoice/create';

export async function POST(req: Request) {
    try {
        const { orderId, paymentRegion = 'ua' } = await req.json();

        if (!orderId) {
            return NextResponse.json({ error: 'Order ID is required' }, { status: 400 });
        }

        const isInternational = paymentRegion === 'international';

        const supabase = getAdminClient();

        // ──────────────────────────────────────────────────────────────
        // Account routing: take the Monobank api_key from the active
        // bank_accounts row whose region matches the shipping destination.
        //   international → ФОП Гоголь Діана   ua → ФОП Коблик Тамара
        // Env tokens (MONOBANK_TOKEN / MONOBANK_TOKEN_INTL) are kept ONLY as
        // a fallback if the DB row is missing/inactive, so a misconfigured
        // table can't take payments fully offline.
        // ──────────────────────────────────────────────────────────────
        const { data: bankAccount } = await supabase
            .from('bank_accounts')
            .select('api_key')
            .eq('region', paymentRegion)
            .eq('bank_name', 'Monobank')
            .eq('is_active', true)
            .maybeSingle();

        const envToken = isInternational
            ? process.env.MONOBANK_TOKEN_INTL
            : process.env.MONOBANK_TOKEN;
        const token = bankAccount?.api_key || envToken;

        if (!token) {
            const which = isInternational ? 'international (ФОП Гоголь)' : 'ua (ФОП Коблик)';
            return NextResponse.json(
                { error: `Monobank-ключ для регіону ${which} не знайдено: ні в bank_accounts, ні у env` },
                { status: 500 }
            );
        }

        const { data: order, error: orderError } = await supabase
            .from('orders')
            .select('id, total, customer_name, customer_email, customer_phone, order_number, payment_type, prepaid_amount, monobank_invoice_id')
            .eq('id', orderId)
            .single();

        if (orderError || !order) {
            return NextResponse.json({ error: 'Order not found' }, { status: 404 });
        }

        // Save payment_region to order
        await supabase.from('orders')
            .update({ payment_region: paymentRegion, updated_at: new Date().toISOString() })
            .eq('id', orderId);

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
