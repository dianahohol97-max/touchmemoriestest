'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
    Shield,
    Save,
    Users,
    Check,
    X,
    Activity,
    AlertCircle,
    ChevronRight
} from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';

interface Role {
    id: string;
    name: string;
    slug: string;
    permissions: Record<string, any>;
    is_system: boolean;
    member_count?: number;
    members?: Array<{ id: string; name: string }>;
}

const PERMISSION_GROUPS = [
    {
        title: 'Замовлення',
        permissions: [
            { key: 'can_view_orders', label: 'Може переглядати замовлення' },
            { key: 'can_edit_orders', label: 'Може редагувати замовлення' },
            { key: 'can_delete_orders', label: 'Може видаляти замовлення' }
        ]
    },
    {
        title: 'Клієнти',
        permissions: [
            { key: 'can_view_clients', label: 'Може переглядати клієнтів' },
            { key: 'can_edit_clients', label: 'Може редагувати клієнтів' }
        ]
    },
    {
        title: 'Фінанси',
        permissions: [
            { key: 'can_view_financial_data', label: 'Може переглядати фінансові дані' }
        ]
    },
    {
        title: 'Продукти',
        permissions: [
            { key: 'can_manage_products', label: 'Може управляти продуктами' }
        ]
    },
    {
        title: 'Аналітика',
        permissions: [
            { key: 'can_access_analytics', label: 'Має доступ до аналітики' }
        ]
    },
    {
        title: 'Блог',
        permissions: [
            { key: 'can_manage_blog', label: 'Може управляти блогом' }
        ]
    }
];

