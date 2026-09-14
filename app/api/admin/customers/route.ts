import { NextResponse } from 'next/server';
import { requireSection } from '@/lib/auth/guards';
import { getAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

/** Скільки рядків PostgREST віддає за один запит. Те саме число, що в /api/admin/clients. */
const PAGE = 1000;

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
    const guard = await requireSection('customers', 'view');
    if (!guard.ok) return guard.response;

    const admin = getAdminClient();

    // Сторінками, а не одним запитом. PostgREST віддає щонайбільше PAGE рядків
    // і робить це МОВЧКИ: помилки немає, просто приходить менше. Клієнтів 1280
    // (заміряно 14.09.2026), тож розділ показував 1000 і 280 людей не бачив
    // ніхто — а менеджер, який не знайшов клієнта в списку, заводить його
    // ще раз.
    const customers: any[] = [];
    for (let from = 0; ; from += PAGE) {
        const { data, error } = await admin
            .from('customers')
            .select('*')
            .order('total_spent', { ascending: false })
            .range(from, from + PAGE - 1);

        if (error) {
            console.error('[admin/customers] read failed', error.message);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }
        customers.push(...(data || []));
        if (!data || data.length < PAGE) break;
    }

    return NextResponse.json({ customers });
}
