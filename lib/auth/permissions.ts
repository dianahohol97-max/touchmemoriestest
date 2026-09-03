/**
 * Права співробітника в адмінці — чиста логіка, спільна для сервера й меню.
 *
 * Тут немає жодного запиту до бази навмисно: рівно ці два правила визначають,
 * що людина бачить в адмінці, і саме тому вони мають бути читаними в одному
 * місці й покритими тестами. Читання staff і admin_roles живе в
 * app/api/admin/me/permissions, показ меню — в app/admin/context/
 * PermissionsContext.
 */

export type PermissionLevel = 'none' | 'view' | 'edit' | 'full';

/** Рівні за зростанням. Індекс у цьому масиві і є «сила» рівня. */
export const ACCESS_ORDER: PermissionLevel[] = ['none', 'view', 'edit', 'full'];

/**
 * Зводить мапу ролі з індивідуальними правами співробітника.
 *
 * Роль дає базу, індивідуальні права перекривають її зверху. Значення 'none'
 * в індивідуальних правах ігнорується: воно означає «нічого не додаю», а не
 * «відбираю те, що дала роль». Так було в первісному коді, і міняти це
 * мовчки не можна — хтось міг покластися саме на таку поведінку.
 */
export function mergeRolePermissions(
    rolePermissions: Record<string, unknown> | null | undefined,
    individualPermissions: Record<string, unknown> | null | undefined,
): Record<string, PermissionLevel> {
    const merged: Record<string, PermissionLevel> = {};
    for (const [section, level] of Object.entries(rolePermissions || {})) {
        if (isLevel(level)) merged[section] = level;
    }
    for (const [section, level] of Object.entries(individualPermissions || {})) {
        if (isLevel(level) && level !== 'none') merged[section] = level;
    }
    return merged;
}

function isLevel(value: unknown): value is PermissionLevel {
    return typeof value === 'string' && (ACCESS_ORDER as string[]).includes(value);
}

/**
 * Чи вистачає прав на розділ.
 *
 * Розділ, якого в мапі немає ВЗАГАЛІ, вважається дозволеним. Це не
 * послаблення, а захист від розбіжності двох словників прав, які зараз живуть
 * у проєкті. Ролі в admin_roles описують десять розділів (orders, catalog,
 * content, finance, settings, analytics, customers, marketing, production,
 * ai), а меню адмінки має щонайменше один поза цим переліком — «Кабінет
 * дизайнера» з section 'designer'. За правилом «немає ключа означає none»
 * дизайнер втратив би доступ саме до свого кабінету. Окремо: сторінка
 * /admin/roles редагує зовсім інший словник, булеві can_view_orders і
 * подібні, тож збережена там роль не містила б жодного з десяти ключів — і за
 * тим самим правилом сховала б усе меню одним натисканням «Зберегти».
 *
 * Заборона має бути свідомою, тому ховає розділ лише явне 'none' або замалий
 * рівень.
 */
export function allows(
    permissions: Record<string, PermissionLevel>,
    section: string,
    requiredLevel: PermissionLevel,
    isAdmin = false,
): boolean {
    if (isAdmin) return true;
    const level = permissions[section];
    if (level === undefined) return true;
    return ACCESS_ORDER.indexOf(level) >= ACCESS_ORDER.indexOf(requiredLevel);
}
