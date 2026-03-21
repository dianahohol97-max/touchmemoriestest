import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

/**
 * Monobank Webhook Handler
 * Handles payment status updates from Monobank
 * Documentation: https://api.monobank.ua/docs/acquiring.html#webhook
 */

export async function POST(req: Request) {
    try {
        const body = await req.text();
        const data = JSON.parse(body);

        // Verify signature (recommended for production)
        const pubKey = process.env.MONOBANK_PUB_KEY;
        if (pubKey) {
            const xSignBase64 = req.headers.get('X-Sign');
            if (xSignBase64) {
                const verify = crypto.createVerify('SHA256');
                verify.update(body);
                verify.end();

                const isValid = verify.verify(pubKey, xSignBase64, 'base64');
                if (!isValid) {
                    console.error('Monobank webhook signature verification failed');
                    return NextResponse.json(
                        { error: 'Invalid signature' },
                        { status: 401 }
                    );
                }
            }
        }

        const {
            invoiceId,
            status,
            amount,
            ccy,
            reference, // This is our orderId
            approvalCode,
            rrn,
            createdDate,
            modifiedDate,
            failureReason
        } = data;

        console.log('Monobank webhook received:', {
            invoiceId,
            status,
            reference,
            amount
        });

        if (!reference) {
            console.error('No reference (orderId) in webhook data');
            return NextResponse.json(
                { error: 'Missing reference' },
                { status: 400 }
            );
        }

        const supabase = getAdminClient();

        // Map Monobank status to payment status
        let paymentStatus = 'pending';
        let notes = '';

        switch (status) {
            case 'success':
                paymentStatus = 'paid';
                notes = `Оплата успішна через Monobank. Invoice: ${invoiceId}, RRN: ${rrn}, Код: ${approvalCode}`;
                break;
            case 'processing':
                paymentStatus = 'pending';
                notes = `Оплата в обробці. Invoice: ${invoiceId}`;
                break;
            case 'hold':
                paymentStatus = 'pending';
                notes = `Сума заблокована (hold). Invoice: ${invoiceId}`;
                break;
            case 'failure':
                paymentStatus = 'failed';
                notes = `Оплата відхилена. Invoice: ${invoiceId}, Причина: ${failureReason || 'Unknown'}`;
                break;
            case 'reversed':
                paymentStatus = 'refunded';
                notes = `Оплата повернена (reversed). Invoice: ${invoiceId}`;
                break;
            default:
                notes = `Статус оплати змінено на: ${status}. Invoice: ${invoiceId}`;
        }

        // Update order payment status
        const { error: updateError } = await supabase
            .from('orders')
            .update({
                payment_status: paymentStatus,
                monobank_invoice_status: status,
                monobank_approval_code: approvalCode || null,
                monobank_rrn: rrn || null,
                paid_at: status === 'success' ? new Date().toISOString() : null,
                updated_at: new Date().toISOString()
            })
            .eq('id', reference);

        if (updateError) {
            console.error('Error updating order payment status:', updateError);
            return NextResponse.json(
                { error: 'Database update failed' },
                { status: 500 }
            );
        }

        // Log payment event in order history
        await supabase.from('order_history').insert({
            order_id: reference,
            action: 'payment_status_changed',
            notes: notes,
            added_by: null
        });

        // If payment successful, you might want to:
        // 1. Send confirmation email
        // 2. Update order status to 'confirmed'
        // 3. Trigger fulfillment process
        if (status === 'success') {
            // Optional: Auto-confirm order
            const { data: order } = await supabase
                .from('orders')
                .select('order_status')
                .eq('id', reference)
                .single();

            if (order && order.order_status === 'new') {
                await supabase
                    .from('orders')
                    .update({ order_status: 'confirmed' })
                    .eq('id', reference);

                await supabase.from('order_history').insert({
                    order_id: reference,
                    action: 'status_changed',
                    notes: 'Статус автоматично змінено на "Підтверджено" після оплати',
                    added_by: null
                });
            }
        }

        return NextResponse.json({
            success: true,
            message: 'Webhook processed'
        });

    } catch (error: any) {
        console.error('Webhook processing error:', error);
        return NextResponse.json(
            { error: error.message || 'Internal server error' },
            { status: 500 }
        );
    }
}

// GET method for webhook verification (Monobank might ping your webhook URL)
export async function GET() {
    return NextResponse.json({
        success: true,
        message: 'Monobank webhook endpoint is active'
    });
}
