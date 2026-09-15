import { NextRequest, NextResponse } from 'next/server';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { isDomesticNovaPoshta } from '@/lib/shipping/carrier';

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

/**
 * Опитування Нової Пошти пачками, а не по одній посилці.
 *
 * `getStatusDocuments` приймає масив накладних, тож 394 замовлення у вікні
 * відстеження — це чотири запити, а не 394 запити з паузою по 100 мс між
 * ними. Стара форма циклу займала близько двох хвилин і не вкладалася в
 * ліміт часу серверної функції, тобто навіть із правильним ключем вона
 * впала б на пів дорозі.
 */
const NP_BATCH_SIZE = 100;

async function fetchTrackingBatch(apiKey: string, ttns: string[]): Promise<Map<string, any>> {
    const byTtn = new Map<string, any>();

    for (let i = 0; i < ttns.length; i += NP_BATCH_SIZE) {
        const chunk = ttns.slice(i, i + NP_BATCH_SIZE);
        try {
            const npResponse = await fetch(NOVA_POSHTA_API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    apiKey,
                    modelName: 'TrackingDocument',
                    calledMethod: 'getStatusDocuments',
                    methodProperties: { Documents: chunk.map(ttn => ({ DocumentNumber: ttn })) },
                }),
            });
            const npData = await npResponse.json();
            if (!npData.success || !Array.isArray(npData.data)) {
                console.error('[NP] Tracking batch failed:', npData.errors || npData.errorCodes || 'unknown error');
                continue;
            }
            for (const row of npData.data) {
                if (row?.Number) byTtn.set(String(row.Number), row);
            }
        } catch (batchError) {
            console.error('[NP] Tracking batch request failed:', batchError);
        }
    }

    return byTtn;
}

/**
 * Ключ Нової Пошти лежить в адмінці (Доставка → Нова Пошта, таблиця
 * np_accounts), а не у змінних оточення. Саме звідти його беруть проксі
 * кабінету, доставка в чекауті й створення накладної — усі троє з тим самим
 * порядком і тим самим запасним варіантом.
 *
 * Крон читав ТІЛЬКИ process.env.NOVA_POSHTA_API_KEY, якої на Vercel немає,
 * тож щодня падав із 500 при повністю налаштованому ключі в базі. Тепер
 * ключ шукається в одному місці з рештою маршрутів, а змінна оточення
 * лишається запасним варіантом для середовищ без бази.
 */
async function resolveNpApiKey(supabase: SupabaseClient): Promise<string | undefined> {
    try {
        const { data } = await supabase
            .from('np_accounts')
            .select('api_key')
            .eq('is_active', true)
            .order('is_default', { ascending: false })
            .order('created_at', { ascending: true })
            .limit(1)
            .maybeSingle();
        return data?.api_key || process.env.NOVA_POSHTA_API_KEY;
    } catch {
        return process.env.NOVA_POSHTA_API_KEY;
    }
}

