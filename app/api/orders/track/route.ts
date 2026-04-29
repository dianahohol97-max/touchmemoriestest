import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

// Simple in-memory rate limiting
const rateLimitMap = new Map<string, { count: number, resetAt: number }>();

export async function POST(req: Request) {
    const supabase = getAdminClient();
    const ip = req.headers.get('x-forwarded-for') || '127.0.0.1';
    const now = Date.now();

    // 1. Rate Limiting (10 requests per minute per IP)
    const limit = rateLimitMap.get(ip);
    if (limit) {
        if (now < limit.resetAt) {
            if (limit.count >= 10) {
                return NextResponse.json({ error: 'Забагато запитів. Спробуйте пізніше.' }, { status: 429 });
            }
            limit.count++;
        } else {
            rateLimitMap.set(ip, { count: 1, resetAt: now + 60000 });
        }
    } else {
        rateLimitMap.set(ip, { count: 1, resetAt: now + 60000 });
    }

    try {
        const { orderNumber, contact } = await req.json();

        if (!orderNumber || !contact) {
            return NextResponse.json({ error: 'Введіть номер замовлення та контактні дані' }, { status: 400 });
        }

        // Validate contact: must look like an email or a phone number.
        // Without this, a caller could pass `*,customer_email.like.*` and break
        // the PostgREST `or()` filter to retrieve any order with the given
        // order_number, regardless of who the customer is.
        const trimmedContact = String(contact).trim();
        const isEmail = /^[^\s@,()]+@[^\s@,()]+\.[^\s@,()]+$/.test(trimmedContact);
        const isPhone = /^\+?[0-9 ()\-]{6,20}$/.test(trimmedContact);
        if (!isEmail && !isPhone) {
            return NextResponse.json({ error: 'Невірний формат контактних даних' }, { status: 400 });
        }

        // Validate orderNumber to a strict alphanumeric/dash format too.
        const trimmedOrderNumber = String(orderNumber).trim().toUpperCase();
        if (!/^[A-Z0-9\-]{3,40}$/.test(trimmedOrderNumber)) {
            return NextResponse.json({ error: 'Невірний номер замовлення' }, { status: 400 });
        }

        // 2. Fetch Order with verification
        // Support either email or phone match
        const { data: order, error } = await supabase
            .from('orders')
            .select(`
                id, order_number, order_status, created_at, paid_at, 
                confirmed_at, production_at, shipped_at, delivered_at,
                ttn, items, total, delivery_method, delivery_address,
                customer_name, customer_email, customer_phone
            `)
            .eq('order_number', trimmedOrderNumber)
            .or(`customer_email.eq.${trimmedContact},customer_phone.eq.${trimmedContact}`)
            .single();

        if (error || !order) {
            return NextResponse.json({ error: 'Замовлення не знайдено або дані не співпадають' }, { status: 404 });
        }

        // 3. Return filtered data
        return NextResponse.json(order);

    } catch (e: any) {
        return NextResponse.json({ error: 'Помилка сервера' }, { status: 500 });
    }
}
