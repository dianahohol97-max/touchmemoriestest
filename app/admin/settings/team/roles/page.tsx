'use client';

import { useState, useEffect } from 'react';
import {
    Plus,
    Edit2,
    Trash2,
    Shield,
    ShieldCheck,
    ShieldAlert,
    Loader2,
    Save,
    X,
    CheckCircle2,
    Users
} from 'lucide-react';
import { toast } from 'sonner';

type PermissionLevel = 'none' | 'view' | 'edit' | 'full';

type Role = {
    id: string;
    name: string;
    slug: string;
    permissions: Record<string, PermissionLevel>;
    is_system: boolean;
    member_count?: number;
};

const PERMISSION_SECTIONS = [
    { id: 'catalog', label: '📦 Каталог', sub: 'Товари, Категорії, Популярні' },
    { id: 'orders', label: '🛒 Замовлення', sub: 'Перегляд, Створення, Редагування' },
    { id: 'customers', label: '👥 Клієнти', sub: 'Перегляд та редагування' },
    { id: 'production', label: '🏭 Виробництво', sub: 'Склад та виробництво' },
    { id: 'finance', label: '💰 Фінанси', sub: 'Витрати, Зарплати, Рахунки' },
    { id: 'marketing', label: '📣 Маркетинг', sub: 'Розсилки, Промокоди' },
    { id: 'content', label: '✍️ Контент', sub: 'Блог, Шаблони, Дизайн' },
    { id: 'settings', label: '⚙️ Налаштування', sub: 'Команда, Інтеграції' },
    { id: 'ai', label: '🤖 AI', sub: 'Chat Inbox, AI Налаштування' },
    { id: 'analytics', label: '📊 Аналітика', sub: 'Dashboard, Звіти' },
];

const ACCESS_LEVELS: { id: PermissionLevel; label: string; color: string }[] = [
    { id: 'none', label: 'Немає доступу', color: '#f1f5f9' },
    { id: 'view', label: 'Перегляд', color: '#dcfce7' },
    { id: 'edit', label: 'Редагування', color: '#fef9c3' },
    { id: 'full', label: 'Повний доступ', color: '#dbeafe' },
];

