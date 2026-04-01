import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const NOVA_POSHTA_API_URL = 'https://api.novaposhta.ua/v2.0/json/';

// Status mapping from Nova Poshta to internal statuses
const NP_STATUS_MAP: Record<string, string> = {
    '1': 'Нове',
    '2': 'Вилучено',
    '3': 'У дорозі',
    '4': 'Прибув у місто',
    '5': 'Прибув на відділення',
    '6': 'Прибув на відділення (одержувач)',
    '7': 'Одержано',
    '8': 'Вручено',
    '9': 'Вручено',
    '10': 'Створено',
    '11': 'Повернення',
    '101': 'Вручено',
    '102': 'Відмова від одержання',
    '103': 'Відмова від одержання (повернення)',
    '106': 'Вручено',
    '111': 'Вручено (частково)',
};

// Order status mapping
const ORDER_STATUS_MAP: Record<string, string> = {
    'shipped': 'В дорозі',
    'arriving_city': 'Прибув у місто',
    'at_warehouse': 'На відділенні',
    'delivered': 'Виконано',
};

export async function GET(req: NextRequest) {
    try {
        // Verify cron secret for security (Vercel Cron)
        const authHeader = req.headers.get('authorization');
        if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
        const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        const apiKey = process.env.NOVA_POSHTA_API_KEY;
        if (!apiKey) {
            return NextResponse.json({ error: 'Nova Poshta API key not configured' }, { status: 500 });
        }

        // Get all orders with tracking numbers that aren't delivered or cancelled
        const { data: orders, error } = await supabase
            .from('orders')
            .select('id, tracking_number, order_status, delivery_status, customer_phone, customer_name')
            .not('tracking_number', 'is', null)
            .not('order_status', 'in', '("delivered","cancelled")');

        if (error) {
            console.error('Error fetching orders:', error);
            return NextResponse.json({ error: 'Failed to fetch orders' }, { status: 500 });
        }

        if (!orders || orders.length === 0) {
            return NextResponse.json({ message: 'No orders to track', updated: 0 });
        }

        console.log(`[Nova Poshta Sync] Processing ${orders.length} orders...`);

        let updatedCount = 0;
        const results: any[] = [];

        for (const order of orders) {
            try {
                // Call Nova Poshta API to get document status
                const npResponse = await fetch(NOVA_POSHTA_API_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        apiKey,
                        modelName: 'TrackingDocument',
                        calledMethod: 'getStatusDocuments',
                        methodProperties: {
                            Documents: [
                                { DocumentNumber: order.tracking_number }
                            ]
                        }
                    })
                });

                const npData = await npResponse.json();

                if (!npData.success || !npData.data || npData.data.length === 0) {
                    console.log(`[NP] No data for TTN ${order.tracking_number}`);
                    continue;
                }

                const trackingInfo = npData.data[0];
                const statusCode = trackingInfo.StatusCode;
                const npStatus = NP_STATUS_MAP[statusCode] || 'Невідомо';
                const previousDeliveryStatus = order.delivery_status;

                let newOrderStatus = order.order_status;
                let shouldSendSMS = false;
                let smsMessage = '';

                // Map NP statuses to order statuses and trigger SMS
                if (statusCode === '3') {
                    // "У дорозі"
                    if (order.order_status === 'shipped' && order.delivery_status !== 'В дорозі') {
                        newOrderStatus = 'shipped';
                        shouldSendSMS = false; // Already notified when shipped
                    }
                } else if (statusCode === '4') {
                    // "Прибув у місто"
                    if (order.delivery_status !== 'Прибув у місто') {
                        shouldSendSMS = true;
                        smsMessage = `${order.customer_name || 'Шановний клієнте'}, ваше замовлення прибуло у ваше місто! Очікуйте повідомлення про прибуття на відділення. TouchMemories`;
                    }
                } else if (statusCode === '5' || statusCode === '6') {
                    // "Прибув на відділення"
                    if (order.delivery_status !== 'Прибув на відділення') {
                        shouldSendSMS = true;
                        smsMessage = `${order.customer_name || 'Шановний клієнте'}, ваше замовлення чекає на відділенні Нової Пошти! ТТН: ${order.tracking_number}. TouchMemories`;
                    }
                } else if (statusCode === '7' || statusCode === '8' || statusCode === '9' || statusCode === '101' || statusCode === '106') {
                    // "Вручено"
                    if (order.order_status !== 'delivered') {
                        newOrderStatus = 'delivered';

                        // TODO: Schedule review request SMS for 3 days later
                        // This could be done via automation_rules or a separate cron job
                        console.log(`[NP] Order ${order.id} delivered - should trigger review request in 3 days`);
                    }
                }

                // Update database
                await supabase
                    .from('orders')
                    .update({
                        delivery_status: npStatus,
                        order_status: newOrderStatus,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', order.id);

                // Send SMS if needed
                if (shouldSendSMS && smsMessage && order.customer_phone) {
                    try {
                        // TODO: Integrate with TurboSMS API
                        // For now, log the SMS
                        console.log(`[SMS] To ${order.customer_phone}: ${smsMessage}`);

                        // Placeholder for actual SMS sending
                        // await sendSMS(order.customer_phone, smsMessage);
                    } catch (smsError) {
                        console.error(`[SMS Error] Failed to send SMS for order ${order.id}:`, smsError);
                    }
                }

                updatedCount++;
                results.push({
                    orderId: order.id,
                    ttn: order.tracking_number,
                    previousStatus: previousDeliveryStatus,
                    newStatus: npStatus,
                    orderStatus: newOrderStatus,
                    smsSent: shouldSendSMS
                });

                console.log(`[NP] Updated order ${order.id}: ${previousDeliveryStatus} → ${npStatus}`);

                // Rate limiting - wait 100ms between requests to avoid hitting NP API limits
                await new Promise(resolve => setTimeout(resolve, 100));

            } catch (orderError) {
                console.error(`Error processing order ${order.id}:`, orderError);
                results.push({
                    orderId: order.id,
                    error: orderError instanceof Error ? orderError.message : 'Unknown error'
                });
            }
        }

        console.log(`[Nova Poshta Sync] Complete. Updated ${updatedCount}/${orders.length} orders.`);

        return NextResponse.json({
            success: true,
            message: `Sync complete. Updated ${updatedCount}/${orders.length} orders.`,
            updated: updatedCount,
            total: orders.length,
            results
        });

    } catch (error) {
        console.error('[Nova Poshta Sync] Fatal error:', error);
        return NextResponse.json({
            error: 'Internal server error',
            message: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}

// Also support POST for manual triggers
export async function POST(req: NextRequest) {
    return GET(req);
}
