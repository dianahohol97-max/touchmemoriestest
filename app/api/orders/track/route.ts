import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Simple in-memory rate limiting
const rateLimitMap = new Map<string, { count: number, resetAt: number }>();

export async function POST(req: Request) {
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
            .eq('order_number', orderNumber.toUpperCase())
            .or(`customer_email.eq.${contact},customer_phone.eq.${contact}`)
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
