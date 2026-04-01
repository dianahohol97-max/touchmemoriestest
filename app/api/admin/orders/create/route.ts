import { getAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
    try {
        const payload = await request.json();
        const { customer, items, delivery, totals, notes, source, payment } = payload;

        // Bypassing RLS for admin operations (system must use Service Role here)
        const supabase = getAdminClient();

        // 1. Process Customer Info
        // Check if customer exists by phone.
        // We clean the phone number to just digits for search
        const cleanPhone = customer.phone.replace(/[^0-9]/g, '');
        let customerId;

        // Perform a flexible search
        const { data: existingCustomers } = await supabase
            .from('customers')
            .select('*')
            .ilike('phone', `%${cleanPhone}%`);

        if (existingCustomers && existingCustomers.length > 0) {
            customerId = existingCustomers[0].id;
        } else {
            // Create a new barebones customer profile
            const { data: newCust, error: custErr } = await supabase
                .from('customers')
                .insert({
                    name: `${customer.first_name} ${customer.last_name}`.trim(),
                    first_name: customer.first_name,
                    last_name: customer.last_name,
                    phone: customer.phone,
                    email: customer.email || null,
                    telegram: customer.telegram || null,
                    birthday: customer.birthday || null
                })
                .select('id')
                .single();

            if (custErr) throw custErr;
            customerId = newCust.id;
        }

        // 2. Generate unique Order Number Order PB-[YEAR]-[RANDOM]
        const year = new Date().getFullYear();
        const randomStr = Math.random().toString(36).substring(2, 7).toUpperCase();
        const orderNumber = `PB-${year}-${randomStr}`;

        // 3. Construct initial note with Instagram Handle (if provided) that won't get lost
        let orderNotes = customer.instagram ? `⚠️ Instagram замовлення (${customer.instagram})\n` : '';
        orderNotes += notes;

        // 4. Create the Order
        const newOrderData = {
            order_number: orderNumber,
            customer_id: customerId,
            customer_name: `${customer.first_name} ${customer.last_name}`.trim(),
            customer_first_name: customer.first_name,
            customer_last_name: customer.last_name,
            customer_phone: customer.phone,
            customer_email: customer.email || null,
            items: items,
            subtotal: totals.subtotal,
            delivery_cost: delivery.cost,
            total: totals.total,
            delivery_method: delivery.method,
            delivery_address: delivery.address,
            customer_telegram: customer.telegram || null,
            customer_birthday: customer.birthday || null,
            order_status: 'pending',
            payment_status: payment?.status || 'pending',
            bank_account_id: payment?.bank_account_id || null,
            paid_at: (payment?.status === 'paid' || payment?.status === 'partial') ? new Date().toISOString() : null,
            fiscal_status: 'pending',
            notes: orderNotes.trim(),
            source: source || 'manual'
        };

        const { data: order, error: orderErr } = await supabase
            .from('orders')
            .insert(newOrderData)
            .select()
            .single();

        if (orderErr) throw orderErr;

        // 4b. Update bank account balance if payment received
        if (payment?.bank_account_id && payment?.paid_amount > 0) {
            try {
                await supabase.rpc('increment_bank_balance', {
                    account_id: payment.bank_account_id,
                    amount: payment.paid_amount
                });
            } catch {}
            // Fallback: manual update if RPC not available
            try {
                const { data: acc } = await supabase.from('bank_accounts').select('balance').eq('id', payment.bank_account_id).single();
                if (acc) {
                    await supabase.from('bank_accounts').update({ balance: (acc.balance || 0) + payment.paid_amount }).eq('id', payment.bank_account_id);
                }
            } catch {}
        }

        // 5. Trigger Order Placed Email
        try {
            const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
            await fetch(`${siteUrl}/api/email/transactional`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'placed', orderId: order.id })
            });
            console.log(`[Manual Order] Triggered Order Placed email for ${order.id}`);
        } catch (emailErr) {
            console.error('[Manual Order] Failed to trigger email:', emailErr);
        }

        return NextResponse.json({ success: true, id: order.id, order_number: order.order_number });

    } catch (err: any) {
        console.error('Error creating manual order:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
