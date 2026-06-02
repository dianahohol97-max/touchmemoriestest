import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { generateCertificateCode, calculateValidityDate } from '@/lib/certificates/generateCertificate';
import { sendCertificateEmail } from '@/lib/certificates/sendCertificateEmail';

export const dynamic = 'force-dynamic';

/**
 * Issue gift certificates for an order once payment is confirmed.
 *
 * Called fire-and-forget from the Monobank webhook (and safe to call from a
 * manual "mark as paid" admin action) with { orderId }. It does NOT trust the
 * caller about payment: it re-loads the order and only issues if the order is
 * actually fully paid. Idempotent — keyed on the certificate code, so webhook
 * retries or a double-trigger never create duplicate certificates.
 *
 * For each gift-certificate line item it:
 *   1. creates a `certificates` row (reusing the code the buyer saw at checkout)
 *   2. for electronic certificates with a recipient email, sends the cert email
 *      to the recipient.
 */
export async function POST(req: Request) {
    try {
        const { orderId } = await req.json();
        if (!orderId || typeof orderId !== 'string') {
            return NextResponse.json({ error: 'orderId is required' }, { status: 400 });
        }

        const admin = getAdminClient();

        const { data: order, error: orderErr } = await admin
            .from('orders')
            .select('id, items, customer_name, customer_email, payment_status, payment_type')
            .eq('id', orderId)
            .single();

        if (orderErr || !order) {
            return NextResponse.json({ error: 'Order not found' }, { status: 404 });
        }

        // Trust the DB, not the caller: only issue for a fully-paid order.
        if (order.payment_status !== 'paid') {
            return NextResponse.json({ skipped: 'not_paid' });
        }
        // Gift certificates are full-prepay. If an order is on a split plan the
        // invoice only covered the prepaid part, so don't issue yet.
        if (order.payment_type === 'split') {
            return NextResponse.json({ skipped: 'split_payment' });
        }

        const items: any[] = Array.isArray(order.items) ? order.items : [];
        const certItems = items.filter(
            (it) => it?.metadata?.certificateType || it?.options?.['Номер']
        );
        if (certItems.length === 0) {
            return NextResponse.json({ certificates: 0 });
        }

        let created = 0;
        let emailed = 0;
        const errors: string[] = [];

        for (const item of certItems) {
            const meta = item.metadata || {};
            const opts = item.options || {};

            const amount = Number(meta.amount ?? item.unit_price ?? 0);
            const format: 'electronic' | 'printed' = meta.format === 'printed' ? 'printed' : 'electronic';
            const recipientName: string | undefined = meta.recipientName || undefined;
            const recipientEmail: string | undefined = meta.recipientEmail || undefined;
            const message: string | undefined = meta.message || undefined;
            // Product certificates (bought from a product page) are tied to a
            // specific product and valid 3 months; money certificates 1 year.
            const certificateType: 'money' | 'product' = meta.certificateType === 'product' ? 'product' : 'money';

            // Reuse the code the buyer saw at checkout so the issued certificate
            // matches the cart/preview; fall back to a fresh code if missing.
            let code: string = meta.certificateCode || opts['Номер'] || generateCertificateCode();

            // Idempotency + uniqueness. If a cert with this code already exists:
            //  - same order  -> already issued, skip this item
            //  - other order -> astronomically unlikely 8-char collision; mint
            //    a new unique code instead of clobbering someone else's cert.
            let codeOwnedByThisOrder = false;
            for (let attempt = 0; attempt < 10; attempt++) {
                const { data: existing } = await admin
                    .from('certificates')
                    .select('id, order_id')
                    .eq('code', code)
                    .maybeSingle();
                if (!existing) break;
                if (existing.order_id === orderId) { codeOwnedByThisOrder = true; break; }
                code = generateCertificateCode();
            }
            if (codeOwnedByThisOrder) {
                continue; // already issued for this order — idempotent skip
            }

            const validUntil = calculateValidityDate(certificateType);

            const { error: insErr } = await admin.from('certificates').insert({
                code,
                certificate_type: certificateType,
                amount,
                product_id: certificateType === 'product' ? (meta.productId || null) : null,
                product_name: certificateType === 'product' ? (meta.productName || null) : null,
                format,
                recipient_name: recipientName,
                recipient_email: recipientEmail,
                message,
                valid_until: validUntil.toISOString(),
                order_id: orderId,
                purchaser_name: order.customer_name,
                purchaser_email: order.customer_email,
                redeemed: false,
            });

            if (insErr) {
                console.error('certificates/on-payment insert error:', insErr);
                errors.push(`insert ${code}: ${insErr.message}`);
                continue;
            }
            created++;

            // Electronic certificate -> email it to the recipient now.
            if (format === 'electronic' && recipientEmail) {
                const sent = await sendCertificateEmail({
                    code,
                    amount,
                    recipient_name: recipientName,
                    recipient_email: recipientEmail,
                    sender_name: order.customer_name || undefined,
                    message,
                    expires_at: validUntil,
                });
                if (sent.ok) emailed++;
                else errors.push(`email ${code}: ${sent.error}`);
            }
        }

        return NextResponse.json({ certificates: created, emailed, errors });
    } catch (error: any) {
        console.error('certificates/on-payment error:', error);
        return NextResponse.json({ error: error?.message || 'Internal error' }, { status: 500 });
    }
}
