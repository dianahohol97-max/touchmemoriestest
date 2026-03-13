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

            if (staff) {
                // 2. Fetch role permissions if role_id exists
                if (staff.role_id) {
                    const { data: role, error: roleError } = await supabase
                        .from('admin_roles')
                        .select('permissions, slug')
                        .eq('id', staff.role_id)
                        .single();

                    if (!roleError && role) {
                        mergedPermissions = { ...(role.permissions || {}) };
                        if (role.slug === 'owner' || staff.role === 'admin') {
                            setIsAdmin(true);
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
                // Fallback: Check admin_users table for superadmins not in staff yet
                const { data: adminUser } = await supabase
                    .from('admin_users')
                    .select('role')
                    .eq('email', session.user.email)
                    .maybeSingle();

                if (adminUser) {
                    setIsAdmin(true);
                }
            }

            setPermissions(mergedPermissions);
        } catch (error) {
            console.error('Error fetching permissions:', error);
            // Default to empty if error occurs
            setPermissions({});
        } finally {
            setIsLoading(false);
        }
    }, [supabase]);

    useEffect(() => {
        fetchPermissions();
    }, [fetchPermissions]);

    const hasPermission = useCallback((section: string, requiredLevel: PermissionLevel): boolean => {
        if (isAdmin) return true; // Owners have full access

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
