import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { likeEscape } from '@/lib/supabase/like-escape';
import { resolveStaffPermissions } from '@/lib/auth/staff-permissions';
import { allows, type PermissionLevel } from '@/lib/auth/permissions';

/**
 * Auth guards for API routes.
 *
 * Use these at the top of every protected route — including any handler that
 * calls getAdminClient() and accepts user input (path params, body, query).
 *
 * `requireAdmin` returns the authenticated user's id if they are an admin
 * (or staff with role='admin'); otherwise it returns a 401/403 NextResponse
 * that the caller should `return` immediately.
 *
 * `requireAuth` returns the authenticated user's id if any session exists;
 * otherwise a 401 NextResponse to return.
 *
 * `requireOwnerOrAdmin` requires the user to either own a given resource
 * (caller passes in the customer_id of the resource) or be an admin.
 *
 * All three rely on the cookie-bound supabase client to read the session,
 * not the service-role admin client (which would bypass auth entirely).
 */

type Guard = { ok: true; userId: string } | { ok: false; response: NextResponse };

// likeEscape now lives in lib/supabase/like-escape.ts so that plain data
// modules can use it without importing next/server. Re-exported here because
// the guards are its most important caller and several routes import it from
// this module.
export { likeEscape } from '@/lib/supabase/like-escape';

/**
 * Поточний користувач із cookie-звʼязаного клієнта.
 *
 * Експортується, бо кільком роутам після guard потрібен ще й email — staff
 * зіставляється саме за ним, а Guard повертає лише userId. Це той самий
 * виклик, яким користуються всі guard-и нижче; сервісний клієнт для читання
 * сесії не годиться, він авторизацію просто оминає.
 */
export async function getSession() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    return { supabase, user };
}

export async function requireAuth(): Promise<Guard> {
    const { user } = await getSession();
    if (!user) {
        return { ok: false, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
    }
    return { ok: true, userId: user.id };
}

export async function requireAdmin(): Promise<Guard> {
    const { user } = await getSession();
    if (!user) {
        return { ok: false, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
    }

    // Admin if either:
    //   - email matches admin_users.email
    //     (admin_users has its own UUID, NOT the auth.users.id, so we match by email)
    //   - staff row exists with role='admin'
    const admin = getAdminClient();
    const email = user.email;

    if (email) {
        const { data: adminRow } = await admin
            .from('admin_users')
            .select('id')
            .ilike('email', likeEscape(email))
            .maybeSingle();
        if (adminRow) return { ok: true, userId: user.id };

        // owner is treated as a full admin (same as PermissionsContext, which
        // marks both 'admin' and 'owner' as superAdmin). Matching admin-only,
        // not the scoped roles (designer/manager/marketer/production).
        const { data: staffRow } = await admin
            .from('staff')
            .select('id, role')
            .ilike('email', likeEscape(email))
            .maybeSingle();
        const staffRole = (staffRow as any)?.role;
        if (staffRow && (staffRole === 'admin' || staffRole === 'owner')) {
            return { ok: true, userId: user.id };
        }
    }

    return { ok: false, response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
}

/**
 * Require any ACTIVE staff member (admin, owner, manager, designer,
 * marketer, production — any role with an active staff row), OR an
 * admin_users entry.
 *
 * Use this for read-only admin-panel data that every staff member is
 * allowed to see: the dashboard, the orders list, order details, the
 * design queue. The narrower requireAdmin stays on destructive or
 * sensitive actions (deleting orders, editing prices, managing staff).
 *
 * This mirrors the access the proxy.ts /admin gate already grants — it
 * lets any active staff member load the /admin UI — so the data APIs must
 * not be stricter than the page that renders them, otherwise managers see
 * the shell with empty data (the '0 замовлень' bug).
 */
export async function requireStaff(): Promise<Guard> {
    const { user } = await getSession();
    if (!user) {
        return { ok: false, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
    }

    const admin = getAdminClient();
    const email = user.email;

    if (email) {
        const { data: adminRow } = await admin
            .from('admin_users')
            .select('id')
            .ilike('email', likeEscape(email))
            .maybeSingle();
        if (adminRow) return { ok: true, userId: user.id };

        const { data: staffRow } = await admin
            .from('staff')
            .select('id, is_active')
            .ilike('email', likeEscape(email))
            .maybeSingle();
        if (staffRow && (staffRow as any).is_active) {
            return { ok: true, userId: user.id };
        }
    }

    return { ok: false, response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
}
/**
 * Доступ до РОЗДІЛУ адмінки, а не просто «я співробітник».
 *
 * requireStaff відповідає лише на питання «чи ця людина взагалі працює в
 * компанії», і цього замало. Меню вже приховує від менеджера фінанси, а від
 * дизайнера ще й маркетинг з виробництвом, але приховане меню — це не
 * захист: роут і далі відповідав будь-кому зі staff, і достатньо було знати
 * адресу. Тут перевіряється та сама мапа прав, яку читає меню, тож заборона
 * стає справжньою, а не косметичною.
 *
 * Рівні порівнюються за силою: 'view' < 'edit' < 'full'. Розділ, про який
 * роль не сказала нічого, вважається дозволеним — пояснення чому саме так
 * лежить у lib/auth/permissions.ts поряд з allows().
 *
 * Суперадміни (admin, owner) проходять усюди.
 */
export async function requireSection(section: string, level: PermissionLevel = 'view'): Promise<Guard> {
    return requireAnySection([[section, level]]);
}

/**
 * Те саме, але достатньо ОДНОГО з перелічених прав.
 *
 * Потрібне там, де одну дію легально роблять різні ролі з різних боків.
 * Канонічний приклад — дошка виробництва: менеджер має orders: full і
 * production: view, виробництво навпаки — production: full і orders: view.
 * Перенесення картки між колонками це і зміна замовлення, і робота
 * виробництва водночас, тож будь-який один розділ як умова відрізав би одну з
 * двох ролей від її щоденної роботи. Вимагаємо orders: edit АБО
 * production: edit.
 */
export async function requireAnySection(
    required: Array<[section: string, level: PermissionLevel]>,
): Promise<Guard> {
    const staffGuard = await requireStaff();
    if (!staffGuard.ok) return staffGuard;

    const { user } = await getSession();
    const resolved = await resolveStaffPermissions(user?.email);
    for (const [section, level] of required) {
        if (allows(resolved.permissions, section, level, resolved.isAdmin)) {
            return { ok: true, userId: staffGuard.userId };
        }
    }

    const names = required.map(([section]) => `«${section}»`).join(' або ');
    return {
        ok: false,
        response: NextResponse.json(
            { error: `Недостатньо прав на розділ ${names}` },
            { status: 403 },
        ),
    };
}

export async function requireOwnerOrAdmin(customerId: string | null): Promise<Guard> {
    const { user } = await getSession();
    if (!user) {
        return { ok: false, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
    }

    const admin = getAdminClient();
    const email = user.email;

    // Admin path (match by email, since admin_users.id is not auth.users.id)
    if (email) {
        const { data: adminRow } = await admin
            .from('admin_users')
            .select('id')
            .ilike('email', likeEscape(email))
            .maybeSingle();
        if (adminRow) return { ok: true, userId: user.id };
    }

    // Ownership path
    if (customerId) {
        const { data: customerRow } = await admin
            .from('customers')
            .select('id')
            .eq('id', customerId)
            .eq('auth_user_id', user.id)
            .maybeSingle();
        if (customerRow) return { ok: true, userId: user.id };
    }

    return { ok: false, response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
}
