import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
    const supabase = getAdminClient();
    try {
        const body = await req.json();
        const { invoiceId, status, amount } = body;

        console.log(`[Monobank Webhook] Received status ${status} for invoice ${invoiceId}`);

        if (status === 'success') {
            // 1. Update Order Status
            const { data: order, error: orderError } = await supabase
                .from('orders')
                .update({
                    payment_status: 'paid',
                    order_status: 'confirmed',
                    paid_at: new Date().toISOString()
                })
                .eq('mono_invoice_id', invoiceId)
                .select()
                .single();

            if (orderError) throw new Error(`Order update failed: ${orderError.message}`);

            // 2. Trigger Fiscalization (Checkbox)
            const { fiscalizeOrder } = await import('@/tools/checkbox_fiscalize.mjs' as any);

            const fiscalResult = await fiscalizeOrder(
                order.id,
                order.customer_email,
                order.items,
                order.total
            );

            if (fiscalResult.success) {
                await supabase
                    .from('orders')
                    .update({
                        fiscal_status: 'created',
                        fiscal_id: fiscalResult.receiptId,
                        fiscal_url: fiscalResult.receiptUrl
                    })
                    .eq('id', order.id);
            } else {
                await supabase
                    .from('orders')
                    .update({ fiscal_status: 'error', notes: `Fiscal error: ${fiscalResult.error}` })
                    .eq('id', order.id);
            }

            console.log(`[Monobank Webhook] Order ${order.order_number} processed.`);

            // 3. Trigger Order Placed Email
            try {
                // Ensure absolute URL for fetch in webhook environment
                const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
                await fetch(`${siteUrl}/api/email/transactional`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'placed', orderId: order.id })
                });
                console.log(`[Monobank Webhook] Triggered Order Placed email for ${order.id}`);
            } catch (emailErr) {
                console.error('[Monobank Webhook] Failed to trigger email:', emailErr);
            }
        }

        return NextResponse.json({ processed: true });
    } catch (error: any) {
        console.error('[Monobank Webhook] Error:', error.message);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
