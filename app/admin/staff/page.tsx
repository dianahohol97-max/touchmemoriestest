'use client';

import { useState, useEffect } from 'react';
import { Plus, Edit2, UserX, UserCheck, Loader2, Save, X } from 'lucide-react';
import { toast } from 'sonner';

type PermissionLevel = 'none' | 'view' | 'edit' | 'full';

type Staff = {
    id: string;
    name: string;
    email: string;
    role: string;
    role_id?: string;
    individual_permissions?: Record<string, PermissionLevel>;
    color: string;
    initials: string;
    is_active: boolean;
    created_at: string;
    active_orders?: number;
    daily_base_rate?: number;
    commission_percentage?: number;
    piece_rate?: number;
};

type Role = {
    id: string;
    name: string;
    permissions: Record<string, PermissionLevel>;
};

const PERMISSION_SECTIONS = [
    { id: 'catalog', label: '📦 Каталог' },
    { id: 'orders', label: '🛒 Замовлення' },
    { id: 'customers', label: '👥 Клієнти' },
    { id: 'production', label: '🏭 Виробництво' },
    { id: 'finance', label: '💰 Фінанси' },
    { id: 'marketing', label: '📣 Маркетинг' },
    { id: 'content', label: '✍️ Контент' },
    { id: 'settings', label: '⚙️ Налаштування' },
    { id: 'ai', label: '🤖 AI' },
    { id: 'analytics', label: '📊 Аналітика' },
];

const ACCESS_LEVELS: { id: PermissionLevel; label: string }[] = [
    { id: 'none', label: 'Немає' },
    { id: 'view', label: 'Перегляд' },
    { id: 'edit', label: 'Ред.' },
    { id: 'full', label: 'Повний' },
];

const ROLES = [
    { value: 'manager', label: 'Менеджер' },
    { value: 'designer', label: 'Дизайнер' },
    { value: 'admin', label: 'Адміністратор' }
];

const COLORS = [
    '#263A99', '#ef4444', '#10b981', '#f59e0b', '#6366f1',
    '#ec4899', '#8b5cf6', '#14b8a6', '#f43f5e', '#84cc16'
];

