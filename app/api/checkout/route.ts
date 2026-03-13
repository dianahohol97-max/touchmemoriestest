import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import fetch from 'node-fetch';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
    try {
        const { customer, delivery, items, total } = await req.json();

        // 1. Find or Create Customer
        let { data: dbCustomer } = await supabase
            .from('customers')
            .select('id')
            .eq('email', customer.email)
            .single();

        if (!dbCustomer) {
            const { data: newCustomer, error: custError } = await supabase
                .from('customers')
                .insert([{
                    email: customer.email,
                    name: customer.name,
                    phone: customer.phone,
                }])
                .select()
                .single();
            if (custError) throw custError;
            dbCustomer = newCustomer;
        }

        // 2. Generate Order Number
        const orderNumber = `PB-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

        // 3. Initiate Monobank Payment
        const monoResponse = await fetch('https://api.monobank.ua/api/merchant/invoice/create', {
            method: 'POST',
            headers: {
                'X-Token': process.env.MONOBANK_API_TOKEN!,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                amount: total * 100, // in kopecks
                ccy: 980,
                merchantPaymInfo: {
                    reference: orderNumber,
                    destination: `Оплата замовлення ${orderNumber}`,
                    basketOrder: items.map((i: any) => ({ name: i.name, qty: i.qty, sum: i.price * 100, unit: 'шт' }))
                },
                redirectUrl: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3001'}/order/success?order=${orderNumber}`,
                webHookUrl: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3001'}/api/webhooks/monobank`
            })
        });

        const monoData: any = await monoResponse.json();
        if (!monoResponse.ok) throw new Error(monoData.errText || 'Monobank API error');

        // 4. Create Order in DB
        const { error: orderError } = await supabase.from('orders').insert([{
            order_number: orderNumber,
            customer_id: dbCustomer?.id,
            customer_name: customer.name,
            customer_phone: customer.phone,
            customer_email: customer.email,
            items,
            subtotal: total,
            total,
            delivery_method: delivery.method,
            delivery_address: { city: delivery.city, warehouse: delivery.warehouse },
            mono_invoice_id: monoData.invoiceId,
            order_status: 'new',
            payment_status: 'pending'
        }]);

        if (orderError) throw orderError;

        return NextResponse.json({
            orderNumber,
            checkoutUrl: monoData.pageUrl
        });

    } catch (err: any) {
        console.error('Checkout error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
