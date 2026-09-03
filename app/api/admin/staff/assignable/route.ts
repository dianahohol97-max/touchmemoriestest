import { NextResponse } from 'next/server';
import { requireSection } from '@/lib/auth/guards';
import { getAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/staff/assignable — список активних співробітників для
 * випадайок «Відповідальні» в картці замовлення.
 *
 * Картка читала таблицю staff напряму з браузера. Єдина RLS-політика на staff
 * — admin_all_staff з умовою is_admin_user(), тобто «email є в admin_users».
 * З чотирнадцяти активних співробітників туди входять четверо, і всім іншим
 * запит повертав нуль рядків без жодної помилки: у випадайках стояло саме
 * «Не призначено» і більше нічого, обрати не було кого. Дизайнерка бачила це
 * на підтвердженому TM-001257 і винесла в звіт як «менеджер і дизайнер не
 * призначені» — насправді призначити їх з того екрана було неможливо.
 *
 * Тому читаємо на сервері сервісним клієнтом під requireStaff — тим самим
 * рівнем доступу, що вже пускає людину на /admin. Віддаємо лише те, що
 * потрібно випадайці: жодних телефонів, ставок і персональних даних, які
 * менеджеру для призначення не потрібні.
 *
 * Окремо від /api/admin/staff: той роут заводить логіни та шле листи з
 * тимчасовими паролями, і має лишитись під requireAdmin.
 */
export async function GET() {
    const guard = await requireSection('orders', 'view');
    if (!guard.ok) return guard.response;

    const admin = getAdminClient();
    const { data, error } = await admin
        .from('staff')
        .select('id, name, role, color, initials')
        .eq('is_active', true)
        .order('name', { ascending: true });

    if (error) {
        console.error('[staff/assignable] read failed', error.message);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json(data || []);
}
