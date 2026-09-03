import { NextResponse } from 'next/server';
import { requireStaff, getSession } from '@/lib/auth/guards';
import { getAdminClient } from '@/lib/supabase/admin';
import { likeEscape } from '@/lib/supabase/like-escape';
import { mergeRolePermissions, type PermissionLevel } from '@/lib/auth/permissions';

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
    const email = user?.email;
    if (!email) {
        return NextResponse.json({ isAdmin: true, permissions: {}, role: null });
    }

    const admin = getAdminClient();
    const { data: staff } = await admin
        .from('staff')
        .select('role, role_id, individual_permissions')
        .ilike('email', likeEscape(email))
        .maybeSingle();

    // Немає рядка в staff — значить це людина з admin_users без картки
    // співробітника. Так було й раніше, і так має лишитись.
    if (!staff) {
        return NextResponse.json({ isAdmin: true, permissions: {}, role: null });
    }

    let isAdmin = staff.role === 'admin' || staff.role === 'owner';
    let rolePermissions: Record<string, unknown> | null = null;

    if (staff.role_id) {
        const { data: role } = await admin
            .from('admin_roles')
            .select('permissions, slug')
            .eq('id', staff.role_id)
            .maybeSingle();
        if (role) {
            rolePermissions = (role.permissions || {}) as Record<string, unknown>;
            if (role.slug === 'owner' || role.slug === 'admin') isAdmin = true;
        }
    }

    const merged: Record<string, PermissionLevel> = mergeRolePermissions(
        rolePermissions,
        staff.individual_permissions as Record<string, unknown> | null,
    );

    if (!isAdmin && Object.keys(merged).length === 0) {
        // Ні ролі, ні індивідуальних прав — не замикаємо людину в порожній
        // адмінці, лишаємо як було до цього коміту.
        return NextResponse.json({ isAdmin: true, permissions: {}, role: staff.role || null });
    }

    return NextResponse.json({ isAdmin, permissions: merged, role: staff.role || null });
}
