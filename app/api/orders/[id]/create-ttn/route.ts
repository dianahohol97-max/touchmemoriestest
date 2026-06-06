import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/auth/guards';
import { getRuntimeBaseUrl } from '@/lib/runtimeUrl';

export const dynamic = 'force-dynamic';

const NP_API_URL = 'https://api.novaposhta.ua/v2.0/json/';

const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function npCall(apiKey: string, modelName: string, calledMethod: string, methodProperties: Record<string, any>) {
    const r = await fetch(NP_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey, modelName, calledMethod, methodProperties }),
    });
    return r.json();
}

// Resolve every sender ref Nova Poshta needs for InternetDocument.save from the
// API key plus human-readable hints (city name + warehouse number). The sender
// counterparty and contact person come from the key's own account; city and
// warehouse are looked up by name/number unless already a GUID.
async function resolveSender(apiKey: string, cityHint?: string, warehouseHint?: string, phoneHint?: string) {
    const cp = await npCall(apiKey, 'Counterparty', 'getCounterparties', { CounterpartyProperty: 'Sender', Page: '1' });
    const counterpartyRef: string | undefined = cp?.data?.[0]?.Ref;

    let contactRef: string | undefined;
    let contactPhone: string | undefined;
    if (counterpartyRef) {
        const cps = await npCall(apiKey, 'Counterparty', 'getCounterpartyContactPersons', { Ref: counterpartyRef, Page: '1' });
        contactRef = cps?.data?.[0]?.Ref;
        contactPhone = cps?.data?.[0]?.Phones;
    }

    let cityRef: string | undefined = cityHint && GUID.test(cityHint) ? cityHint : undefined;
    if (!cityRef && cityHint) {
        const c = await npCall(apiKey, 'Address', 'getCities', { FindByString: cityHint });
        cityRef = c?.data?.[0]?.Ref;
    }

    let warehouseRef: string | undefined = warehouseHint && GUID.test(warehouseHint) ? warehouseHint : undefined;
    if (!warehouseRef && warehouseHint && cityRef) {
        const num = String(warehouseHint).replace(/\D/g, '');
        const w = await npCall(apiKey, 'Address', 'getWarehouses', { CityRef: cityRef });
        const list: any[] = w?.data || [];
        const hit = list.find(x => String(x.Number) === num) || list.find(x => (x.Description || '').includes(`№${num}`));
        warehouseRef = hit?.Ref;
    }

    return { counterpartyRef, contactRef, cityRef, warehouseRef, phone: phoneHint || contactPhone };
}

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

        // Resolve Nova Poshta credentials from the configured account
        // (Admin → Доставка → Нова Пошта → np_accounts), falling back to env.
        const { data: npAcc } = await supabase
            .from('np_accounts')
            .select('*')
            .eq('is_active', true)
            .order('is_default', { ascending: false })
            .order('created_at', { ascending: true })
            .limit(1)
            .maybeSingle();

        const npApiKey = npAcc?.api_key || process.env.NOVA_POSHTA_API_KEY;
        const cityHint = npAcc?.sender_city_ref || process.env.NP_SENDER_CITY_REF;
        const warehouseHint = npAcc?.sender_warehouse_ref || process.env.NP_SENDER_WAREHOUSE_REF;
        const phoneHint = npAcc?.sender_phone || process.env.NP_SENDER_PHONE;

        if (!npApiKey) {
            return NextResponse.json({
                error: 'Нова Пошта не налаштована: немає API-ключа (Адмінка → Доставка → Нова Пошта).'
            }, { status: 400 });
        }

        // Resolve every sender ref NP needs from the key + city/warehouse hints.
        const sender = await resolveSender(npApiKey, cityHint, warehouseHint, phoneHint);
        const missing: string[] = [];
        if (!sender.counterpartyRef) missing.push('відправник-контрагент');
        if (!sender.contactRef) missing.push('контактна особа');
        if (!sender.cityRef) missing.push('місто відправника');
        if (!sender.warehouseRef) missing.push('відділення відправника');
        if (!sender.phone) missing.push('телефон відправника');
        if (missing.length) {
            return NextResponse.json({
                error: `Нова Пошта: не вдалося визначити дані відправника (${missing.join(', ')}). Перевірте місто/відділення відправника та телефон в Адмінка → Доставка → Нова Пошта.`
            }, { status: 400 });
        }

        // 2. Call Nova Poshta API to create TTN
        const npPayload = {
            apiKey: npApiKey,
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
                // Sender details (resolved from np_accounts hints + NP account)
                CitySender: sender.cityRef,
                Sender: sender.counterpartyRef,
                SenderAddress: sender.warehouseRef,
                ContactSender: sender.contactRef,
                SendersPhone: (sender.phone || '').replace(/\D/g, ''),
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

        // 4. Send shipping notification email — fire-and-forget so a Brevo
        // hiccup never fails the TTN creation. Only on the first TTN (guard on
        // the pre-update value) to avoid re-sending if the action is re-run.
        if (!order.ttn && order.customer_email) {
            const baseUrl = getRuntimeBaseUrl();
            fetch(`${baseUrl}/api/email/transactional`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-cron-secret': process.env.CRON_SECRET || '',
                },
                body: JSON.stringify({ action: 'shipped', orderId }),
            }).catch(err => {
                console.error('shipped email trigger failed:', err);
            });
        }
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
