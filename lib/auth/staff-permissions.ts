import { getAdminClient } from '@/lib/supabase/admin';
import { mergeRolePermissions, type PermissionLevel } from '@/lib/auth/permissions';

/**
 * Хто цей співробітник і що йому дозволено.
 *
 * Читає staff і admin_roles сервісним клієнтом — обидві таблиці закриті
 * політикою is_admin_user(), тож із браузера цього не порахувати. Функція
 * приймає email, а не бере сесію сама: так вона не залежить від lib/auth/
 * guards і guards може її імпортувати без кільцевої залежності.
 *
 * Правила ті самі, що діяли в меню адмінки, просто тепер вони живуть в
 * одному місці й доступні ще й серверним роутам:
 *   • роль дає базову мапу дозволів;
 *   • індивідуальні права співробітника перекривають її зверху;
 *   • role admin і owner, а також роль зі slug admin чи owner — суперадміни;
 *   • людина без рядка в staff — це власник доступу з admin_users без картки
 *     співробітника, теж суперадмін;
 *   • співробітник без ролі й без індивідуальних прав лишається суперадміном,
 *     інакше він опинився б замкненим у порожній адмінці.
 */
export interface StaffPermissions {
    isAdmin: boolean;
    permissions: Record<string, PermissionLevel>;
    role: string | null;
}

const SUPER: StaffPermissions = { isAdmin: true, permissions: {}, role: null };

export async function resolveStaffPermissions(email: string | null | undefined): Promise<StaffPermissions> {
    if (!email) return SUPER;

    const admin = getAdminClient();
    const { data: staff } = await admin
        .from('staff')
        .select('role, role_id, individual_permissions')
        .ilike('email', email.replace(/[%_\\]/g, m => `\\${m}`))
        .maybeSingle();

    if (!staff) return SUPER;

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

    const permissions = mergeRolePermissions(
        rolePermissions,
        staff.individual_permissions as Record<string, unknown> | null,
    );

    if (!isAdmin && Object.keys(permissions).length === 0) {
        return { ...SUPER, role: staff.role || null };
    }

    return { isAdmin, permissions, role: staff.role || null };
}
