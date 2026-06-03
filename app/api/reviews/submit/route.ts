import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Public review submission. Always lands as status='pending' + is_active=false,
// so nothing is published until an admin approves it. Uses the service-role
// client (no broad anon insert policy is exposed). Minimal anti-spam: honeypot
// field + length caps + rating bounds.
export async function POST(req: Request) {
    try {
        const body = await req.json();

        // Honeypot: real users never fill this hidden field; bots do.
        if (body.website) return NextResponse.json({ ok: true });

        const author = String(body.author || '').trim().slice(0, 80);
        const text = String(body.text || '').trim().slice(0, 1000);
        const rating = Number(body.rating);
        const productId =
            typeof body.product_id === 'string' && UUID_RE.test(body.product_id) ? body.product_id : null;

        if (author.length < 2) return NextResponse.json({ error: "Вкажіть ім'я (мінімум 2 символи)" }, { status: 400 });
        if (text.length < 10) return NextResponse.json({ error: 'Відгук закороткий (мінімум 10 символів)' }, { status: 400 });
        if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
            return NextResponse.json({ error: 'Оцінка має бути від 1 до 5' }, { status: 400 });
        }

        const admin = getAdminClient();
        if (!admin) return NextResponse.json({ error: 'Server error' }, { status: 500 });

        const { error } = await admin.from('reviews').insert({
            author,
            caption: text,
            rating: Math.round(rating),
            product_id: productId,
            image_url: null,
            category: 'site',
            status: 'pending',
            is_active: false,
            sort_order: 0,
        });
        if (error) {
            console.error('review submit failed:', error);
            return NextResponse.json({ error: 'Не вдалося зберегти відгук' }, { status: 500 });
        }

        return NextResponse.json({ ok: true });
    } catch {
        return NextResponse.json({ error: 'Bad request' }, { status: 400 });
    }
}
