import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

const MAX_BYTES = 12 * 1024 * 1024; // 12MB per photo
const ALLOWED = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];

/**
 * POST /api/babybook/upload  (multipart/form-data)
 *   fields: order_id, kind ('child' | 'character'), file
 * Returns the storage path to store in the brief.
 */
export async function POST(request: Request) {
    try {
        const form = await request.formData();
        const orderId = String(form.get('order_id') || '').trim();
        const kind = String(form.get('kind') || 'child');
        const file = form.get('file');

        if (!orderId) return NextResponse.json({ error: 'order_id required' }, { status: 400 });
        if (!(file instanceof File)) return NextResponse.json({ error: 'file required' }, { status: 400 });
        if (file.size > MAX_BYTES) return NextResponse.json({ error: 'Файл завеликий (макс 12MB)' }, { status: 400 });
        if (file.type && !ALLOWED.includes(file.type)) {
            return NextResponse.json({ error: 'Підтримуються JPG, PNG, WEBP, HEIC' }, { status: 400 });
        }

        const admin = getAdminClient();

        // Confirm the order exists (prevents arbitrary uploads to random ids).
        const { data: order } = await admin.from('orders').select('id').eq('id', orderId).maybeSingle();
        if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });

        const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
        const safeKind = kind === 'character' ? 'character' : 'child';
        const path = `babybook/${orderId}/${safeKind}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

        const { error: upErr } = await admin.storage
            .from('design-briefs')
            .upload(path, file, { contentType: file.type || 'image/jpeg', upsert: false });

        if (upErr) {
            console.error('babybook/upload error:', upErr);
            return NextResponse.json({ error: 'Не вдалося завантажити фото' }, { status: 500 });
        }

        return NextResponse.json({ ok: true, path });
    } catch (err: any) {
        console.error('babybook/upload error:', err);
        return NextResponse.json({ error: err?.message || 'Помилка' }, { status: 500 });
    }
}
