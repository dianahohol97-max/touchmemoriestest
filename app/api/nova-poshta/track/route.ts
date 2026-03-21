import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

/**
 * Nova Poshta API v2.0 - Track Waybill
 * Documentation: https://developers.novaposhta.ua/view/model/a90d323c-8512-11ec-8ced-005056b2dbe1/method/a9828282-8512-11ec-8ced-005056b2dbe1
 */

const NOVA_POSHTA_API_URL = 'https://api.novaposhta.ua/v2.0/json/';

export async function POST(req: Request) {
    try {
        const { ttn, orderId } = await req.json();

        if (!ttn) {
            return NextResponse.json(
                { error: 'TTN number is required' },
                { status: 400 }
            );
        }

        const apiKey = process.env.NOVA_POSHTA_API_KEY;
        if (!apiKey) {
            return NextResponse.json(
                { error: 'Nova Poshta API key not configured' },
                { status: 500 }
            );
        }

        // Track TTN via Nova Poshta API
        const npResponse = await fetch(NOVA_POSHTA_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                apiKey: apiKey,
                modelName: 'TrackingDocument',
                calledMethod: 'getStatusDocuments',
                methodProperties: {
                    Documents: [
                        {
                            DocumentNumber: ttn,
                            Phone: '' // Опціонально
                        }
                    ]
                }
            })
        });

        const npData = await npResponse.json();

        if (!npData.success) {
            console.error('Nova Poshta tracking error:', npData);
            return NextResponse.json(
                {
                    error: 'Nova Poshta tracking error',
                    details: npData.errors || npData.errorCodes || 'Unknown error'
                },
                { status: 400 }
            );
        }

        const trackingInfo = npData.data[0];

        if (!trackingInfo) {
            return NextResponse.json(
                { error: 'Tracking information not found' },
                { status: 404 }
            );
        }

        // Map Nova Poshta status to order status
        const statusMapping: Record<number, string> = {
            1: 'new', // Нова
            2: 'new', // Видалена
            3: 'new', // Номер не знайдено
            4: 'shipped', // Не забрана
            5: 'shipped', // Отримано на відділенні
            6: 'shipped', // Відправлено з відділення
            7: 'shipped', // Прибула до міста одержувача
            8: 'shipped', // Прибула на відділення
            9: 'delivered', // Отримана
            10: 'shipped', // Створена, очікує відправлення
            11: 'shipped', // Відправлена
            12: 'new', // Відмова отримувача
            14: 'cancelled', // Відмова отримувача після прибуття
            101: 'shipped', // В місті відправника
            102: 'shipped', // Видалена
            103: 'shipped', // Зберігання на складі
            104: 'shipped', // Виз відстрочки
            105: 'shipped', // Очікує на зберігання на складі
            106: 'delivered' // Отримана (прийнята до перевезення)
        };

        const npStatusCode = parseInt(trackingInfo.StatusCode);
        const newOrderStatus = statusMapping[npStatusCode] || 'shipped';

        // Auto-update order status if delivered
        if (orderId && (npStatusCode === 9 || npStatusCode === 106)) {
            const supabase = getAdminClient();

            // Check current status
            const { data: order } = await supabase
                .from('orders')
                .select('order_status')
                .eq('id', orderId)
                .single();

            // Only update if not already delivered
            if (order && order.order_status !== 'delivered') {
                await supabase
                    .from('orders')
                    .update({
                        order_status: 'delivered',
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', orderId);

                // Log history
                await supabase.from('order_history').insert({
                    order_id: orderId,
                    action: 'status_changed',
                    notes: `Статус автоматично змінено на "Виконано" (отримано з Нової Пошти)`,
                    added_by: null
                });
            }
        }

        return NextResponse.json({
            success: true,
            tracking: {
                ttn: trackingInfo.Number,
                status: trackingInfo.Status,
                statusCode: npStatusCode,
                orderStatus: newOrderStatus,
                recipientDateTime: trackingInfo.RecipientDateTime,
                scheduledDeliveryDate: trackingInfo.ScheduledDeliveryDate,
                actualDeliveryDate: trackingInfo.ActualDeliveryDate,
                recipientFullName: trackingInfo.RecipientFullName,
                warehouseRecipient: trackingInfo.WarehouseRecipient,
                citySender: trackingInfo.CitySender,
                cityRecipient: trackingInfo.CityRecipient,
                estimatedDeliveryDate: trackingInfo.EstimatedDeliveryDate,
                weight: trackingInfo.DocumentWeight,
                cost: trackingInfo.DocumentCost,
                redeliverySum: trackingInfo.RedeliverySum,
                phoneRecipient: trackingInfo.PhoneRecipient
            }
        });

    } catch (error: any) {
        console.error('Tracking error:', error);
        return NextResponse.json(
            { error: error.message || 'Internal server error' },
            { status: 500 }
        );
    }
}
