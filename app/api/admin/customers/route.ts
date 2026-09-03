import { NextResponse } from 'next/server';
import { requireStaff } from '@/lib/auth/guards';
import { getAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/customers — база покупців для розділу «Клієнти».
 *
 * Сторінка читала customers прямо з браузера. Політики на таблиці дають
 * читання власного рядка або is_admin(), тобто «email є в admin_users», а
 * туди входять четверо з чотирнадцяти активних співробітників. Для решти
 * список повертався порожнім, і розділ показував нуль клієнтів і нуль
 * виручки — при тому, що менеджеру за роллю customers виставлені як full.
 *
 * Віддаємо ті самі поля, що й раніше: сторінка малює суми, дати й контакти, і
 * звужувати перелік тут означало б тихо зламати колонки.
 */
export async function GET() {
    const guard = await requireStaff();
    if (!guard.ok) return guard.response;

    const admin = getAdminClient();
    const { data, error } = await admin
        .from('customers')
        .select('*')
        .order('total_spent', { ascending: false });

    if (error) {
        console.error('[admin/customers] read failed', error.message);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ customers: data || [] });
}
