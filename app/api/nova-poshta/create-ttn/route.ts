import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

/**
 * Nova Poshta API v2.0 - Create TTN (Waybill)
 * Documentation: https://developers.novaposhta.ua/view/model/a90d323c-8512-11ec-8ced-005056b2dbe1/method/a965630e-8512-11ec-8ced-005056b2dbe1
 */

const NOVA_POSHTA_API_URL = 'https://api.novaposhta.ua/v2.0/json/';

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const {
            orderId,
            recipientName,
            recipientPhone,
            recipientCity,
            recipientWarehouse,
            weight,
            declaredValue,
            paymentMethod,
            codAmount,
            description
        } = body;

        const apiKey = process.env.NOVA_POSHTA_API_KEY;
        if (!apiKey) {
            return NextResponse.json(
                { error: 'Nova Poshta API key not configured' },
                { status: 500 }
            );
        }

        // Determine payment control
        const paymentControl = paymentMethod === 'Післяплата' || paymentMethod === 'COD' ? codAmount : 0;

        // Create TTN via Nova Poshta API
        const npResponse = await fetch(NOVA_POSHTA_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                apiKey: apiKey,
                modelName: 'InternetDocument',
                calledMethod: 'save',
                methodProperties: {
                    PayerType: 'Sender', // Відправник платить за доставку
                    PaymentMethod: paymentControl > 0 ? 'Cash' : 'NonCash', // Післяплата або безготівка
                    DateTime: new Date().toISOString().split('T')[0], // Дата відправки
                    CargoType: 'Parcel', // Посилка
                    ServiceType: 'WarehouseWarehouse', // Склад-Склад
                    SeatsAmount: '1', // Кількість місць
                    Description: description || 'Фотокниги та фотовироби',
                    Cost: declaredValue.toString(), // Оголошена вартість
                    CitySender: process.env.NOVA_POSHTA_SENDER_CITY || '', // Місто відправника (з довідника)
                    Sender: process.env.NOVA_POSHTA_SENDER_REF || '', // Контрагент відправник (Ref)
                    SenderAddress: process.env.NOVA_POSHTA_SENDER_WAREHOUSE || '', // Відділення відправника
                    ContactSender: process.env.NOVA_POSHTA_SENDER_CONTACT || '', // Контактна особа відправника
                    SendersPhone: process.env.NOVA_POSHTA_SENDER_PHONE || '', // Телефон відправника
                    RecipientCityName: recipientCity, // Місто отримувача
                    RecipientArea: '', // Область (можна пусте)
                    RecipientAreaRegions: '', // Регіон
                    RecipientAddressName: recipientWarehouse, // Відділення отримувача
                    RecipientHouse: '', // Будинок (не потрібно для відділення)
                    RecipientFlat: '', // Квартира
                    RecipientName: recipientName, // ПІБ отримувача
                    RecipientType: 'PrivatePerson', // Приватна особа
                    RecipientsPhone: recipientPhone.replace(/\D/g, ''), // Телефон без символів
                    Weight: weight.toString(), // Вага в кг
                    VolumeGeneral: '', // Об'ємна вага (можна пусте)
                    BackwardDeliveryData: paymentControl > 0 ? [{
                        PayerType: 'Recipient',
                        CargoType: 'Money',
                        RedeliveryString: paymentControl.toString()
                    }] : [] // Зворотна доставка грошей (COD)
                }
            })
        });

        const npData = await npResponse.json();

        if (!npData.success) {
            console.error('Nova Poshta API error:', npData);
            return NextResponse.json(
                {
                    error: 'Nova Poshta API error',
                    details: npData.errors || npData.errorCodes || 'Unknown error'
                },
                { status: 400 }
            );
        }

        const ttn = npData.data[0]?.IntDocNumber;
        const ref = npData.data[0]?.Ref;

        if (!ttn) {
            return NextResponse.json(
                { error: 'TTN not generated' },
                { status: 500 }
            );
        }

        // Save TTN to order in Supabase
        const supabase = getAdminClient();
        const { error: updateError } = await supabase
            .from('orders')
            .update({
                tracking_number: ttn,
                ttn: ttn, // Legacy field
                np_waybill_ref: ref,
                updated_at: new Date().toISOString()
            })
            .eq('id', orderId);

        if (updateError) {
            console.error('Error saving TTN to database:', updateError);
            return NextResponse.json(
                { error: 'TTN created but failed to save to database', ttn },
                { status: 500 }
            );
        }

        // Log history
        await supabase.from('order_history').insert({
            order_id: orderId,
            action: 'ttn_created',
            notes: `Створено ТТН: ${ttn}`,
            added_by: null // TODO: Get from auth
        });

        return NextResponse.json({
            success: true,
            ttn,
            ref,
            trackingUrl: `https://novaposhta.ua/tracking/?cargo_number=${ttn}`
        });

    } catch (error: any) {
        console.error('TTN creation error:', error);
        return NextResponse.json(
            { error: error.message || 'Internal server error' },
            { status: 500 }
        );
    }
}