export default function StaffManagementPage() {
    const [staff, setStaff] = useState<Staff[]>([]);
    const [roles, setRoles] = useState<Role[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [hasIndividualOverride, setHasIndividualOverride] = useState(false);

    const [formData, setFormData] = useState<Partial<Staff>>({
        name: '',
        email: '',
        role: '',
        role_id: '',
        individual_permissions: {},
        color: COLORS[0],
        is_active: true,
        daily_base_rate: 0,
        commission_percentage: 0,
        piece_rate: 0
    });

    useEffect(() => {
        fetchStaff();
        fetchRoles();
    }, []);

    const fetchRoles = async () => {
        try {
            const res = await fetch('/api/admin/roles');
            if (res.ok) {
                const data = await res.json();
                setRoles(data);
            }
        } catch (error) {
            console.error('Error fetching roles:', error);
        }
    };

    const fetchStaff = async () => {
        setIsLoading(true);
        try {
            // Fetch staff
            const res = await fetch('/api/admin/staff');
            if (!res.ok) throw new Error('Помилка завантаження співробітників');
            let data = await res.json();

            // Optionally, we could fetch active order counts here via a custom endpoint
            // For now, defaulting to 0 or null unless handled by the backend
            data = data.map((d: any) => ({ ...d, active_orders: 0 }));

            setStaff(data);
        } catch (error: any) {
            toast.error(error.message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        try {
            const method = formData.id ? 'PATCH' : 'POST';
            const res = await fetch('/api/admin/staff', {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });
            if (!res.ok) throw new Error('Помилка збереження');

            toast.success('Співробітника збережено');
            setIsFormOpen(false);
            setFormData({ name: '', email: '', role: 'manager', color: COLORS[0], is_active: true, daily_base_rate: 0, commission_percentage: 0, piece_rate: 0 });
            fetchStaff();
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
            toast.success(member.is_active ? 'Співробітника деактивовано' : 'Співробітника активовано');
            fetchStaff();
        } catch (error: any) {
            toast.error(error.message);
        }
    };

    const getRoleLabel = (member: Staff) => {
        const dbRole = roles.find(r => r.id === member.role_id);
        if (dbRole) return dbRole.name;
        // Fallback to old role string
        const oldRole = ROLES.find(r => r.value === member.role);
        return oldRole?.label || member.role || 'Не вказано';
    };

    return (
        <div style={{ padding: '32px', maxWidth: '1200px', margin: '0 auto', fontFamily: 'var(--font-primary)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
                <div>
                    <h1 style={{ fontSize: '32px', fontWeight: 800, color: '#263A99', marginBottom: '8px' }}>Команда</h1>
                    <p style={{ color: '#64748b' }}>Управління менеджерами та дизайнерами</p>
                </div>
                <button
                    onClick={() => {
                        setFormData({
                            name: '', email: '', role: '', role_id: roles[0]?.id || '',
                            individual_permissions: {}, color: COLORS[0], is_active: true,
                            daily_base_rate: 0, commission_percentage: 0, piece_rate: 0
                        });
                        setHasIndividualOverride(false);
                        setIsFormOpen(true);
                    }}
                    style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 24px', backgroundColor: '#263A99', color: 'white', borderRadius: '3px', fontWeight: 600, border: 'none', cursor: 'pointer', transition: 'background 0.2s', ':hover': { backgroundColor: '#263A99' } } as any}
                >
                    <Plus size={20} />
                    Додати співробітника
                </button>
            </div>

            {/* List */}
            <div style={{ backgroundColor: 'white', borderRadius: '3px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                {isLoading ? (
                    <div style={{ padding: '60px', display: 'flex', justifyContent: 'center', color: '#94a3b8' }}>
                        <Loader2 className="animate-spin" size={32} />
                    </div>
                ) : staff.length === 0 ? (
                    <div style={{ padding: '60px', textAlign: 'center', color: '#64748b' }}>
                        Ще немає співробітників
                    </div>
                ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left', fontSize: '13px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                <th style={{ padding: '16px 24px' }}>Співробітник</th>
                                <th style={{ padding: '16px 24px' }}>Роль</th>
                                <th style={{ padding: '16px 24px' }}>Email</th>
                                <th style={{ padding: '16px 24px' }}>Статус</th>
                                {/* <th style={{ padding: '16px 24px', textAlign: 'center' }}>Активні Замовл.</th> */}
                                <th style={{ padding: '16px 24px', textAlign: 'right' }}>Дії</th>
                            </tr>
                        </thead>
                        <tbody>
                            {staff.map((member) => (
                                <tr key={member.id} style={{ borderBottom: '1px solid #f1f5f9', opacity: member.is_active ? 1 : 0.6 }}>
                                    <td style={{ padding: '16px 24px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                            <div style={{ width: '40px', height: '40px', borderRadius: '3px', backgroundColor: member.color, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: '14px', flexShrink: 0 }}>
                                                {member.initials}
                                            </div>
                                            <div>
                                                <div style={{ fontWeight: 700, color: '#263A99', fontSize: '15px' }}>{member.name}</div>
                                                {/* Optional subtitle */}
                                            </div>
                                        </div>
                                    </td>
                                    <td style={{ padding: '16px 24px' }}>
                                        <span style={{ padding: '4px 12px', backgroundColor: '#f1f5f9', color: '#475569', borderRadius: '3px', fontSize: '13px', fontWeight: 600 }}>
                                            {getRoleLabel(member)}
                                        </span>
                                    </td>
                                    <td style={{ padding: '16px 24px', color: '#64748b', fontSize: '14px' }}>
                                        {member.email}
                                    </td>
                                    <td style={{ padding: '16px 24px' }}>
                                        <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 600, color: member.is_active ? '#10b981' : '#94a3b8' }}>
                                            <div style={{ width: '8px', height: '8px', borderRadius: '3px', backgroundColor: member.is_active ? '#10b981' : '#cbd5e1' }} />
                                            {member.is_active ? 'Активний' : 'Деактивовано'}
                                        </span>
                                    </td>
                                    {/* <td style={{ padding: '16px 24px', textAlign: 'center', fontWeight: 600, color: '#475569' }}>
                                        {member.active_orders}
                                    </td> */}
                                    <td style={{ padding: '16px 24px', textAlign: 'right' }}>
                                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                                            <button
                                                onClick={() => {
                                                    setFormData(member);
                                                    setHasIndividualOverride(Object.keys(member.individual_permissions || {}).length > 0);
                                                    setIsFormOpen(true);
                                                }}
                                                style={{ width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '3px', backgroundColor: '#f8fafc', color: '#64748b', border: 'none', cursor: 'pointer', transition: 'all 0.2s', ':hover': { backgroundColor: '#e2e8f0', color: '#263A99' } } as any}
                                                title="Редагувати"
                                            >
                                                <Edit2 size={16} />
                                            </button>
                                            <button
                                                onClick={() => toggleStatus(member)}
                                                style={{ width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '3px', backgroundColor: member.is_active ? '#fef2f2' : '#ecfdf5', color: member.is_active ? '#ef4444' : '#10b981', border: 'none', cursor: 'pointer', transition: 'all 0.2s' }}
                                                title={member.is_active ? "Деактивувати" : "Активувати"}
                                            >
                                                {member.is_active ? <UserX size={16} /> : <UserCheck size={16} />}
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Form Modal */}
            {isFormOpen && (
                <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15,23,42,0.4)', backdropFilter: 'blur(4px)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setIsFormOpen(false)}>
                    <div style={{ backgroundColor: 'white', borderRadius: '3px', width: '100%', maxWidth: '500px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', overflow: 'hidden' }} onClick={e => e.stopPropagation()}>
                        <div style={{ padding: '24px 32px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#263A99' }}>
                                {formData.id ? 'Редагувати співробітника' : 'Новий співробітник'}
                            </h2>
                            <button onClick={() => setIsFormOpen(false)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '4px' }}>
                                <X size={20} />
                            </button>
                        </div>
                        <form onSubmit={handleSave} style={{ padding: '32px' }}>
                            <div style={{ display: 'grid', gap: '20px' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#475569', marginBottom: '8px' }}>Ім&apos;я та Прізвище *</label>
                                    <input
                                        type="text"
                                        value={formData.name}
                                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                                        placeholder="Напр. Олена Ковальчук"
                                        required
                                        style={inputStyle}
                                    />
                                </div>

                                <div>
                                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#475569', marginBottom: '8px' }}>Email *</label>
                                    <input
                                        type="email"
                                        value={formData.email}
                                        onChange={e => setFormData({ ...formData, email: e.target.value })}
                                        placeholder="olena@touchmemories.com.ua"
                                        required
                                        style={inputStyle}
                                    />
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#475569', marginBottom: '8px' }}>Роль *</label>
                                        <select
                                            value={formData.role_id}
                                            onChange={e => setFormData({ ...formData, role_id: e.target.value })}
                                            style={inputStyle}
                                        >
                                            <option value="">Виберіть роль</option>
                                            {roles.map(r => (
                                                <option key={r.id} value={r.id}>{r.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#475569', marginBottom: '8px' }}>Ініціали (необов&apos;язково)</label>
                                        <input
                                            type="text"
                                            value={formData.initials || ''}
                                            onChange={e => setFormData({ ...formData, initials: e.target.value.substring(0, 2).toUpperCase() })}
                                            placeholder="ОК"
                                            maxLength={2}
                                            style={inputStyle}
                                        />
                                    </div>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '20px', marginBottom: '20px' }}>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#475569', marginBottom: '8px' }}>Ставка за день (₴)</label>
                                        <input
                                            type="number"
                                            value={formData.daily_base_rate || 0}
                                            onChange={e => setFormData({ ...formData, daily_base_rate: Number(e.target.value) })}
                                            placeholder="0"
                                            style={inputStyle}
                                        />
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#475569', marginBottom: '8px' }}>Відсоток (%)</label>
                                        <input
                                            type="number"
                                            value={formData.commission_percentage || 0}
                                            onChange={e => setFormData({ ...formData, commission_percentage: Number(e.target.value) })}
                                            placeholder="0"
                                            style={inputStyle}
                                        />
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#475569', marginBottom: '8px' }}>Ставка за 1 продукт (₴)</label>
                                        <input
                                            type="number"
                                            value={formData.piece_rate || 0}
                                            onChange={e => setFormData({ ...formData, piece_rate: Number(e.target.value) })}
                                            placeholder="0"
                                            style={inputStyle}
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#475569', marginBottom: '12px' }}>Колір аватару *</label>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
                                        {COLORS.map(color => (
                                            <button
                                                key={color}
                                                type="button"
                                                onClick={() => setFormData({ ...formData, color })}
                                                style={{ width: '40px', height: '40px', borderRadius: '3px', backgroundColor: color, border: formData.color === color ? '3px solid #263A99' : '3px solid transparent', cursor: 'pointer', transition: 'transform 0.2s', transform: formData.color === color ? 'scale(1.1)' : 'scale(1)' }}
                                            />
                                        ))}
                                    </div>
                                </div>

                                <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '20px', marginTop: '10px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                                        <h3 style={{ fontSize: '14px', fontWeight: 800, color: '#263A99' }}>Індивідуальні налаштування доступу</h3>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const override = !hasIndividualOverride;
                                                setHasIndividualOverride(override);
                                                if (!override) setFormData({ ...formData, individual_permissions: {} });
                                                else {
                                                    const selectedRole = roles.find(r => r.id === formData.role_id);
                                                    setFormData({ ...formData, individual_permissions: selectedRole?.permissions || {} });
                                                }
                                            }}
                                            style={{
                                                fontSize: '12px', padding: '4px 12px', borderRadius: '3px', cursor: 'pointer',
                                                backgroundColor: hasIndividualOverride ? '#fee2e2' : '#f8fafc',
                                                color: hasIndividualOverride ? '#ef4444' : '#64748b',
                                                border: '1px solid #e2e8f0', fontWeight: 700
                                            }}
                                        >
                                            {hasIndividualOverride ? 'Вимкнути' : 'Увімкнути'}
                                        </button>
                                    </div>

                                    {hasIndividualOverride && (
                                        <div style={{ maxHeight: '200px', overflowY: 'auto', border: '1px solid #f1f5f9', borderRadius: '3px', padding: '12px' }}>
                                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                                                <thead>
                                                    <tr style={{ textAlign: 'left', color: '#64748b' }}>
                                                        <th style={{ padding: '8px' }}>Розділ</th>
                                                        {ACCESS_LEVELS.map(al => <th key={al.id} style={{ padding: '8px', textAlign: 'center' }}>{al.label}</th>)}
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {PERMISSION_SECTIONS.map(section => (
                                                        <tr key={section.id} style={{ borderTop: '1px solid #f1f5f9' }}>
                                                            <td style={{ padding: '8px', fontWeight: 600 }}>{section.label}</td>
                                                            {ACCESS_LEVELS.map(al => (
                                                                <td key={al.id} style={{ padding: '8px', textAlign: 'center' }}>
                                                                    <input
                                                                        type="radio"
                                                                        name={`override-${section.id}`}
                                                                        checked={formData.individual_permissions?.[section.id] === al.id}
                                                                        onChange={() => {
                                                                            const perms = { ...(formData.individual_permissions || {}) };
                                                                            perms[section.id] = al.id;
                                                                            setFormData({ ...formData, individual_permissions: perms });
                                                                        }}
                                                                        style={{ cursor: 'pointer' }}
                                                                    />
                                                                </td>
                                                            ))}
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </div>

                            </div>

                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '40px' }}>
                                <button type="button" onClick={() => setIsFormOpen(false)} style={{ padding: '12px 24px', backgroundColor: '#f1f5f9', color: '#475569', borderRadius: '3px', fontWeight: 600, border: 'none', cursor: 'pointer' }}>
                                    Скасувати
                                </button>
                                <button type="submit" disabled={isSaving} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 24px', backgroundColor: '#263A99', color: 'white', borderRadius: '3px', fontWeight: 600, border: 'none', cursor: 'pointer', opacity: isSaving ? 0.7 : 1 }}>
                                    {isSaving ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
                                    Зберегти
                                </button>
                            </div>
                        </form>
                    </div >
                </div >
            )
            }
        </div >
    );
}

const inputStyle = {
    width: '100%',
    padding: '12px 16px',
    borderRadius: '3px',
    border: '1px solid #e2e8f0',
    backgroundColor: '#f8fafc',
    fontSize: '14px',
    color: '#263A99',
    outline: 'none',
    transition: 'all 0.2s'
};
