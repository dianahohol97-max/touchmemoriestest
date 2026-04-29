import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/auth/guards';

export const dynamic = 'force-dynamic';

const NP_API_URL = 'https://api.novaposhta.ua/v2.0/json/';

export async function POST(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const guard = await requireAdmin();
    if (!guard.ok) return guard.response;

    const supabase = getAdminClient();
    try {
        const { id: orderId } = await params;

        // 1. Get order details from Supabase
        const { data: order, error: orderError } = await supabase
            .from('orders')
            .select('*')
            .eq('id', orderId)
            .single();

        if (orderError || !order) {
            return NextResponse.json({ error: 'Order not found' }, { status: 404 });
        }

        // 2. Call Nova Poshta API to create TTN
        const npPayload = {
            apiKey: process.env.NOVA_POSHTA_API_KEY,
            modelName: 'InternetDocument',
            calledMethod: 'save',
            methodProperties: {
                PayerType: 'Recipient',
                PaymentMethod: 'Cash',
                CargoType: 'Parcel',
                Weight: '0.5',
                ServiceType: order.delivery_address?.method === 'Адресна доставка' ? 'WarehouseDoors' : 'WarehouseWarehouse',
                SeatsAmount: '1',
                Description: 'Фотокнига',
                Cost: order.total.toString(),
                // Sender details (Placeholders for user to fill in .env)
                CitySender: process.env.NP_SENDER_CITY_REF || '[your city ref]',
                SenderAddress: process.env.NP_SENDER_WAREHOUSE_REF || '[your warehouse ref]',
                ContactSender: process.env.NP_SENDER_NAME || '[your name]',
                SendersPhone: process.env.NP_SENDER_PHONE || '[your phone]',
                // Recipient details from order
                CityRecipient: order.delivery_address?.city_ref || '[customer city ref]',
                RecipientAddress: order.delivery_address?.warehouse_ref || order.delivery_address?.street_ref || '[customer warehouse or address ref]',
                ContactRecipient: order.customer_name,
                RecipientsPhone: order.customer_phone.replace('+', '')
            }
        };

        const npResponse = await fetch(NP_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(npPayload)
        });

        const npData = await npResponse.json();

        if (!npData.success) {
            return NextResponse.json({
                error: 'Nova Poshta API Error',
                details: npData.errors
            }, { status: 400 });
        }

        const ttn = npData.data[0].IntDocNumber;

        // 3. Save TTN number to order and update status
        const { error: updateError } = await supabase
            .from('orders')
            .update({
                ttn: ttn,
                order_status: 'shipped'
            })
            .eq('id', orderId);

        if (updateError) throw updateError;

        // 4. TODO: Send shipping notification email to customer
        console.log(`Order ${order.order_number} marked as shipped with TTN: ${ttn}`);

        return NextResponse.json({
            success: true,
            ttn: ttn,
            trackingUrl: `https://novaposhta.ua/tracking/?cargo_number=${ttn}`
        });

    } catch (error: any) {
        console.error('NP TTN Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
