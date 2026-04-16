'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import {
    Plus,
    Edit2,
    UserX,
    UserCheck,
    Mail,
    Phone,
    Calendar,
    TrendingUp,
    Activity,
    DollarSign,
    Clock,
    ShoppingBag,
    Users,
    X,
    Save,
    Loader2,
    ExternalLink,
    Star,
    Award
} from 'lucide-react';
import Link from 'next/link';
import { startOfMonth, endOfMonth, format } from 'date-fns';

interface Staff {
    id: string;
    name: string;
    email: string;
    phone?: string;
    role: string;
    role_id?: string;
    color: string;
    initials: string;
    is_active: boolean;
    created_at: string;
    daily_base_rate?: number;
    commission_percentage?: number;
    piece_rate?: number;
    individual_permissions?: Record<string, any>;
}

interface StaffStats {
    ordersThisMonth: number;
    revenueThisMonth: number;
    avgResponseTime: number; // in hours
}

interface Role {
    id: string;
    name: string;
    permissions: Record<string, string>;
}

const COLORS = [
    '#263A99', '#ef4444', '#10b981', '#f59e0b', '#6366f1',
    '#ec4899', '#8b5cf6', '#14b8a6', '#f43f5e', '#84cc16'
];

export default function TeamPage() {
    const supabase = createClient();

    const [staff, setStaff] = useState<Staff[]>([]);
    const [staffStats, setStaffStats] = useState<Record<string, StaffStats>>({});
    const [roles, setRoles] = useState<Role[]>([]);
    const [loading, setLoading] = useState(true);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    const [formData, setFormData] = useState<Partial<Staff>>({
        name: '',
        email: '',
        phone: '',
        role: '',
        role_id: '',
        color: COLORS[0],
        is_active: true,
        daily_base_rate: 0,
        commission_percentage: 0,
        piece_rate: 0
    });

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            // Fetch staff
            const { data: staffData, error: staffError } = await supabase
                .from('staff')
                .select('*')
                .order('created_at', { ascending: false });

            if (staffError) throw staffError;
            setStaff(staffData || []);

            // Fetch roles
            const rolesRes = await fetch('/api/admin/roles');
            if (rolesRes.ok) {
                const rolesData = await rolesRes.json();
                setRoles(rolesData);
            }

            // Fetch stats for each staff member
            if (staffData) {
                await fetchStaffStats(staffData);
            }
        } catch (error) {
            console.error('Error fetching data:', error);
            toast.error('Помилка завантаження даних');
        } finally {
            setLoading(false);
        }
    };

    const fetchStaffStats = async (staffList: Staff[]) => {
        const now = new Date();
        const monthStart = startOfMonth(now).toISOString();
        const monthEnd = endOfMonth(now).toISOString();

        const stats: Record<string, StaffStats> = {};

        for (const member of staffList) {
            try {
                // Fetch orders assigned to this staff member this month
                const { data: orders } = await supabase
                    .from('orders')
                    .select('id, total, created_at, assigned_manager_id, assigned_designer_id')
                    .gte('created_at', monthStart)
                    .lte('created_at', monthEnd)
                    .or(`assigned_manager_id.eq.${member.id},assigned_designer_id.eq.${member.id}`);

                const ordersCount = orders?.length || 0;
                const revenue = orders?.reduce((sum, o) => sum + (Number(o.total) || 0), 0) || 0;

                // Calculate avg response time (simplified - time between order creation and first status update)
                let totalResponseTime = 0;
                if (orders && orders.length > 0) {
                    // This is a simplified calculation - in real scenario, you'd track actual response times
                    totalResponseTime = orders.length * 2; // Mock: 2 hours average
                }

                stats[member.id] = {
                    ordersThisMonth: ordersCount,
                    revenueThisMonth: revenue,
                    avgResponseTime: ordersCount > 0 ? totalResponseTime / ordersCount : 0
                };
            } catch (error) {
                console.error(`Error fetching stats for ${member.name}:`, error);
                stats[member.id] = {
                    ordersThisMonth: 0,
                    revenueThisMonth: 0,
                    avgResponseTime: 0
                };
            }
        }

        setStaffStats(stats);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);

        try {
            // Generate initials if not provided
            if (!formData.initials && formData.name) {
                formData.initials = formData.name
                    .split(' ')
                    .map((n) => n[0])
                    .join('')
                    .substring(0, 2)
                    .toUpperCase();
            }

            const method = formData.id ? 'PATCH' : 'POST';
            const res = await fetch('/api/admin/staff', {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });

            if (!res.ok) throw new Error('Помилка збереження');

            toast.success('Співробітника збережено');
            setIsFormOpen(false);
            resetForm();
            await fetchData();
        } catch (error: any) {
            toast.error(error.message);
        } finally {
            setIsSaving(false);
        }
    };

    const toggleStatus = async (member: Staff) => {
        try {
            const res = await fetch('/api/admin/staff', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: member.id, is_active: !member.is_active })
            });

            if (!res.ok) throw new Error('Помилка оновлення статусу');

            toast.success(
                member.is_active ? 'Співробітника деактивовано' : 'Співробітника активовано'
            );
            await fetchData();
        } catch (error: any) {
            toast.error(error.message);
        }
    };

    const resetForm = () => {
        setFormData({
            name: '',
            email: '',
            phone: '',
            role: '',
            role_id: roles[0]?.id || '',
            color: COLORS[0],
            is_active: true,
            daily_base_rate: 0,
            commission_percentage: 0,
            piece_rate: 0
        });
    };

    const getRoleLabel = (member: Staff) => {
        const dbRole = roles.find((r) => r.id === member.role_id);
        if (dbRole) return dbRole.name;
        return member.role || 'Не вказано';
    };

    const getRoleBadgeColor = (role: string) => {
        const roleColors: Record<string, { bg: string; color: string }> = {
            manager: { bg: '#eff6ff', color: '#263A99' },
            designer: { bg: '#fef3c7', color: '#f59e0b' },
            admin: { bg: '#fdf2f8', color: '#db2777' },
            production: { bg: '#f0fdf4', color: '#16a34a' }
        };
        return roleColors[role.toLowerCase()] || { bg: '#f1f5f9', color: '#64748b' };
    };

    // Calculate overall team stats
    const teamStats = {
        totalMembers: staff.length,
        activeMembers: staff.filter((s) => s.is_active).length,
        totalOrdersThisMonth: Object.values(staffStats).reduce(
            (sum, s: any) => sum + s.ordersThisMonth,
            0
        ),
        totalRevenueThisMonth: Object.values(staffStats).reduce(
            (sum, s: any) => sum + s.revenueThisMonth,
            0
        )
    };

    return (
        <div style={{ maxWidth: '100%', paddingBottom: '80px' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px' }}>
                <div>
                    <h1 style={{ fontSize: '32px', fontWeight: 900, color: '#263A99', marginBottom: '8px', letterSpacing: '-0.02em' }}>
                        Управління Командою
                    </h1>
                    <p style={{ color: '#64748b', fontSize: '16px' }}>
                        Менеджери, дизайнери та персонал виробництва
                    </p>
                </div>
                <button onClick={() => { resetForm(); setIsFormOpen(true); }} style={addButton}>
                    <Plus size={20} />
                    Додати співробітника
                </button>
            </div>

            {/* Team Stats */}
            <div style={statsGrid}>
                <div style={statCard}>
                    <div style={{ ...iconWrapper, backgroundColor: '#eff6ff', color: '#263A99' }}>
                        <Users size={24} />
                    </div>
                    <div>
                        <div style={statLabel}>Всього у команді</div>
                        <div style={statValue}>{teamStats.totalMembers}</div>
                        <div style={statSubtext}>{teamStats.activeMembers} активних</div>
                    </div>
                </div>
                <div style={statCard}>
                    <div style={{ ...iconWrapper, backgroundColor: '#f0fdf4', color: '#16a34a' }}>
                        <ShoppingBag size={24} />
                    </div>
                    <div>
                        <div style={statLabel}>Замовлень цього місяця</div>
                        <div style={statValue}>{(teamStats as any).totalOrdersThisMonth}</div>
                        <div style={statSubtext}>
                            {teamStats.activeMembers > 0
                                ? Math.round((teamStats as any).totalOrdersThisMonth / teamStats.activeMembers)
                                : 0}{' '}
                            на особу
                        </div>
                    </div>
                </div>
                <div style={statCard}>
                    <div style={{ ...iconWrapper, backgroundColor: '#fef3c7', color: '#f59e0b' }}>
                        <DollarSign size={24} />
                    </div>
                    <div>
                        <div style={statLabel}>Виручка цього місяця</div>
                        <div style={statValue}>{(teamStats as any).totalRevenueThisMonth.toLocaleString()} ₴</div>
                        <div style={statSubtext}>
                            {teamStats.activeMembers > 0
                                ? Math.round((teamStats as any).totalRevenueThisMonth / teamStats.activeMembers).toLocaleString()
                                : 0}{' '}
                            ₴ на особу
                        </div>
                    </div>
                </div>
            </div>

            {/* Team Member Cards */}
            {loading ? (
                <div style={{ padding: '100px', textAlign: 'center' }}>
                    <Activity className="animate-spin" size={40} color="#94a3b8" style={{ margin: '0 auto' }} />
                </div>
            ) : staff.length === 0 ? (
                <div style={{ padding: '100px', textAlign: 'center', color: '#64748b' }}>
                    Ще немає співробітників
                </div>
            ) : (
                <div style={cardsGrid}>
                    {staff.map((member) => {
                        const stats = staffStats[member.id] || {
                            ordersThisMonth: 0,
                            revenueThisMonth: 0,
                            avgResponseTime: 0
                        };
                        const roleBadge = getRoleBadgeColor(getRoleLabel(member));

                        return (
                            <div
                                key={member.id}
                                style={{
                                    ...memberCard,
                                    opacity: member.is_active ? 1 : 0.6,
                                    borderColor: member.is_active ? '#f1f5f9' : '#fecaca'
                                }}
                            >
                                {/* Header */}
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                        <div
                                            style={{
                                                width: '60px',
                                                height: '60px',
                                                borderRadius: '3px',
                                                backgroundColor: member.color,
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                color: 'white',
                                                fontSize: '22px',
                                                fontWeight: 900
                                            }}
                                        >
                                            {member.initials}
                                        </div>
                                        <div>
                                            <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#263A99', margin: 0, marginBottom: '6px' }}>
                                                {member.name}
                                            </h3>
                                            <span
                                                style={{
                                                    display: 'inline-block',
                                                    padding: '4px 12px',
                                                    backgroundColor: roleBadge.bg,
                                                    color: roleBadge.color,
                                                    borderRadius: '3px',
                                                    fontSize: '12px',
                                                    fontWeight: 700
                                                }}
                                            >
                                                {getRoleLabel(member)}
                                            </span>
                                        </div>
                                    </div>
                                    <div
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '4px',
                                            fontSize: '12px',
                                            fontWeight: 700,
                                            color: member.is_active ? '#10b981' : '#ef4444'
                                        }}
                                    >
                                        <div
                                            style={{
                                                width: '8px',
                                                height: '8px',
                                                borderRadius: '50%',
                                                backgroundColor: member.is_active ? '#10b981' : '#ef4444'
                                            }}
                                        />
                                        {member.is_active ? 'Активний' : 'Деактивовано'}
                                    </div>
                                </div>

                                {/* Contact Info */}
                                <div style={{ marginBottom: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    <div style={contactRow}>
                                        <Mail size={14} color="#94a3b8" />
                                        {member.email || '—'}
                                    </div>
                                    {member.phone && (
                                        <div style={contactRow}>
                                            <Phone size={14} color="#94a3b8" />
                                            {member.phone}
                                        </div>
                                    )}
                                    <div style={contactRow}>
                                        <Calendar size={14} color="#94a3b8" />
                                        З {new Date(member.created_at).toLocaleDateString('uk-UA')}
                                    </div>
                                </div>

                                {/* Stats This Month */}
                                <div style={{ marginBottom: '20px', paddingTop: '16px', borderTop: '1px solid #f1f5f9' }}>
                                    <div style={{ fontSize: '12px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '12px' }}>
                                        Статистика цього місяця
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                                        <div>
                                            <div style={miniStatLabel}>
                                                <ShoppingBag size={12} />
                                                Замовлень
                                            </div>
                                            <div style={miniStatValue}>{stats.ordersThisMonth}</div>
                                        </div>
                                        <div>
                                            <div style={miniStatLabel}>
                                                <TrendingUp size={12} />
                                                Виручка
                                            </div>
                                            <div style={miniStatValue}>
                                                {stats.revenueThisMonth > 1000
                                                    ? `${(stats.revenueThisMonth / 1000).toFixed(1)}k`
                                                    : stats.revenueThisMonth}{' '}
                                                ₴
                                            </div>
                                        </div>
                                        <div>
                                            <div style={miniStatLabel}>
                                                <Clock size={12} />
                                                Відгук
                                            </div>
                                            <div style={miniStatValue}>{stats.avgResponseTime.toFixed(1)}h</div>
                                        </div>
                                    </div>
                                </div>

                                {/* Salary Info */}
                                {(member.daily_base_rate || member.commission_percentage || member.piece_rate) && (
                                    <div style={{ marginBottom: '20px', paddingTop: '16px', borderTop: '1px solid #f1f5f9' }}>
                                        <div style={{ fontSize: '12px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '12px' }}>
                                            Ставки оплати
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px' }}>
                                            {member.daily_base_rate && member.daily_base_rate > 0 && (
                                                <div style={{ color: '#475569', fontWeight: 600 }}>
                                                     За день: {member.daily_base_rate} ₴
                                                </div>
                                            )}
                                            {member.commission_percentage && member.commission_percentage > 0 && (
                                                <div style={{ color: '#475569', fontWeight: 600 }}>
                                                     Відсоток: {member.commission_percentage}%
                                                </div>
                                            )}
                                            {member.piece_rate && member.piece_rate > 0 && (
                                                <div style={{ color: '#475569', fontWeight: 600 }}>
                                                     За продукт: {member.piece_rate} ₴
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* Actions */}
                                <div style={{ display: 'flex', gap: '8px' }}>
                                    <button
                                        onClick={() => {
                                            setFormData(member);
                                            setIsFormOpen(true);
                                        }}
                                        style={actionBtnPrimary}
                                    >
                                        <Edit2 size={16} />
                                        Редагувати
                                    </button>
                                    <button onClick={() => toggleStatus(member)} style={actionBtnSecondary}>
                                        {member.is_active ? <UserX size={16} /> : <UserCheck size={16} />}
                                    </button>
                                    <Link
                                        href={`/admin/salary?staff_id=${member.id}`}
                                        style={actionBtnSecondary}
                                        title="Зарплати"
                                    >
                                        <DollarSign size={16} />
                                    </Link>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Add/Edit Modal */}
            {isFormOpen && (
                <>
                    <div style={overlay} onClick={() => setIsFormOpen(false)} />
                    <div style={modal} onClick={(e) => e.stopPropagation()}>
                            <div style={modalHeader}>
                                <h2 style={{ fontSize: '22px', fontWeight: 900, color: '#263A99', margin: 0 }}>
                                    {formData.id ? 'Редагувати співробітника' : 'Новий співробітник'}
                                </h2>
                                <button onClick={() => setIsFormOpen(false)} style={closeBtn}>
                                    <X size={24} />
                                </button>
                            </div>

                            <form onSubmit={handleSave} style={{ padding: '24px 32px', overflowY: 'auto', flex: 1 }}>
                                <div style={{ display: 'grid', gap: '20px' }}>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                                        <div>
                                            <label style={labelStyle}>Ім'я та Прізвище *</label>
                                            <input
                                                type="text"
                                                value={formData.name}
                                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                                placeholder="Олена Ковальчук"
                                                required
                                                style={inputStyle}
                                            />
                                        </div>
                                        <div>
                                            <label style={labelStyle}>Email *</label>
                                            <input
                                                type="email"
                                                value={formData.email}
                                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                                placeholder="olena@touchmemories.com"
                                                required
                                                style={inputStyle}
                                            />
                                        </div>
                                    </div>

                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                                        <div>
                                            <label style={labelStyle}>Телефон</label>
                                            <input
                                                type="tel"
                                                value={formData.phone || ''}
                                                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                                placeholder="+380 XX XXX XX XX"
                                                style={inputStyle}
                                            />
                                        </div>
                                        <div>
                                            <label style={labelStyle}>Роль *</label>
                                            <select
                                                value={formData.role_id}
                                                onChange={(e) => setFormData({ ...formData, role_id: e.target.value })}
                                                style={inputStyle}
                                                required
                                            >
                                                <option value="">Виберіть роль</option>
                                                {roles.map((r) => (
                                                    <option key={r.id} value={r.id}>
                                                        {r.name}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>

                                    <div>
                                        <label style={labelStyle}>Колір аватару *</label>
                                        <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                                            {COLORS.map((color) => (
                                                <button
                                                    key={color}
                                                    type="button"
                                                    onClick={() => setFormData({ ...formData, color })}
                                                    style={{
                                                        width: '40px',
                                                        height: '40px',
                                                        borderRadius: '3px',
                                                        backgroundColor: color,
                                                        border:
                                                            formData.color === color
                                                                ? '3px solid #263A99'
                                                                : '3px solid transparent',
                                                        cursor: 'pointer',
                                                        transition: 'all 0.2s',
                                                        transform: formData.color === color ? 'scale(1.1)' : 'scale(1)'
                                                    }}
                                                />
                                            ))}
                                        </div>
                                    </div>

                                    <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '20px' }}>
                                        <h3 style={{ fontSize: '14px', fontWeight: 800, color: '#263A99', marginBottom: '16px' }}>
                                            Ставки оплати
                                        </h3>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
                                            <div>
                                                <label style={labelStyle}>За день (₴)</label>
                                                <input
                                                    type="number"
                                                    value={formData.daily_base_rate || 0}
                                                    onChange={(e) =>
                                                        setFormData({
                                                            ...formData,
                                                            daily_base_rate: Number(e.target.value)
                                                        })
                                                    }
                                                    placeholder="0"
                                                    style={inputStyle}
                                                />
                                            </div>
                                            <div>
                                                <label style={labelStyle}>Відсоток (%)</label>
                                                <input
                                                    type="number"
                                                    value={formData.commission_percentage || 0}
                                                    onChange={(e) =>
                                                        setFormData({
                                                            ...formData,
                                                            commission_percentage: Number(e.target.value)
                                                        })
                                                    }
                                                    placeholder="0"
                                                    style={inputStyle}
                                                />
                                            </div>
                                            <div>
                                                <label style={labelStyle}>За продукт (₴)</label>
                                                <input
                                                    type="number"
                                                    value={formData.piece_rate || 0}
                                                    onChange={(e) =>
                                                        setFormData({
                                                            ...formData,
                                                            piece_rate: Number(e.target.value)
                                                        })
                                                    }
                                                    placeholder="0"
                                                    style={inputStyle}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px', paddingTop: '16px', borderTop: '1px solid #f1f5f9', position: 'sticky', bottom: 0, background: '#fff', zIndex: 1 }}>
                                    <button type="button" onClick={() => setIsFormOpen(false)} style={cancelBtn}>
                                        Скасувати
                                    </button>
                                    <button type="submit" disabled={isSaving} style={saveBtn}>
                                        {isSaving ? (
                                            <>
                                                <Loader2 className="animate-spin" size={18} />
                                                Збереження...
                                            </>
                                        ) : (
                                            <>
                                                <Save size={18} />
                                                Зберегти
                                            </>
                                        )}
                                    </button>
                                </div>
                            </form>
                    </div>
                </>
            )}
        </div>
    );
}

// Styles
const addButton = {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '12px 24px',
    backgroundColor: '#263A99',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    fontSize: '15px',
    fontWeight: 700,
    cursor: 'pointer',
    boxShadow: '0 4px 16px rgba(38, 58, 153, 0.35)',
    transition: 'all 0.2s'
};

const statsGrid = {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '24px',
    marginBottom: '48px'
};

const statCard = {
    backgroundColor: 'white',
    padding: '28px',
    borderRadius: '3px',
    border: '1.5px solid #f1f5f9',
    display: 'flex',
    alignItems: 'center',
    gap: '20px',
    boxShadow: '0 4px 20px rgba(0,0,0,0.02)'
};

const iconWrapper = {
    width: '56px',
    height: '56px',
    borderRadius: '3px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
};

const statLabel = {
    fontSize: '12px',
    fontWeight: 800,
    color: '#94a3b8',
    textTransform: 'uppercase' as any,
    letterSpacing: '0.05em',
    marginBottom: '6px'
};

const statValue = {
    fontSize: '28px',
    fontWeight: 900,
    color: '#263A99',
    marginBottom: '4px'
};

const statSubtext = {
    fontSize: '13px',
    color: '#64748b',
    fontWeight: 600
};

const cardsGrid = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))',
    gap: '24px'
};

const memberCard = {
    backgroundColor: 'white',
    padding: '24px',
    borderRadius: '3px',
    border: '1.5px solid #f1f5f9',
    boxShadow: '0 4px 20px rgba(0,0,0,0.02)',
    transition: 'all 0.3s'
};

const contactRow = {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '13px',
    color: '#64748b',
    fontWeight: 600
};

const miniStatLabel = {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    fontSize: '10px',
    fontWeight: 700,
    color: '#94a3b8',
    textTransform: 'uppercase' as any,
    marginBottom: '4px'
};

const miniStatValue = {
    fontSize: '16px',
    fontWeight: 900,
    color: '#263A99'
};

const actionBtnPrimary = {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    padding: '10px 16px',
    backgroundColor: '#f8fafc',
    color: '#475569',
    border: '1px solid #e2e8f0',
    borderRadius: '3px',
    fontSize: '13px',
    fontWeight: 700,
    cursor: 'pointer',
    transition: 'all 0.2s'
};

const actionBtnSecondary = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '40px',
    height: '40px',
    backgroundColor: '#f8fafc',
    color: '#64748b',
    border: '1px solid #e2e8f0',
    borderRadius: '3px',
    cursor: 'pointer',
    transition: 'all 0.2s',
    textDecoration: 'none'
};

const overlay = {
    position: 'fixed' as any,
    inset: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    backdropFilter: 'blur(4px)',
    zIndex: 998,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '16px'
};

const modal = {
    position: 'relative' as any,
    backgroundColor: 'white',
    borderRadius: '12px',
    width: '90%',
    maxWidth: '700px',
    maxHeight: '90vh',
    display: 'flex',
    flexDirection: 'column' as any,
    boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
    zIndex: 999,
    overflow: 'hidden'
};

const modalHeader = {
    padding: '20px 32px',
    borderBottom: '1.5px solid #f1f5f9',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexShrink: 0
};

const closeBtn = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '40px',
    height: '40px',
    borderRadius: '3px',
    backgroundColor: 'transparent',
    border: 'none',
    color: '#94a3b8',
    cursor: 'pointer',
    transition: 'all 0.2s'
};

const labelStyle = {
    display: 'block',
    fontSize: '13px',
    fontWeight: 700,
    color: '#475569',
    marginBottom: '8px'
};

const inputStyle = {
    width: '100%',
    padding: '12px 16px',
    borderRadius: '3px',
    border: '1.5px solid #e2e8f0',
    backgroundColor: '#f8fafc',
    fontSize: '14px',
    color: '#263A99',
    outline: 'none',
    fontWeight: 600,
    transition: 'all 0.2s'
};

const cancelBtn = {
    padding: '12px 24px',
    backgroundColor: '#f1f5f9',
    color: '#475569',
    border: 'none',
    borderRadius: '3px',
    fontSize: '14px',
    fontWeight: 700,
    cursor: 'pointer',
    transition: 'all 0.2s'
};

const saveBtn = {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '12px 24px',
    backgroundColor: '#263A99',
    color: 'white',
    border: 'none',
    borderRadius: '3px',
    fontSize: '14px',
    fontWeight: 700,
    cursor: 'pointer',
    transition: 'all 0.2s',
    boxShadow: '0 4px 16px rgba(38, 58, 153, 0.35)'
};
