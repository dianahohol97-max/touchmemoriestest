'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';

type PermissionLevel = 'none' | 'view' | 'edit' | 'full';

type PermissionsContextType = {
    permissions: Record<string, PermissionLevel>;
    isLoading: boolean;
    hasPermission: (section: string, level: PermissionLevel) => boolean;
    isAdmin: boolean;
};

const PermissionsContext = createContext<PermissionsContextType | undefined>(undefined);
const ACCESS_ORDER: PermissionLevel[] = ['none', 'view', 'edit', 'full'];

export const PermissionsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [permissions, setPermissions] = useState<Record<string, PermissionLevel>>({});
    const [isLoading, setIsLoading] = useState(true);
    const [isAdmin, setIsAdmin] = useState(false);
    const supabaseRef = useRef(createClient());

    useEffect(() => {
        let cancelled = false;

        const run = async () => {
            const timer = setTimeout(() => {
                if (!cancelled) { setIsAdmin(true); setPermissions({}); setIsLoading(false); }
            }, 4000);

            try {
                const { data: { session } } = await supabaseRef.current.auth.getSession();
                clearTimeout(timer);
                if (cancelled) return;

                if (!session?.user?.email) {
                    setIsAdmin(true);
                    setIsLoading(false);
                    return;
                }

                const { data: staff } = await supabaseRef.current
                    .from('staff')
                    .select('role, role_id, individual_permissions')
                    .eq('email', session.user.email)
                    .maybeSingle();

                if (cancelled) return;

                let merged: Record<string, PermissionLevel> = {};
                let superAdmin = false;

                if (staff) {
                    if (staff.role === 'admin' || staff.role === 'owner') superAdmin = true;
                    if (staff.role_id) {
                        const { data: role } = await supabaseRef.current
                            .from('admin_roles').select('permissions, slug').eq('id', staff.role_id).single();
                        if (!cancelled && role) {
                            merged = { ...(role.permissions || {}) };
                            if (role.slug === 'owner' || role.slug === 'admin') superAdmin = true;
                        }
                    }
                    if (staff.individual_permissions) {
                        Object.entries(staff.individual_permissions).forEach(([s, l]) => {
                            if (l && l !== 'none') merged[s] = l as PermissionLevel;
                        });
                    }
                } else {
                    superAdmin = true;
                }

                if (!cancelled) { setIsAdmin(superAdmin); setPermissions(merged); }
            } catch {
                clearTimeout(timer);
                if (!cancelled) { setIsAdmin(true); setPermissions({}); }
            } finally {
                if (!cancelled) setIsLoading(false);
            }
        };

        run();
        return () => { cancelled = true; };
    }, []);

    const hasPermission = useCallback((section: string, requiredLevel: PermissionLevel): boolean => {
        if (isAdmin) return true;
        return ACCESS_ORDER.indexOf(permissions[section] || 'none') >= ACCESS_ORDER.indexOf(requiredLevel);
    }, [permissions, isAdmin]);

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
