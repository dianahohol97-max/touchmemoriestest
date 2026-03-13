import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

const MONO_API = 'https://api.monobank.ua/api/merchant/invoice/create';
const MONO_TOKEN = process.env.MONOBANK_API_TOKEN;
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

export async function POST(req: Request) {
    const supabase = getAdminClient();
    try {
        const { customer, items, delivery, total, subtotal, discount, promo_id, referral_code_id, used_bonus, customer_id } = await req.json();

        // 0. Process Bonus Balance usage if applicable
        if (used_bonus && used_bonus > 0 && customer_id) {
            const { data: customerData, error: custErr } = await supabase
                .from('customers')
                .select('bonus_balance')
                .eq('id', customer_id)
                .single();

            if (custErr || !customerData || customerData.bonus_balance < used_bonus) {
                return NextResponse.json({ success: false, error: 'Недостатньо бонусів на балансі або помилка перевірки' }, { status: 400 });
            }

            // Deduct from balance
            await supabase
                .from('customers')
                .update({ bonus_balance: customerData.bonus_balance - used_bonus })
                .eq('id', customer_id);
        }

        // 1. Get next order number from Supabase sequence
        const { data: orderSeq, error: seqError } = await supabase
            .rpc('get_next_order_sequence');

        if (seqError) throw new Error('Помилка генерації номера замовлення');

        const year = new Date().getFullYear();
        const orderNumber = `PB-${year}-${String(orderSeq).padStart(5, '0')}`;

        // 2. Save Order to Supabase
        const { data: order, error: orderError } = await supabase
            .from('orders')
            .insert({
                order_number: orderNumber,
                customer_name: customer.name,
                customer_email: customer.email,
                customer_phone: customer.phone,
                items: items,
                subtotal: subtotal || total,
                total: total,
                delivery_method: delivery.method,
                delivery_address: delivery.info,
                order_status: 'pending',
                payment_status: 'pending',
                referral_code_id: referral_code_id || null,
                used_bonus: used_bonus || 0
            })
            .select()
            .single();

        if (orderError) throw new Error('Помилка збереження замовлення: ' + orderError.message);

        // 2.5 Log Promo Code Usage
        if (promo_id) {
            await supabase.from('promo_code_usages').insert({
                promo_code_id: promo_id,
                order_id: order.id,
                discount_amount: discount || 0
            });

            // Fetch and increment usage count manually
            const { data: promoData } = await supabase
                .from('promo_codes')
                .select('uses_count')
                .eq('id', promo_id)
                .single();

            if (promoData) {
                await supabase
                    .from('promo_codes')
                    .update({ uses_count: (promoData.uses_count || 0) + 1 })
                    .eq('id', promo_id);
            }
        }

        // 3. Create Monobank Invoice or bypass if total is 0
        if (total <= 0) {
            // Mark as paid immediately since it's fully covered by bonuses/promo
            await supabase
                .from('orders')
                .update({ payment_status: 'paid', order_status: 'confirmed', paid_at: new Date().toISOString() })
                .eq('id', order.id);

            // a.1 Reserve Stock for Non-Personalized Items
            try {
                await supabase.rpc('reserve_order_stock', { p_order_id: order.id });
            } catch (rpcErr) {
                console.error('Failed to reserve stock for 0-total order', order.id, rpcErr);
            }

            return NextResponse.json({ success: true, pageUrl: `/order/${order.id}/success`, orderId: order.id });
        }

        const monoPayload = {
            amount: Math.round(total * 100), // convert to kopecks
            ccy: 980, // UAH
            merchantPaymInfo: {
                reference: order.id,
                destination: `Замовлення №${orderNumber} — TouchMemories`,
                basketOrder: items.map((item: any) => ({
                    name: item.name,
                    qty: item.qty,
                    sum: Math.round(item.price * 100),
                    unit: 'шт.',
                    code: item.product_id
                }))
            },
            validity: 3600,
            redirectUrl: `${SITE_URL}/order/${order.id}/success`,
            webHookUrl: `${SITE_URL}/api/webhook/monobank`
        };

        const monoRes = await fetch(MONO_API, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Token': MONO_TOKEN!
            },
            body: JSON.stringify(monoPayload)
        });

        const monoData = await monoRes.json();

        if (!monoRes.ok || !monoData.pageUrl) {
            console.error('Monobank Error:', monoData);
            throw new Error('Помилка платіжної системи: ' + (monoData.errText || 'Невідома помилка'));
        }

        // 4. Update order with mono_invoice_id
        await supabase
            .from('orders')
            .update({ mono_invoice_id: monoData.invoiceId })
            .eq('id', order.id);

        return NextResponse.json({ success: true, pageUrl: monoData.pageUrl, orderId: order.id });

    } catch (error: any) {
        console.error('Checkout error:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
