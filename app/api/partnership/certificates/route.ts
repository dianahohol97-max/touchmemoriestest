import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

/**
 * POST /api/partnership/certificates  { token, nominal, qty }
 *
 * Partner-cabinet purchase of travelbook gift certificates at the partner
 * discount (−10%). Creates a regular order for the partner (customer =
 * agency), one certificate line item per certificate, priced at 90% of the
 * nominal; the client then pays it through the normal Monobank invoice flow
 * (create-invoice + webhook). On payment the existing certificates/on-payment
 * route auto-issues the certificates and emails them to the partner — the
 * whole chain is reused, nothing bespoke to maintain.
 *
 * The certificate itself keeps its FULL nominal value (the discount is the
 * partner's wholesale margin) and is the product type: «сертифікат на
 * тревелбук», valid 3 months — exactly the terms on the /travel-agencies page.
 */
const PARTNER_CERT_DISCOUNT = 0.10;
// Travelbook price points — a certificate maps to a book size the client picks.
const ALLOWED_NOMINALS = [675, 825, 975, 1125, 1425, 1725, 2025, 2350, 2900];
const MAX_QTY = 20;
const TOKEN_RE = /^[a-z0-9-]{16,}$/i;

export async function POST(request: Request) {
    const body = await request.json().catch(() => ({}));
    const token = String(body?.token || '');
    const nominal = Number(body?.nominal);
    const qty = Math.floor(Number(body?.qty));

    if (!TOKEN_RE.test(token)) {
        return NextResponse.json({ error: 'Невірне посилання кабінету' }, { status: 400 });
    }
    if (!ALLOWED_NOMINALS.includes(nominal)) {
        return NextResponse.json({ error: 'Невірний номінал сертифіката' }, { status: 400 });
    }
    if (!Number.isFinite(qty) || qty < 1 || qty > MAX_QTY) {
        return NextResponse.json({ error: `Кількість — від 1 до ${MAX_QTY}` }, { status: 400 });
    }

    const admin = getAdminClient();
    const { data: partner } = await admin
        .from('agency_partners')
        .select('id, agency_name, contact_name, email, referral_code, status')
        .eq('cabinet_token', token)
        .maybeSingle();
    if (!partner || partner.status !== 'active') {
        return NextResponse.json({ error: 'Партнера не знайдено або деактивовано' }, { status: 404 });
    }

    // Server-side pricing only — the client sends intent, never prices.
    const unit = Math.round(nominal * (1 - PARTNER_CERT_DISCOUNT) * 100) / 100;
    const total = Math.round(unit * qty * 100) / 100;

    // One item per certificate: certificates/on-payment issues one cert per
    // qualifying line item, so qty × nominal → qty separate certificates.
    const items = Array.from({ length: qty }, (_, i) => ({
        product_name: `Подарунковий сертифікат на Travel Book ${nominal} ₴ (партнерська ціна −10%)`,
        product_type: 'product',
        quantity: 1,
        unit_price: unit,
        total_price: unit,
        options: { 'Номінал': `${nominal} ₴`, 'Формат': 'Електронний', '№': `${i + 1}/${qty}` },
        metadata: {
            certificateType: 'product',
            productName: 'Travel Book',
            amount: nominal,
            format: 'electronic',
            recipientName: partner.agency_name,
            recipientEmail: partner.email,
        },
    }));

    const { data: order, error } = await admin
        .from('orders')
        .insert({
            customer_name: partner.agency_name,
            customer_email: partner.email,
            items,
            subtotal: total,
            delivery_cost: 0,
            total,
            delivery_method: 'email',
            payment_type: 'full',
            source: 'partner_certificates',
            notes:
                `Партнерське замовлення сертифікатів: ${qty} × ${nominal} ₴ зі знижкою 10% ` +
                `(партнер: ${partner.agency_name}, код ${partner.referral_code}). ` +
                `Сертифікати випускаються автоматично після оплати й надходять на ${partner.email}.`,
        })
        .select('id, order_number')
        .single();

    if (error || !order) {
        console.error('[partnership/certificates] order insert failed', error?.message);
        return NextResponse.json({ error: 'Не вдалося створити замовлення' }, { status: 500 });
    }

    return NextResponse.json({
        ok: true,
        orderId: order.id,
        orderNumber: order.order_number,
        total,
        perCertificate: unit,
    });
}
