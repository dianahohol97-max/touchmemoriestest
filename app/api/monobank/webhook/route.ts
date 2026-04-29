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

        // Verify signature.
        // If MONOBANK_PUB_KEY is configured, the signature is REQUIRED — reject
        // requests that lack the header or fail verification. Previously the
        // verification was skipped when the header was absent, which made the
        // endpoint trivially forgeable: any unauthenticated caller could POST
        // {reference, status:'success'} and mark an order as paid.
        const pubKey = process.env.MONOBANK_PUB_KEY;
        if (pubKey) {
            const xSignBase64 = req.headers.get('X-Sign');
            if (!xSignBase64) {
                console.error('Monobank webhook: missing X-Sign header');
                return NextResponse.json(
                    { error: 'Missing signature' },
                    { status: 401 }
                );
            }
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
        } else {
            // Hard-fail in production if the env var was forgotten. Better to
            // 503 the webhook than silently process unsigned payloads.
            if (process.env.NODE_ENV === 'production') {
                console.error('Monobank webhook: MONOBANK_PUB_KEY not configured in production');
                return NextResponse.json(
                    { error: 'Webhook not configured' },
                    { status: 503 }
                );
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

        // Validate reference looks like a UUID (our order_id format) so a
        // malformed payload can't cause oddities in the WHERE clause below.
        const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (typeof reference !== 'string' || !UUID_RE.test(reference)) {
            console.error('Monobank webhook: invalid reference format', { reference });
            return NextResponse.json({ error: 'Invalid reference' }, { status: 400 });
        }

        // Idempotency + amount verification: load the order first.
        // Two reasons:
        //  1. Monobank retries webhooks. If we've already marked this
        //     invoice as paid for this order, skip the rest of the work.
        //  2. Verify the paid amount matches the order's stored total
        //     (in kopecks). A mismatch should never happen with a valid
        //     signature + our own create-invoice flow, but a defence in
        //     depth check costs nothing and would catch e.g. a hijacked
        //     keypair situation.
        const { data: existingOrder } = await supabase
            .from('orders')
            .select('id, total, payment_status, monobank_invoice_status, monobank_invoice_id')
            .eq('id', reference)
            .single();

        if (!existingOrder) {
            console.error('Monobank webhook: order not found', { reference });
            return NextResponse.json({ error: 'Order not found' }, { status: 404 });
        }

        // If we've already processed this exact invoice with this status, skip.
        if (
            existingOrder.monobank_invoice_id === invoiceId &&
            existingOrder.monobank_invoice_status === status
        ) {
            console.log('Monobank webhook: duplicate notification, skipping', { reference, invoiceId, status });
            return NextResponse.json({ success: true, idempotent: true });
        }

        // Amount verification (only meaningful on 'success' / 'hold').
        if ((status === 'success' || status === 'hold') && typeof amount === 'number') {
            const expectedKopecks = Math.round(Number(existingOrder.total) * 100);
            if (Math.abs(amount - expectedKopecks) > 1) {
                // Off-by-one tolerance for rounding, but anything bigger is suspicious.
                console.error('Monobank webhook: amount mismatch', {
                    reference,
                    invoice_amount: amount,
                    order_total_kopecks: expectedKopecks,
                });
                return NextResponse.json({ error: 'Amount mismatch' }, { status: 400 });
            }
        }

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

        // Update order payment status — atomic conditional UPDATE.
        // Only writes if the invoice/status combo isn't already recorded,
        // which is what makes this race-safe: two concurrent webhook
        // deliveries can't both succeed and both insert an order_history
        // row. Whichever UPDATE runs first wins; the second observes 0
        // affected rows and short-circuits.
        const { data: updateResult, error: updateError } = await supabase
            .from('orders')
            .update({
                payment_status: paymentStatus,
                monobank_invoice_id: invoiceId,
                monobank_invoice_status: status,
                monobank_approval_code: approvalCode || null,
                monobank_rrn: rrn || null,
                ...(status === 'success' && existingOrder.payment_status !== 'paid'
                    ? { paid_at: new Date().toISOString() }
                    : {}),
                updated_at: new Date().toISOString()
            })
            .eq('id', reference)
            // Race-safety: only update if the (invoice_id, status) tuple
            // hasn't already been applied. Use 'or' to handle the first-time
            // case where monobank_invoice_id is NULL.
            .or(`monobank_invoice_id.is.null,monobank_invoice_id.neq.${invoiceId},monobank_invoice_status.neq.${status}`)
            .select('id');

        if (updateError) {
            console.error('Error updating order payment status:', updateError);
            return NextResponse.json(
                { error: 'Database update failed' },
                { status: 500 }
            );
        }

        // 0 rows affected means another concurrent webhook for this same
        // invoice+status got there first.
        if (!updateResult || updateResult.length === 0) {
            console.log('Monobank webhook: concurrent duplicate, skipping', { reference, invoiceId, status });
            return NextResponse.json({ success: true, idempotent: true });
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
