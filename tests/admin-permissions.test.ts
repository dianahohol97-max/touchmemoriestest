import { describe, expect, it } from 'vitest';
import { allows, mergeRolePermissions } from '@/lib/auth/permissions';

/**
 * Права в адмінці.
 *
 * До цього моменту рольова модель не працювала жодного дня: провайдер читав
 * staff і admin_roles прямо з браузера, RLS на обох таблицях пускає лише
 * admin_users, і гілка «рядка в staff немає» вважала таку людину суперадміном.
 * Тобто повний доступ отримували саме ті, кого система не змогла впізнати.
 *
 * Тепер права рахує сервер, і ці тести тримають два правила, від яких залежить,
 * що людина бачить: як зливаються роль та індивідуальні права, і що ховається
 * лише те, про що роль сказала прямо.
 */
describe('mergeRolePermissions', () => {
    it('takes the role map as the base', () => {
        expect(mergeRolePermissions({ orders: 'edit', finance: 'none' }, null))
            .toEqual({ orders: 'edit', finance: 'none' });
    });

    it('lets individual permissions raise a section above the role', () => {
        expect(mergeRolePermissions({ orders: 'view' }, { orders: 'full' }))
            .toEqual({ orders: 'full' });
    });

    it("treats an individual 'none' as «нічого не додаю», not as taking away", () => {
        expect(mergeRolePermissions({ orders: 'full' }, { orders: 'none' }))
            .toEqual({ orders: 'full' });
    });

    it('ignores junk values instead of letting them into the map', () => {
        expect(mergeRolePermissions({ orders: 'edit', catalog: true, ai: 'superuser' } as any, null))
            .toEqual({ orders: 'edit' });
    });

    it('survives a role with no permissions at all', () => {
        expect(mergeRolePermissions(null, null)).toEqual({});
    });
});

describe('allows', () => {
    const manager = { orders: 'full', finance: 'none', analytics: 'view' } as const;

    it('hides a section the role explicitly denied', () => {
        expect(allows(manager as any, 'finance', 'view')).toBe(false);
    });

    it('compares levels by strength, not by equality', () => {
        expect(allows(manager as any, 'analytics', 'view')).toBe(true);
        expect(allows(manager as any, 'analytics', 'edit')).toBe(false);
        expect(allows(manager as any, 'orders', 'full')).toBe(true);
    });

    /**
     * Найважливіший тест файлу. «Кабінет дизайнера» має section 'designer', а
     * в ролях такого ключа немає — за правилом «немає ключа означає none»
     * дизайнер втратив би доступ саме до свого кабінету.
     */
    it('allows a section no role has ever heard of', () => {
        expect(allows(manager as any, 'designer', 'view')).toBe(true);
    });

    /**
     * /admin/roles зберігає зовсім інший словник, булеві can_view_orders. Роль,
     * збережена там, не містить жодного з десяти розділів — і не повинна
     * ховати все меню одним натисканням «Зберегти».
     */
    it('does not blank the menu when a role was saved in the other vocabulary', () => {
        const saved = { can_view_orders: 'full' } as any;
        expect(allows(saved, 'orders', 'view')).toBe(true);
        expect(allows(saved, 'finance', 'full')).toBe(true);
    });

    it('lets an admin through everything, denials included', () => {
        expect(allows(manager as any, 'finance', 'full', true)).toBe(true);
    });
});