export default function RolesPage() {
    const supabase = createClient();

    const [roles, setRoles] = useState<Role[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState<string | null>(null);
    const [editedPermissions, setEditedPermissions] = useState<Record<string, Record<string, boolean>>>({});

    useEffect(() => {
        fetchRoles();
    }, []);

    const fetchRoles = async () => {
        setLoading(true);
        try {
            // Fetch roles
            const { data: rolesData } = await supabase
                .from('admin_roles')
                .select('*')
                .order('name');

            if (!rolesData) {
                setLoading(false);
                return;
            }

            // Fetch staff members with their roles
            const { data: staffData } = await supabase
                .from('staff')
                .select('id, name, role_id')
                .eq('is_active', true);

            // Count members per role and attach member list
            const rolesWithMembers = rolesData.map(role => {
                const members = staffData?.filter(s => s.role_id === role.id) || [];
                return {
                    ...role,
                    member_count: members.length,
                    members: members.map(m => ({ id: m.id, name: m.name }))
                };
            });

            setRoles(rolesWithMembers);

            // Initialize edited permissions with current values
            const initialPermissions: Record<string, Record<string, boolean>> = {};
            rolesWithMembers.forEach(role => {
                initialPermissions[role.id] = parsePermissions(role.permissions);
            });
            setEditedPermissions(initialPermissions);

        } catch (error) {
            console.error('Error fetching roles:', error);
            toast.error('Помилка завантаження ролей');
        } finally {
            setLoading(false);
        }
    };

    const parsePermissions = (permissions: any): Record<string, boolean> => {
        // Convert existing permission structure to checkbox format
        const parsed: Record<string, boolean> = {};

        // Map existing permissions to checkbox keys
        if (permissions.orders === 'full' || permissions.orders === 'edit' || permissions.orders === 'view') {
            parsed.can_view_orders = true;
        }
        if (permissions.orders === 'full' || permissions.orders === 'edit') {
            parsed.can_edit_orders = true;
        }
        if (permissions.orders === 'full') {
            parsed.can_delete_orders = true;
        }

        if (permissions.customers === 'view' || permissions.customers === 'edit' || permissions.customers === 'full') {
            parsed.can_view_clients = true;
        }
        if (permissions.customers === 'edit' || permissions.customers === 'full') {
            parsed.can_edit_clients = true;
        }

        if (permissions.finance !== 'none' && permissions.finance) {
            parsed.can_view_financial_data = true;
        }

        if (permissions.catalog !== 'none' && permissions.catalog) {
            parsed.can_manage_products = true;
        }

        if (permissions.analytics !== 'none' && permissions.analytics) {
            parsed.can_access_analytics = true;
        }

        if (permissions.content !== 'none' && permissions.content) {
            parsed.can_manage_blog = true;
        }

        return parsed;
    };

    const togglePermission = (roleId: string, permissionKey: string) => {
        setEditedPermissions(prev => ({
            ...prev,
            [roleId]: {
                ...prev[roleId],
                [permissionKey]: !prev[roleId]?.[permissionKey]
            }
        }));
    };

    const savePermissions = async (roleId: string) => {
        setSaving(roleId);
        try {
            const role = roles.find(r => r.id === roleId);
            if (!role) return;

            const checkboxPerms = editedPermissions[roleId] || {};

            // Convert checkbox permissions back to the existing format
            const updatedPermissions = { ...role.permissions };

            // Orders permissions
            if (checkboxPerms.can_delete_orders) {
                updatedPermissions.orders = 'full';
            } else if (checkboxPerms.can_edit_orders) {
                updatedPermissions.orders = 'edit';
            } else if (checkboxPerms.can_view_orders) {
                updatedPermissions.orders = 'view';
            } else {
                updatedPermissions.orders = 'none';
            }

            // Clients permissions
            if (checkboxPerms.can_edit_clients) {
                updatedPermissions.customers = 'edit';
            } else if (checkboxPerms.can_view_clients) {
                updatedPermissions.customers = 'view';
            } else {
                updatedPermissions.customers = 'none';
            }

            // Finance
            updatedPermissions.finance = checkboxPerms.can_view_financial_data ? 'view' : 'none';

            // Products
            updatedPermissions.catalog = checkboxPerms.can_manage_products ? 'edit' : 'none';

            // Analytics
            updatedPermissions.analytics = checkboxPerms.can_access_analytics ? 'view' : 'none';

            // Blog
            updatedPermissions.content = checkboxPerms.can_manage_blog ? 'edit' : 'none';

            const { error } = await supabase
                .from('admin_roles')
                .update({
                    permissions: updatedPermissions,
                    updated_at: new Date().toISOString()
                })
                .eq('id', roleId);

            if (error) throw error;

            toast.success('Права доступу збережено');
            await fetchRoles();
        } catch (error) {
            console.error('Error saving permissions:', error);
            toast.error('Помилка збереження');
        } finally {
            setSaving(null);
        }
    };

    if (loading) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '80vh' }}>
                <Activity className="animate-spin" size={48} color="#263A99" />
            </div>
        );
    }

    return (
        <div style={{ maxWidth: '1600px', margin: '0 auto' }}>
            {/* Header */}
            <div style={{ marginBottom: '32px' }}>
                <h1 style={{ fontSize: '32px', fontWeight: 800, color: '#0f172a', marginBottom: '8px' }}>
                    Ролі та права доступу
                </h1>
                <p style={{ color: '#64748b', fontSize: '16px' }}>
                    Управління правами доступу для ролей користувачів
                </p>
            </div>

            {/* Info Banner */}
            <div style={{
                padding: '16px 20px',
                backgroundColor: '#eef0fb',
                border: '1px solid #263A99',
                borderRadius: '3px',
                marginBottom: '32px',
                display: 'flex',
                alignItems: 'center',
                gap: '12px'
            }}>
                <AlertCircle size={20} color="#263A99" />
                <div>
                    <p style={{ fontSize: '14px', color: '#1e293b', marginBottom: '4px' }}>
                        Призначити роль співробітнику можна на сторінці{' '}
                        <Link
                            href="/admin/team"
                            style={{
                                color: '#263A99',
                                fontWeight: 600,
                                textDecoration: 'none',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px'
                            }}
                        >
                            Команда <ChevronRight size={14} />
                        </Link>
                    </p>
                </div>
            </div>

            {/* Roles List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                {roles.map(role => {
                    const rolePermissions = editedPermissions[role.id] || {};
                    const hasChanges = JSON.stringify(rolePermissions) !== JSON.stringify(parsePermissions(role.permissions));

                    return (
                        <div
                            key={role.id}
                            style={{
                                padding: '32px',
                                backgroundColor: 'white',
                                borderRadius: '3px',
                                boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                                border: hasChanges ? '2px solid #f59e0b' : '1px solid #e2e8f0'
                            }}
                        >
                            {/* Role Header */}
                            <div style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'flex-start',
                                marginBottom: '24px',
                                paddingBottom: '20px',
                                borderBottom: '2px solid #f1f5f9'
                            }}>
                                <div style={{ flex: 1 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                                        <Shield size={24} color="#263A99" />
                                        <h2 style={{ fontSize: '24px', fontWeight: 700, color: '#0f172a' }}>
                                            {role.name}
                                        </h2>
                                        {role.is_system && (
                                            <span style={{
                                                padding: '4px 10px',
                                                backgroundColor: '#dbeafe',
                                                color: '#1e40af',
                                                borderRadius: '3px',
                                                fontSize: '12px',
                                                fontWeight: 600
                                            }}>
                                                Системна роль
                                            </span>
                                        )}
                                    </div>
                                    <p style={{ fontSize: '14px', color: '#64748b', marginBottom: '12px' }}>
                                        Slug: {role.slug}
                                    </p>

                                    {/* Team Members */}
                                    {role.member_count && role.member_count > 0 ? (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '12px' }}>
                                            <Users size={16} color="#64748b" />
                                            <p style={{ fontSize: '14px', color: '#64748b' }}>
                                                <strong>{role.member_count}</strong> {role.member_count === 1 ? 'співробітник' : 'співробітників'}:
                                                {' '}
                                                <span style={{ fontWeight: 600, color: '#0f172a' }}>
                                                    {role.members?.map(m => m.name).join(', ')}
                                                </span>
                                            </p>
                                        </div>
                                    ) : (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '12px' }}>
                                            <Users size={16} color="#cbd5e1" />
                                            <p style={{ fontSize: '14px', color: '#cbd5e1', fontStyle: 'italic' }}>
                                                Жодного співробітника не призначено
                                            </p>
                                        </div>
                                    )}
                                </div>

                                <button
                                    onClick={() => savePermissions(role.id)}
                                    disabled={!hasChanges || saving === role.id}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px',
                                        padding: '12px 24px',
                                        backgroundColor: hasChanges ? '#22c55e' : '#e2e8f0',
                                        color: hasChanges ? 'white' : '#94a3b8',
                                        border: 'none',
                                        borderRadius: '3px',
                                        fontSize: '15px',
                                        fontWeight: 600,
                                        cursor: hasChanges ? 'pointer' : 'not-allowed',
                                        transition: 'all 0.2s'
                                    }}
                                >
                                    {saving === role.id ? (
                                        <>
                                            <Activity className="animate-spin" size={18} />
                                            Збереження...
                                        </>
                                    ) : (
                                        <>
                                            <Save size={18} />
                                            {hasChanges ? 'Зберегти зміни' : 'Збережено'}
                                        </>
                                    )}
                                </button>
                            </div>

                            {/* Permissions Matrix */}
                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
                                gap: '24px'
                            }}>
                                {PERMISSION_GROUPS.map(group => (
                                    <div key={group.title} style={{
                                        padding: '20px',
                                        backgroundColor: '#f8fafc',
                                        borderRadius: '3px',
                                        border: '1px solid #e2e8f0'
                                    }}>
                                        <h3 style={{
                                            fontSize: '16px',
                                            fontWeight: 700,
                                            color: '#0f172a',
                                            marginBottom: '16px'
                                        }}>
                                            {group.title}
                                        </h3>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                            {group.permissions.map(perm => {
                                                const isChecked = rolePermissions[perm.key] || false;
                                                return (
                                                    <label
                                                        key={perm.key}
                                                        style={{
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            gap: '12px',
                                                            cursor: 'pointer',
                                                            padding: '12px',
                                                            backgroundColor: isChecked ? '#eef0fb' : 'white',
                                                            borderRadius: '3px',
                                                            border: isChecked ? '1px solid #263A99' : '1px solid #e2e8f0',
                                                            transition: 'all 0.2s'
                                                        }}
                                                    >
                                                        <div style={{
                                                            width: '20px',
                                                            height: '20px',
                                                            borderRadius: '3px',
                                                            border: isChecked ? '2px solid #263A99' : '2px solid #cbd5e1',
                                                            backgroundColor: isChecked ? '#263A99' : 'white',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            transition: 'all 0.2s',
                                                            flexShrink: 0
                                                        }}>
                                                            {isChecked && <Check size={14} color="white" strokeWidth={3} />}
                                                        </div>
                                                        <input
                                                            type="checkbox"
                                                            checked={isChecked}
                                                            onChange={() => togglePermission(role.id, perm.key)}
                                                            style={{ display: 'none' }}
                                                        />
                                                        <span style={{
                                                            fontSize: '14px',
                                                            fontWeight: isChecked ? 600 : 400,
                                                            color: isChecked ? '#263A99' : '#475569'
                                                        }}>
                                                            {perm.label}
                                                        </span>
                                                    </label>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {hasChanges && (
                                <div style={{
                                    marginTop: '20px',
                                    padding: '12px 16px',
                                    backgroundColor: '#fef3c7',
                                    borderRadius: '3px',
                                    fontSize: '14px',
                                    color: '#92400e',
                                    fontWeight: 600
                                }}>
                                    ⚠️ Є незбережені зміни. Натисніть "Зберегти зміни" для збереження.
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
