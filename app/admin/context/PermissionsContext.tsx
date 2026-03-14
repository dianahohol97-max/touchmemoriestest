'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { createBrowserClient } from '@supabase/auth-helpers-nextjs';

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

    const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const fetchPermissions = useCallback(async () => {
        setIsLoading(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.user?.email) {
                setIsAdmin(true);
                setIsLoading(false);
                return;
            }

            // 1. Fetch staff record
            const { data: staff, error: staffError } = await supabase
                .from('staff')
                .select('role, role_id, individual_permissions')
                .eq('email', session.user.email)
                .maybeSingle();

            let mergedPermissions: Record<string, PermissionLevel> = {};
            let isSuperAdmin = false;

            if (staff) {
                // If the staff role is 'admin' or 'owner', treat as superadmin
                if (staff.role === 'admin' || staff.role === 'owner') {
                    isSuperAdmin = true;
                }

                // 2. Fetch role permissions if role_id exists
                if (staff.role_id) {
                    const { data: role, error: roleError } = await supabase
                        .from('admin_roles')
                        .select('permissions, slug')
                        .eq('id', staff.role_id)
                        .single();

                    if (!roleError && role) {
                        mergedPermissions = { ...(role.permissions || {}) };
                        if (role.slug === 'owner' || role.slug === 'admin') {
                            isSuperAdmin = true;
                        }
                    }
                }

                // 3. Apply individual overrides
                if (staff.individual_permissions) {
                    Object.entries(staff.individual_permissions).forEach(([section, level]) => {
                        if (level && level !== 'none') {
                            mergedPermissions[section] = level as PermissionLevel;
                        }
                    });
                }
            } else {
                // No staff record found — give full access
                isSuperAdmin = true;
            }

            setIsAdmin(isSuperAdmin);
            setPermissions(mergedPermissions);

        } catch (error) {
            console.error('Error fetching permissions:', error);
            // On any error — give full access so admin is never locked out
            setIsAdmin(true);
            setPermissions({});
        } finally {
            setIsLoading(false);
        }
    }, [supabase]);

    useEffect(() => {
        fetchPermissions();
    }, [fetchPermissions]);

    const hasPermission = useCallback((section: string, requiredLevel: PermissionLevel): boolean => {
        if (isAdmin) return true;

        const userLevel = permissions[section] || 'none';
        const userLevelIndex = ACCESS_ORDER.indexOf(userLevel);
        const requiredLevelIndex = ACCESS_ORDER.indexOf(requiredLevel);

        return userLevelIndex >= requiredLevelIndex;
    }, [permissions, isAdmin]);

    return (
        <PermissionsContext.Provider value={{ permissions, isLoading, hasPermission, isAdmin }}>
            {children}
        </PermissionsContext.Provider>
    );
};

export const usePermissions = () => {
    const context = useContext(PermissionsContext);
    if (context === undefined) {
        throw new Error('usePermissions must be used within a PermissionsProvider');
    }
    return context;
};
