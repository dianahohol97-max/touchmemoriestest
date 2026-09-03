'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { allows, type PermissionLevel } from '@/lib/auth/permissions';

type PermissionsContextType = {
    permissions: Record<string, PermissionLevel>;
    isLoading: boolean;
    hasPermission: (section: string, level: PermissionLevel) => boolean;
    isAdmin: boolean;
};

const PermissionsContext = createContext<PermissionsContextType | undefined>(undefined);

export const PermissionsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [permissions, setPermissions] = useState<Record<string, PermissionLevel>>({});
    const [isLoading, setIsLoading] = useState(true);
    const [isAdmin, setIsAdmin] = useState(false);

    // ПРАВА РАХУЄ СЕРВЕР.
    //
    // Раніше цей провайдер сам читав staff за своїм email і admin_roles за
    // role_id прямо з браузера. Обидві таблиці закриті політикою
    // is_admin_user(), тобто «email є в admin_users», а туди входять четверо з
    // чотирнадцяти активних співробітників. Решті запит повертав null, і код
    // трактував це найгіршим можливим чином: гілка «рядка в staff немає»
    // вважала людину суперадміном і відкривала все меню. Рольова модель не
    // просто не працювала — вона давала повний доступ саме тим, кого не
    // змогла впізнати.
    //
    // Тепер це GET /api/admin/me/permissions під requireStaff. Логіка злиття
    // там та сама, що була тут: роль дає базову мапу, індивідуальні права
    // перекривають її зверху, admin і owner лишаються суперадмінами, а
    // співробітник без ролі й без індивідуальних прав лишається суперадміном,
    // щоб ніхто не опинився в порожній адмінці через цю зміну.
    useEffect(() => {
        let cancelled = false;

        const run = async () => {
            // Запобіжник на випадок, коли роут не відповідає: меню не має
            // застрягати порожнім. Був тут і раніше, лишається.
            const timer = setTimeout(() => {
                if (!cancelled) { setIsAdmin(true); setPermissions({}); setIsLoading(false); }
            }, 4000);

            try {
                const res = await fetch('/api/admin/me/permissions');
                clearTimeout(timer);
                if (cancelled) return;
                if (!res.ok) throw new Error(`API ${res.status}`);
                const data = await res.json();
                setIsAdmin(!!data.isAdmin);
                setPermissions((data.permissions || {}) as Record<string, PermissionLevel>);
            } catch (e) {
                clearTimeout(timer);
                console.error('[admin] permissions load failed', e);
                if (!cancelled) { setIsAdmin(true); setPermissions({}); }
            } finally {
                if (!cancelled) setIsLoading(false);
            }
        };

        run();
        return () => { cancelled = true; };
    }, []);

    // Саме правило доступу живе в lib/auth/permissions.ts — там же пояснено,
    // чому розділ, якого немає в мапі ролі, вважається дозволеним.
    const hasPermission = useCallback(
        (section: string, requiredLevel: PermissionLevel): boolean =>
            allows(permissions, section, requiredLevel, isAdmin),
        [permissions, isAdmin],
    );

    return (
        <PermissionsContext.Provider value={{ permissions, isLoading, hasPermission, isAdmin }}>
            {children}
        </PermissionsContext.Provider>
    );
};

export const usePermissions = () => {
    const ctx = useContext(PermissionsContext);
    if (!ctx) throw new Error('usePermissions must be used within a PermissionsProvider');
    return ctx;
};
