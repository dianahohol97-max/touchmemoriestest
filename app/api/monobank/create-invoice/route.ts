import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

/**
 * Monobank Acquiring API - Create Invoice
 * Documentation: https://api.monobank.ua/docs/acquiring.html
 */

const MONOBANK_API_URL = 'https://api.monobank.ua/api/merchant/invoice/create';

export async function POST(req: Request) {
    try {
        const { orderId } = await req.json();

        if (!orderId) {
            return NextResponse.json(
                { error: 'Order ID is required' },
                { status: 400 }
            );
        }

        const token = process.env.MONOBANK_TOKEN;
        if (!token) {
            return NextResponse.json(
                { error: 'Monobank token not configured' },
                { status: 500 }
            );
        }

        // Fetch order from Supabase
        const supabase = getAdminClient();
        const { data: order, error: orderError } = await supabase
            .from('orders')
            .select('id, total, customer_name, customer_email, customer_phone')
            .eq('id', orderId)
            .single();

        if (orderError || !order) {
            return NextResponse.json(
                { error: 'Order not found' },
                { status: 404 }
            );
        }

        // Amount in kopecks (kopiйки)
        const amountInKopecks = Math.round(Number(order.total) * 100);

        // Get base URL for webhook and redirect
        const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://touchmemories.com.ua';

        // Create invoice via Monobank API
        const monoResponse = await fetch(MONOBANK_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Token': token
            },
            body: JSON.stringify({
                amount: amountInKopecks,
                ccy: 980, // UAH currency code (ISO 4217)
                merchantPaymInfo: {
                    reference: orderId,
                    destination: `Замовлення TouchMemories #${orderId.substring(0, 8)}`,
                    comment: order.customer_name || '',
                    basketOrder: [
                        {
                            name: `Замовлення #${orderId.substring(0, 8)}`,
                            qty: 1,
                            sum: amountInKopecks,
                            code: orderId
                        }
                    ]
                },
                redirectUrl: `${baseUrl}/dyakuiemo`,
                webHookUrl: `${baseUrl}/api/monobank/webhook`,
                validity: 86400, // 24 hours in seconds
                paymentType: 'debit' // Debit card payment
            })
        });

        const monoData = await monoResponse.json();

        if (!monoResponse.ok) {
            console.error('Monobank API error:', monoData);
            return NextResponse.json(
                {
                    error: 'Monobank API error',
                    details: monoData.errText || monoData.errorDescription || 'Unknown error'
                },
                { status: monoResponse.status }
            );
        }

        const { invoiceId, pageUrl } = monoData;

        if (!invoiceId || !pageUrl) {
            return NextResponse.json(
                { error: 'Invoice not created' },
                { status: 500 }
            );
        }

        // Save invoice ID to order
        const { error: updateError } = await supabase
            .from('orders')
            .update({
                monobank_invoice_id: invoiceId,
                monobank_payment_url: pageUrl,
                updated_at: new Date().toISOString()
            })
            .eq('id', orderId);

        if (updateError) {
            console.error('Error saving invoice to database:', updateError);
            // Continue anyway, invoice was created
        }

        // Log history
        await supabase.from('order_history').insert({
            order_id: orderId,
            action: 'payment_link_created',
            notes: `Створено посилання на оплату Monobank: ${invoiceId}`,
            added_by: null // TODO: Get from auth
        });

        return NextResponse.json({
            success: true,
            invoiceId,
            pageUrl,
            amount: order.total,
            amountInKopecks
        });

    } catch (error: any) {
        console.error('Invoice creation error:', error);
        return NextResponse.json(
            { error: error.message || 'Internal server error' },
            { status: 500 }
        );
    }
}
