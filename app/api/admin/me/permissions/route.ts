import { NextResponse } from 'next/server';
import { requireStaff, getSession } from '@/lib/auth/guards';
import { resolveStaffPermissions } from '@/lib/auth/staff-permissions';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/me/permissions — права поточного співробітника для меню
 * адмінки.
 *
 * Раніше це рахувалось у браузері: сесія, потім запит у staff за своїм email,
 * потім у admin_roles за role_id. Обидві таблиці закриті політикою
 * is_admin_user(), тобто «email є в admin_users», а туди входять четверо з
 * чотирнадцяти активних співробітників. Решті запит повертав null, і код
 * інтерпретував це найгіршим можливим чином: гілка «рядка в staff немає»
 * вважала людину суперадміном і відкривала все меню.
 *
 * Тобто рольова модель не просто не працювала — вона давала повний доступ
 * саме тим, кого не змогла впізнати. Менеджер бачив фінанси й налаштування,
 * дизайнер бачив усе те саме, хоча в admin_roles обом ці розділи виставлені
 * як none. Ролі при цьому налаштовані охайно: пʼять ролей, у кожній ті самі
 * десять розділів.
 *
 * Тут те саме рахується на сервері сервісним клієнтом під requireStaff, тож
 * права нарешті резолвляться. Логіка злиття лишилась незмінною: роль дає
 * базову мапу, індивідуальні права перекривають її зверху, admin і owner
 * лишаються суперадмінами.
 *
 * Запобіжник: якщо у співробітника не виявилось ні ролі, ні індивідуальних
 * прав, він лишається суперадміном, як і був. Порожня мапа означала б людину,
 * яку не пускає в жоден розділ, а це гірше за зайвий пункт меню — таке
 * прибирається в /admin/roles свідомо, а не побічним ефектом цього коміту.
 */
export async function GET() {
    const guard = await requireStaff();
    if (!guard.ok) return guard.response;

    const { user } = await getSession();
    const resolved = await resolveStaffPermissions(user?.email);
    return NextResponse.json(resolved);
}
