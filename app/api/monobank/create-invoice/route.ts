import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

const MONOBANK_API_URL = 'https://api.monobank.ua/api/merchant/invoice/create';

export async function POST(req: Request) {
    try {
        const { orderId, paymentRegion = 'ua' } = await req.json();

        if (!orderId) {
            return NextResponse.json({ error: 'Order ID is required' }, { status: 400 });
        }

        // Choose token based on payment region
        // UA payments → MONOBANK_TOKEN (Ukrainian account)
        // International → MONOBANK_TOKEN_INTL (international account)
        const isInternational = paymentRegion === 'international';
        const token = isInternational
            ? process.env.MONOBANK_TOKEN_INTL
            : process.env.MONOBANK_TOKEN;

        if (!token) {
            const missing = isInternational ? 'MONOBANK_TOKEN_INTL' : 'MONOBANK_TOKEN';
            return NextResponse.json(
                { error: `${missing} не налаштований у Vercel Environment Variables` },
                { status: 500 }
            );
        }

        const supabase = getAdminClient();
        const { data: order, error: orderError } = await supabase
            .from('orders')
            .select('id, total, customer_name, customer_email, customer_phone, order_number, payment_type, prepaid_amount')
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

        const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://touchmemories.com.ua';

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
