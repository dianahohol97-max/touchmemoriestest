import { NextRequest, NextResponse } from 'next/server';
import { requireStaff } from '@/lib/auth/guards';
import { getAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

/** Приватні кошики, які адмінка має право показувати співробітнику. */
const ALLOWED_BUCKETS = new Set(['order-files']);

/**
 * GET /api/admin/storage-signed-url?bucket=order-files&path=... — підписане
 * посилання на один файл замовлення.
 *
 * Картка підписувала такі посилання прямо з браузера. Політики на
 * storage.objects для order-files дають читання лише власнику теки або
 * is_admin(), тобто знову «email є в admin_users». Для менеджера чи дизайнера
 * підпис не видавався, і фото на обкладинку в брифі показувалось порожнім
 * прямокутником без жодного пояснення.
 *
 * Кошик перевіряється за білим списком, а шлях — на спроби вийти вгору. Доступ
 * до файлів замовлень у співробітника й так є через картку та кабінет
 * дизайнера, тож роут нічого нового не відкриває — лише перестає залежати від
 * того, чи потрапила людина в admin_users.
 */
export async function GET(req: NextRequest) {
    const guard = await requireStaff();
    if (!guard.ok) return guard.response;

    const bucket = req.nextUrl.searchParams.get('bucket') || 'order-files';
    const path = req.nextUrl.searchParams.get('path') || '';

    if (!ALLOWED_BUCKETS.has(bucket)) {
        return NextResponse.json({ error: 'Unsupported bucket' }, { status: 400 });
    }
    if (!path || path.startsWith('/') || path.includes('..')) {
        return NextResponse.json({ error: 'Invalid path' }, { status: 400 });
    }

    const admin = getAdminClient();
    const { data, error } = await admin.storage.from(bucket).createSignedUrl(path, 60 * 60);
    if (error || !data?.signedUrl) {
        return NextResponse.json({ error: error?.message || 'Not found' }, { status: 404 });
    }
    return NextResponse.json({ url: data.signedUrl });
}