// Опитування пачками плюс запис у базу по кожному замовленню — це хвилини, а
// не секунди, тож функції потрібен свій ліміт часу.
export const maxDuration = 300;

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

        const apiKey = await resolveNpApiKey(supabase);
        if (!apiKey) {
            // Мовчазне падіння коштувало нам усього трекінгу. Крон щодня
            // повертав 500 і не лишав у логах жодного рядка, тому ніхто не
            // бачив, що статуси посилок не оновлюються з самого початку:
            // станом на 14.09.2026 у базі 836 замовлень із ТТН і в жодного
            // немає tracking_status. Тепер причина написана в лозі прямо, і
            // в ній названі обидва місця, де ключ може бути.
            console.error('[NP] No Nova Poshta API key — neither an active np_accounts row nor NOVA_POSHTA_API_KEY');
            return NextResponse.json({ error: 'Nova Poshta API key not configured' }, { status: 500 });
        }

        // Посилка, якій більше трьох місяців, уже або вручена, або втрачена, і
        // домашній трекінг про неї нічого нового не скаже. Без цієї межі
        // список ріс вічно: замовлення без статусу ніколи не стає
        // «delivered», тож само з вибірки не виходить.
        const TRACKING_WINDOW_DAYS = 90;
        const windowStart = new Date(Date.now() - TRACKING_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();

        // Get all orders with tracking numbers that aren't delivered or cancelled
        const { data: candidates, error } = await supabase
            .from('orders')
            .select('id, ttn, order_status, tracking_status, tracking_status_at, tracking_carrier, customer_phone, customer_name')
            .not('ttn', 'is', null)
            .gte('created_at', windowStart)
            .not('order_status', 'in', '("delivered","cancelled")');

        if (error) {
            console.error('Error fetching orders:', error);
            return NextResponse.json({ error: 'Failed to fetch orders' }, { status: 500 });
        }

        // Питаємо домашній API лише про внутрішні відправлення Новою Поштою.
        // Раніше ознакою була порожнеча поля `tracking_carrier`, і ТТН, які
        // приїхали з KeyCRM із назвою служби «Нова Пошта», крон відкидав як
        // міжнародні. Правило тепер одне й дивиться на назву — lib/shipping/carrier.
        const orders = (candidates || []).filter(o => isDomesticNovaPoshta(o.tracking_carrier));

        if (orders.length === 0) {
            return NextResponse.json({ message: 'No orders to track', updated: 0 });
        }

        console.log(`[Nova Poshta Sync] Processing ${orders.length} of ${candidates?.length || 0} orders with a waybill...`);

        let updatedCount = 0;
        const results: any[] = [];

        const tracking = await fetchTrackingBatch(apiKey, orders.map(o => String(o.ttn)));

        for (const order of orders) {
            try {
                const trackingInfo = tracking.get(String(order.ttn));

                if (!trackingInfo) {
                    console.log(`[NP] No data for TTN ${order.ttn}`);
                    continue;
                }

                const statusCode = String(trackingInfo.StatusCode);
                const npStatus = NP_STATUS_MAP[statusCode] || 'Невідомо';
                const previousDeliveryStatus = order.tracking_status;

                let newOrderStatus = order.order_status;
                let shouldSendSMS = false;
                let smsMessage = '';

                // Map NP statuses to order statuses and trigger SMS
                if (statusCode === '3') {
                    // "У дорозі"
                    if (order.order_status === 'shipped' && order.tracking_status !== 'В дорозі') {
                        newOrderStatus = 'shipped';
                        shouldSendSMS = false; // Already notified when shipped
                    }
                } else if (statusCode === '4') {
                    // "Прибув у місто"
                    if (order.tracking_status !== 'Прибув у місто') {
                        shouldSendSMS = true;
                        smsMessage = `${order.customer_name || 'Шановний клієнте'}, ваше замовлення прибуло у ваше місто! Очікуйте повідомлення про прибуття на відділення. TouchMemories`;
                    }
                } else if (statusCode === '5' || statusCode === '6') {
                    // "Прибув на відділення"
                    if (order.tracking_status !== 'Прибув на відділення') {
                        shouldSendSMS = true;
                        smsMessage = `${order.customer_name || 'Шановний клієнте'}, ваше замовлення чекає на відділенні Нової Пошти! ТТН: ${order.ttn}. TouchMemories`;
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
                //
                // tracking_status_at пишемо ТІЛЬКИ при справжній зміні статусу.
                // Крон ходить щодня, тож оновлення щопрогону означало б, що
                // кожна посилка вічно має нуль днів у статусі, і зведення про
                // застряглі ніколи б нікого не показало. Порожнє поле теж
                // заповнюємо: це перша зустріч із цією посилкою.
                const statusChanged = previousDeliveryStatus !== npStatus || !order.tracking_status_at;
                await supabase
                    .from('orders')
                    .update({
                        tracking_status: npStatus,
                        order_status: newOrderStatus,
                        updated_at: new Date().toISOString(),
                        ...(statusChanged ? { tracking_status_at: new Date().toISOString() } : {}),
                        ...(newOrderStatus === 'delivered' && order.order_status !== 'delivered'
                            ? { delivered_at: new Date().toISOString() }
                            : {}),
                    })
                    .eq('id', order.id);

                // On the delivered transition, settle a 50/50 split order's
                // remainder (NP collected the rest) → postpayment receipt.
                // fire-and-forget + idempotent + gated (only split w/ prepayment).
                if (newOrderStatus === 'delivered' && order.order_status !== 'delivered') {
                    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
                    fetch(`${baseUrl}/api/fiscalize`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'x-cron-secret': process.env.CRON_SECRET || '' },
                        body: JSON.stringify({ orderId: order.id, stage: 'postpayment' }),
                    }).catch(err => console.error('[NP] postpayment fiscalize trigger failed:', err));
                }

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
                    ttn: order.ttn,
                    previousStatus: previousDeliveryStatus,
                    newStatus: npStatus,
                    orderStatus: newOrderStatus,
                    smsSent: shouldSendSMS
                });

                console.log(`[NP] Updated order ${order.id}: ${previousDeliveryStatus} → ${npStatus}`);

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