export default function RolesManagementPage() {
    const [roles, setRoles] = useState<Role[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isEditorOpen, setIsEditorOpen] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [currentRole, setCurrentRole] = useState<Partial<Role> | null>(null);

    useEffect(() => {
        fetchRoles();
    }, []);

    const fetchRoles = async () => {
        setIsLoading(true);
        try {
            const res = await fetch('/api/admin/roles');
            if (!res.ok) throw new Error('Помилка завантаження ролей');
            const data = await res.json();

            // Fetch member counts (optional, for now could be 0 or mocked)
            const rolesWithMeta = data.map((r: Role) => ({ ...r, member_count: 0 }));
            setRoles(rolesWithMeta);
        } catch (error: any) {
            toast.error(error.message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleOpenEditor = (role?: Role) => {
        if (role) {
            setCurrentRole(role);
        } else {
            setCurrentRole({
                name: '',
                permissions: PERMISSION_SECTIONS.reduce((acc, section) => ({ ...acc, [section.id]: 'none' }), {}),
                is_system: false
            });
        }
        setIsEditorOpen(true);
    };

    const handleSaveRole = async () => {
        if (!currentRole?.name) {
            toast.error('Введіть назву ролі');
            return;
        }

        setIsSaving(true);
        try {
            const method = currentRole.id ? 'PATCH' : 'POST';
            const res = await fetch('/api/admin/roles', {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(currentRole)
            });

            if (!res.ok) throw new Error('Помилка збереження');

            toast.success('Роль збережено');
            setIsEditorOpen(false);
            fetchRoles();
        } catch (error: any) {
            toast.error(error.message);
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteRole = async (id: string) => {
        if (!confirm('Ви дійсно хочете видалити цю роль?')) return;

        try {
            const res = await fetch(`/api/admin/roles?id=${id}`, { method: 'DELETE' });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || 'Помилка видалення');
            }
            toast.success('Роль видалено');
            fetchRoles();
        } catch (error: any) {
            toast.error(error.message);
        }
    };

    const setAllPermissions = (level: PermissionLevel) => {
        if (!currentRole) return;
        const newPermissions = { ...currentRole.permissions };
        PERMISSION_SECTIONS.forEach(section => {
            newPermissions[section.id] = level;
        });
        setCurrentRole({ ...currentRole, permissions: newPermissions });
    };

    return (
        <div style={{ padding: '32px', maxWidth: '1200px', margin: '0 auto', fontFamily: 'var(--font-primary)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
                <div>
                    <h1 style={{ fontSize: '32px', fontWeight: 800, color: '#263A99', marginBottom: '8px' }}>Ролі та права доступу</h1>
                    <p style={{ color: '#64748b' }}>Керуйте рівнями доступу для вашої команди</p>
                </div>
                <button
                    onClick={() => handleOpenEditor()}
                    style={primaryBtnStyle}
                >
                    <Plus size={20} />
                    Додати роль
                </button>
            </div>

            {/* Role List Case */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '20px' }}>
                {isLoading ? (
                    <div style={{ gridColumn: '1/-1', display: 'flex', justifyContent: 'center', padding: '100px' }}>
                        <Loader2 className="animate-spin" size={40} color="#94a3b8" />
                    </div>
                ) : (
                    roles.map(role => (
                        <div key={role.id} style={roleCardStyle}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <div style={{
                                        width: '44px', height: '44px', borderRadius: "3px",
                                        backgroundColor: role.is_system ? '#f8fafc' : '#eff6ff',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        color: role.is_system ? '#94a3b8' : '#263A99',
                                        border: '1px solid #e2e8f0'
                                    }}>
                                        {role.is_system ? <Shield size={24} /> : <ShieldCheck size={24} />}
                                    </div>
                                    <div>
                                        <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#263A99' }}>{role.name}</h3>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#64748b' }}>
                                            <Users size={14} />
                                            {role.member_count || 0} співробітників
                                        </div>
                                    </div>
                                </div>
                                {!role.is_system && (
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                        <button onClick={() => handleOpenEditor(role)} style={iconBtnStyle} title="Редагувати"><Edit2 size={16} /></button>
                                        <button onClick={() => handleDeleteRole(role.id)} style={iconBtnStyleRed} title="Видалити"><Trash2 size={16} /></button>
                                    </div>
                                )}
                                {role.is_system && (
                                    <span style={{ fontSize: '11px', fontWeight: 800, color: '#94a3b8', backgroundColor: '#f1f5f9', padding: '4px 8px', borderRadius: "3px", textTransform: 'uppercase' }}>Системна</span>
                                )}
                            </div>

                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                {Object.entries(role.permissions).slice(0, 5).map(([key, value]) => (
                                    <div key={key} style={{
                                        fontSize: '11px', fontWeight: 600, padding: '4px 8px', borderRadius: "3px",
                                        backgroundColor: value === 'none' ? '#f8fafc' : value === 'full' ? '#dbeafe' : '#f1f5f9',
                                        color: value === 'none' ? '#94a3b8' : value === 'full' ? '#1e40af' : '#475569'
                                    }}>
                                        {PERMISSION_SECTIONS.find(s => s.id === key)?.label.split(' ')[1]}: {ACCESS_LEVELS.find(al => al.id === value)?.label}
                                    </div>
                                ))}
                                {Object.keys(role.permissions).length > 5 && (
                                    <div style={{ fontSize: '11px', fontWeight: 600, color: '#94a3b8', padding: '4px 8px' }}>+{Object.keys(role.permissions).length - 5} ще</div>
                                )}
                            </div>

                            <button
                                onClick={() => handleOpenEditor(role)}
                                style={{
                                    width: '100%', marginTop: '20px', padding: '10px',
                                    backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: "3px",
                                    fontSize: '14px', fontWeight: 700, color: '#475569', cursor: 'pointer',
                                    transition: 'all 0.2s'
                                }}
                            >
                                {role.is_system ? 'Переглянути права' : 'Налаштувати права'}
                            </button>
                        </div>
                    ))
                )}
            </div>

            {/* Editor Modal */}
            {isEditorOpen && currentRole && (
                <div style={modalOverlayStyle} onClick={() => setIsEditorOpen(false)}>
                    <div style={modalContentStyle} onClick={e => e.stopPropagation()}>
                        <div style={modalHeaderStyle}>
                            <div>
                                <h2 style={{ fontSize: '24px', fontWeight: 800, color: '#263A99', marginBottom: '4px' }}>
                                    {currentRole.id ? 'Редагування ролі' : 'Нова роль'}
                                </h2>
                                <p style={{ color: '#64748b' }}>Налаштуйте рівні доступу до розділів системи</p>
                            </div>
                            <button onClick={() => setIsEditorOpen(false)} style={closeBtnStyle}><X size={24} /></button>
                        </div>

                        <div style={{ padding: '32px', overflowY: 'auto', maxHeight: 'calc(90vh - 180px)' }}>
                            <div style={{ marginBottom: '32px' }}>
                                <label style={labelStyle}>Назва ролі</label>
                                <input
                                    type="text"
                                    value={currentRole.name}
                                    onChange={e => setCurrentRole({ ...currentRole, name: e.target.value })}
                                    style={inputStyle}
                                    placeholder="Напр. Менеджер з продажу"
                                    disabled={currentRole.is_system}
                                />
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                                <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#263A99' }}>Матриця прав</h3>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                    <button onClick={() => setAllPermissions('full')} style={smallBtnStyle} disabled={currentRole.is_system}>Виділити все</button>
                                    <button onClick={() => setAllPermissions('none')} style={smallBtnStyle} disabled={currentRole.is_system}>Зняти все</button>
                                </div>
                            </div>

                            <div style={tableCaseStyle}>
                                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                    <thead style={{ position: 'sticky', top: 0, backgroundColor: 'white', zIndex: 10 }}>
                                        <tr style={{ textAlign: 'left', fontSize: '12px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                            <th style={{ padding: '16px', fontWeight: 700 }}>Розділ</th>
                                            {ACCESS_LEVELS.map(al => (
                                                <th key={al.id} style={{ padding: '16px', textAlign: 'center', fontWeight: 700 }}>{al.label}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {PERMISSION_SECTIONS.map(section => (
                                            <tr key={section.id} style={{ borderTop: '1px solid #f1f5f9' }}>
                                                <td style={{ padding: '16px' }}>
                                                    <div style={{ fontWeight: 700, color: '#263A99', fontSize: '14px' }}>{section.label}</div>
                                                    <div style={{ fontSize: '12px', color: '#94a3b8' }}>{section.sub}</div>
                                                </td>
                                                {ACCESS_LEVELS.map(al => (
                                                    <td key={al.id} style={{ padding: '16px', textAlign: 'center' }}>
                                                        <input
                                                            type="radio"
                                                            name={`perm-${section.id}`}
                                                            checked={(currentRole.permissions as any)?.[section.id] === al.id}
                                                            onChange={() => {
                                                                if (!currentRole.is_system) {
                                                                    const perms = { ...(currentRole.permissions || {}) };
                                                                    perms[section.id] = al.id;
                                                                    setCurrentRole({ ...currentRole, permissions: perms });
                                                                }
                                                            }}
                                                            disabled={currentRole.is_system}
                                                            style={{ width: '18px', height: '18px', cursor: currentRole.is_system ? 'default' : 'pointer' }}
                                                        />
                                                    </td>
                                                ))}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <div style={modalFooterStyle}>
                            <button onClick={() => setIsEditorOpen(false)} style={secondaryBtnStyle}>Скасувати</button>
                            {!currentRole.is_system && (
                                <button
                                    onClick={handleSaveRole}
                                    disabled={isSaving}
                                    style={isSaving ? primaryBtnDisabledStyle : primaryBtnStyle}
                                >
                                    {isSaving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                                    Зберегти роль
                                </button>
                            )}
                            {currentRole.is_system && (
                                <div style={{ color: '#64748b', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <ShieldAlert size={16} /> Системні ролі не можна змінювати
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// Styles
const primaryBtnStyle = { display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 24px', backgroundColor: '#263A99', color: 'white', borderRadius: "3px", fontWeight: 700, border: 'none', cursor: 'pointer', transition: 'all 0.2s' };
const primaryBtnDisabledStyle = { ...primaryBtnStyle, opacity: 0.7, cursor: 'not-allowed' };
const secondaryBtnStyle = { padding: '12px 24px', backgroundColor: 'transparent', color: '#64748b', borderRadius: "3px", fontWeight: 700, border: '1px solid #e2e8f0', cursor: 'pointer' };
const iconBtnStyle = { width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: "3px", border: '1px solid #e2e8f0', color: '#64748b', cursor: 'pointer', background: 'white' };
const iconBtnStyleRed = { ...iconBtnStyle, color: '#ef4444', border: '1px solid #fee2e2' };
const smallBtnStyle = { padding: '4px 12px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: "3px", fontSize: '11px', fontWeight: 700, color: '#64748b', cursor: 'pointer' };

const roleCardStyle = { backgroundColor: 'white', borderRadius: "3px", padding: '24px', border: '1px solid #f1f5f9', boxShadow: '0 4px 20px rgba(0,0,0,0.02)', display: 'flex', flexDirection: 'column' as const, justifyContent: 'space-between' };

const modalOverlayStyle: React.CSSProperties = { position: 'fixed', inset: 0, backgroundColor: 'rgba(38, 58, 153, 0.6)', backdropFilter: 'blur(8px)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' };
const modalContentStyle: React.CSSProperties = { backgroundColor: 'white', borderRadius: "3px", width: '90%', maxWidth: '800px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' };
const modalHeaderStyle = { padding: '32px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' };
const modalFooterStyle = { padding: '24px 32px', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'flex-end', gap: '16px' };
const closeBtnStyle = { background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '4px' };

const tableCaseStyle = { border: '1px solid #f1f5f9', borderRadius: "3px", overflow: 'hidden' };
const labelStyle = { display: 'block', fontSize: '13px', fontWeight: 700, color: '#475569', marginBottom: '8px' };
const inputStyle = { width: '100%', padding: '12px 16px', borderRadius: "3px", border: '1.5px solid #e2e8f0', outline: 'none', fontSize: '15px' };
