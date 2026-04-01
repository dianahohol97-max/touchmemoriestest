'use client';
import { useState, useEffect, createPortal} from 'react';
import { createClient } from '@/lib/supabase/client';
import {
    Zap,
    Activity,
    Play,
    Pause,
    Plus,
    ArrowRight,
    MessageSquare,
    Mail,
    RefreshCw,
    CheckCircle2,
    XCircle,
    Clock,
    Edit,
    Trash2,
    Save,
    X,
    Calendar,
    DollarSign,
    Package,
    Gift,
    AlertCircle
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface AutomationRule {
    id: string;
    name: string;
    description: string;
    trigger_type: string;
    trigger_value: string | null;
    action_type: string;
    action_template: string;
    action_value: string | null;
    is_active: boolean;
    delay_hours: number;
    execution_count: number;
    last_triggered_at: string | null;
    last_status: string | null;
    last_error: string | null;
}

const TRIGGER_TYPES = [
    { id: 'order_status_changed', label: 'Статус замовлення змінено', icon: <Package size={16} />, color: '#263A99' },
    { id: 'payment_received', label: 'Оплата отримана', icon: <DollarSign size={16} />, color: '#22c55e' },
    { id: 'order_created', label: 'Створено замовлення', icon: <Plus size={16} />, color: '#6366f1' },
    { id: 'birthday', label: 'День народження', icon: <Gift size={16} />, color: '#ec4899' }
];

const ACTION_TYPES = [
    { id: 'send_sms', label: 'Надіслати SMS', icon: <MessageSquare size={16} />, color: '#14b8a6' },
    { id: 'send_email', label: 'Надіслати Email', icon: <Mail size={16} />, color: '#6366f1' },
    { id: 'change_order_status', label: 'Змінити статус', icon: <RefreshCw size={16} />, color: '#f59e0b' },
    { id: 'create_task', label: 'Створити задачу', icon: <CheckCircle2 size={16} />, color: '#a855f7' }
];

export default function AutomationsPage() {
    const supabase = createClient();

    const [rules, setRules] = useState<AutomationRule[]>([]);
    const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [editingRule, setEditingRule] = useState<AutomationRule | null>(null);
    const [logs, setLogs] = useState<any[]>([]);
    const [selectedRuleId, setSelectedRuleId] = useState<string | null>(null);

    const [formData, setFormData] = useState({
        name: '',
        description: '',
        trigger_type: 'order_status_changed',
        trigger_value: '',
        action_type: 'send_sms',
        action_template: '',
        action_value: '',
        delay_hours: 0
    });

    useEffect(() => {
        fetchRules();
    }, []);

    const fetchRules = async () => {
        setLoading(true);
        try {
            const { data } = await supabase
                .from('automation_rules')
                .select('*')
                .order('created_at', { ascending: false });

            if (data) {
                setRules(data);
            }
        } catch (error) {
            console.error('Error fetching rules:', error);
            toast.error('Помилка завантаження правил');
        } finally {
            setLoading(false);
        }
    };

    const fetchLogs = async (ruleId: string) => {
        try {
            const { data } = await supabase
                .from('automation_logs')
                .select('*')
                .eq('rule_id', ruleId)
                .order('executed_at', { ascending: false })
                .limit(20);

            if (data) {
                setLogs(data);
            }
        } catch (error) {
            console.error('Error fetching logs:', error);
        }
    };

    const toggleRule = async (ruleId: string, isActive: boolean) => {
        try {
            const { error } = await supabase
                .from('automation_rules')
                .update({ is_active: !isActive, updated_at: new Date().toISOString() })
                .eq('id', ruleId);

            if (error) throw error;

            toast.success(isActive ? 'Правило вимкнено' : 'Правило увімкнено');
            await fetchRules();
        } catch (error) {
            console.error('Error toggling rule:', error);
            toast.error('Помилка зміни статусу');
        }
    };

    const deleteRule = async (ruleId: string) => {
        if (!confirm('Видалити це правило автоматизації?')) return;

        try {
            const { error } = await supabase
                .from('automation_rules')
                .delete()
                .eq('id', ruleId);

            if (error) throw error;

            toast.success('Правило видалено');
            await fetchRules();
        } catch (error) {
            console.error('Error deleting rule:', error);
            toast.error('Помилка видалення');
        }
    };

    const saveRule = async () => {
        if (!formData.name || !formData.action_template) {
            toast.error('Заповніть обов\'язкові поля');
            return;
        }

        try {
            if (editingRule) {
                // Update existing rule
                const { error } = await supabase
                    .from('automation_rules')
                    .update({
                        ...formData,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', editingRule.id);

                if (error) throw error;
                toast.success('Правило оновлено');
            } else {
                // Create new rule
                const { error } = await supabase
                    .from('automation_rules')
                    .insert([formData]);

                if (error) throw error;
                toast.success('Правило створено');
            }

            setShowCreateModal(false);
            setEditingRule(null);
            setFormData({
                name: '',
                description: '',
                trigger_type: 'order_status_changed',
                trigger_value: '',
                action_type: 'send_sms',
                action_template: '',
                action_value: '',
                delay_hours: 0
            });
            await fetchRules();
        } catch (error) {
            console.error('Error saving rule:', error);
            toast.error('Помилка збереження');
        }
    };

    const openEditModal = (rule: AutomationRule) => {
        setEditingRule(rule);
        setFormData({
            name: rule.name,
            description: rule.description || '',
            trigger_type: rule.trigger_type,
            trigger_value: rule.trigger_value || '',
            action_type: rule.action_type,
            action_template: rule.action_template,
            action_value: rule.action_value || '',
            delay_hours: rule.delay_hours || 0
        });
        setShowCreateModal(true);
    };

    const getTriggerLabel = (type: string) => {
        return TRIGGER_TYPES.find(t => t.id === type)?.label || type;
    };

    const getActionLabel = (type: string) => {
        return ACTION_TYPES.find(a => a.id === type)?.label || type;
    };

    const getTriggerIcon = (type: string) => {
        return TRIGGER_TYPES.find(t => t.id === type)?.icon || <Zap size={16} />;
    };

    const getActionIcon = (type: string) => {
        return ACTION_TYPES.find(a => a.id === type)?.icon || <Activity size={16} />;
    };

    if (loading) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '80vh' }}>
                <Activity className="animate-spin" size={48} color="#263A99" />
            </div>
        );
    }

    return (
        <div style={{ maxWidth: '1800px', margin: '0 auto' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
                <div>
                    <h1 style={{ fontSize: '32px', fontWeight: 800, color: '#0f172a', marginBottom: '8px' }}>
                        Автоматизації
                    </h1>
                    <p style={{ color: '#64748b', fontSize: '16px' }}>
                        Налаштування автоматичних дій на події системи
                    </p>
                </div>

                <button
                    onClick={() => {
                        setEditingRule(null);
                        setFormData({
                            name: '',
                            description: '',
                            trigger_type: 'order_status_changed',
                            trigger_value: '',
                            action_type: 'send_sms',
                            action_template: '',
                            action_value: '',
                            delay_hours: 0
                        });
                        setShowCreateModal(true);
                    }}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '12px 24px',
                        backgroundColor: '#263A99',
                        color: 'white',
                        border: 'none',
                        borderRadius: '3px',
                        fontSize: '15px',
                        fontWeight: 600,
                        cursor: 'pointer'
                    }}
                >
                    <Plus size={18} />
                    Нове правило
                </button>
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
                <Zap size={20} color="#263A99" />
                <div>
                    <p style={{ fontSize: '14px', color: '#1e293b', marginBottom: '4px', fontWeight: 600 }}>
                        Доступні змінні шаблонів
                    </p>
                    <p style={{ fontSize: '13px', color: '#475569' }}>
                        <code style={{ backgroundColor: 'white', padding: '2px 6px', borderRadius: '3px', marginRight: '8px' }}>{'{customer_name}'}</code>
                        <code style={{ backgroundColor: 'white', padding: '2px 6px', borderRadius: '3px', marginRight: '8px' }}>{'{order_id}'}</code>
                        <code style={{ backgroundColor: 'white', padding: '2px 6px', borderRadius: '3px', marginRight: '8px' }}>{'{tracking_number}'}</code>
                        <code style={{ backgroundColor: 'white', padding: '2px 6px', borderRadius: '3px', marginRight: '8px' }}>{'{order_total}'}</code>
                        <code style={{ backgroundColor: 'white', padding: '2px 6px', borderRadius: '3px', marginRight: '8px' }}>{'{payment_link}'}</code>
                        <code style={{ backgroundColor: 'white', padding: '2px 6px', borderRadius: '3px' }}>{'{customer_phone}'}</code>
                    </p>
                </div>
            </div>

            {/* Rules Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(450px, 1fr))', gap: '24px' }}>
                {rules.map(rule => (
                    <div
                        key={rule.id}
                        style={{
                            padding: '24px',
                            backgroundColor: 'white',
                            borderRadius: '3px',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                            border: rule.is_active ? '2px solid #22c55e' : '1px solid #e2e8f0',
                            opacity: rule.is_active ? 1 : 0.6
                        }}
                    >
                        {/* Rule Header */}
                        <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'flex-start',
                            marginBottom: '20px'
                        }}>
                            <div style={{ flex: 1 }}>
                                <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#0f172a', marginBottom: '4px' }}>
                                    {rule.name}
                                </h3>
                                {rule.description && (
                                    <p style={{ fontSize: '13px', color: '#64748b' }}>
                                        {rule.description}
                                    </p>
                                )}
                            </div>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <button
                                    onClick={() => toggleRule(rule.id, rule.is_active)}
                                    style={{
                                        padding: '8px',
                                        backgroundColor: rule.is_active ? '#22c55e' : '#94a3b8',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '3px',
                                        cursor: 'pointer'
                                    }}
                                    title={rule.is_active ? 'Вимкнути' : 'Увімкнути'}
                                >
                                    {rule.is_active ? <Play size={16} /> : <Pause size={16} />}
                                </button>
                                <button
                                    onClick={() => openEditModal(rule)}
                                    style={{
                                        padding: '8px',
                                        backgroundColor: '#263A99',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '3px',
                                        cursor: 'pointer'
                                    }}
                                    title="Редагувати"
                                >
                                    <Edit size={16} />
                                </button>
                                <button
                                    onClick={() => deleteRule(rule.id)}
                                    style={{
                                        padding: '8px',
                                        backgroundColor: '#ef4444',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '3px',
                                        cursor: 'pointer'
                                    }}
                                    title="Видалити"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        </div>

                        {/* Trigger → Action Flow */}
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '16px',
                            padding: '16px',
                            backgroundColor: '#f8fafc',
                            borderRadius: '3px',
                            marginBottom: '16px'
                        }}>
                            {/* Trigger */}
                            <div style={{ flex: 1 }}>
                                <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    marginBottom: '4px'
                                }}>
                                    {getTriggerIcon(rule.trigger_type)}
                                    <span style={{ fontSize: '12px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                                        Тригер
                                    </span>
                                </div>
                                <div style={{ fontSize: '14px', fontWeight: 600, color: '#0f172a' }}>
                                    {getTriggerLabel(rule.trigger_type)}
                                </div>
                                {rule.trigger_value && (
                                    <div style={{ fontSize: '13px', color: '#64748b' }}>
                                        → {rule.trigger_value}
                                    </div>
                                )}
                            </div>

                            <ArrowRight size={24} color="#94a3b8" />

                            {/* Action */}
                            <div style={{ flex: 1 }}>
                                <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    marginBottom: '4px'
                                }}>
                                    {getActionIcon(rule.action_type)}
                                    <span style={{ fontSize: '12px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                                        Дія
                                    </span>
                                </div>
                                <div style={{ fontSize: '14px', fontWeight: 600, color: '#0f172a' }}>
                                    {getActionLabel(rule.action_type)}
                                </div>
                                {rule.delay_hours > 0 && (
                                    <div style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '4px',
                                        fontSize: '12px',
                                        color: '#f59e0b',
                                        marginTop: '4px'
                                    }}>
                                        <Clock size={12} />
                                        Затримка: {rule.delay_hours} год
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Template Preview */}
                        <div style={{
                            padding: '12px',
                            backgroundColor: '#fffbeb',
                            border: '1px solid #fef3c7',
                            borderRadius: '3px',
                            marginBottom: '16px'
                        }}>
                            <div style={{ fontSize: '11px', fontWeight: 700, color: '#92400e', marginBottom: '6px', textTransform: 'uppercase' }}>
                                Шаблон повідомлення
                            </div>
                            <div style={{ fontSize: '13px', color: '#78350f', lineHeight: '1.5' }}>
                                {rule.action_template}
                            </div>
                        </div>

                        {/* Execution Stats */}
                        <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            paddingTop: '16px',
                            borderTop: '1px solid #e2e8f0'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <Activity size={14} color="#64748b" />
                                    <span style={{ fontSize: '13px', color: '#64748b' }}>
                                        Виконано: <strong>{rule.execution_count || 0}</strong>
                                    </span>
                                </div>
                                {rule.last_status && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                        {rule.last_status === 'success' ? (
                                            <CheckCircle2 size={14} color="#22c55e" />
                                        ) : (
                                            <XCircle size={14} color="#ef4444" />
                                        )}
                                        <span style={{
                                            fontSize: '12px',
                                            fontWeight: 600,
                                            color: rule.last_status === 'success' ? '#22c55e' : '#ef4444'
                                        }}>
                                            {rule.last_status === 'success' ? 'Успішно' : 'Помилка'}
                                        </span>
                                    </div>
                                )}
                            </div>
                            {rule.last_triggered_at && (
                                <div style={{ fontSize: '12px', color: '#94a3b8' }}>
                                    {format(new Date(rule.last_triggered_at), 'dd.MM.yyyy HH:mm')}
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {rules.length === 0 && (
                <div style={{
                    padding: '80px 40px',
                    textAlign: 'center',
                    backgroundColor: 'white',
                    borderRadius: '3px',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
                }}>
                    <Zap size={48} color="#cbd5e1" style={{ margin: '0 auto 16px' }} />
                    <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#475569', marginBottom: '8px' }}>
                        Немає правил автоматизації
                    </h3>
                    <p style={{ fontSize: '14px', color: '#94a3b8', marginBottom: '24px' }}>
                        Створіть перше правило для автоматизації процесів
                    </p>
                    <button
                        onClick={() => setShowCreateModal(true)}
                        style={{
                            padding: '12px 24px',
                            backgroundColor: '#263A99',
                            color: 'white',
                            border: 'none',
                            borderRadius: '3px',
                            fontSize: '15px',
                            fontWeight: 600,
                            cursor: 'pointer'
                        }}
                    >
                        Створити правило
                    </button>
                </div>
            )}

            {/* Create/Edit Modal */}
            {showCreateModal && mounted && createPortal(
              <div style={{
                    position: 'fixed',
                    inset: 0,
                    backgroundColor: 'rgba(0,0,0,0.5)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 1000
                }} onClick={() => setShowCreateModal(false)}>
                    <div onClick={e => e.stopPropagation()} style={{
                        backgroundColor: 'white',
                        borderRadius: '3px',
                        padding: '40px',
                        width: '700px',
                        maxWidth: '90vw',
                        maxHeight: '90vh',
                        overflow: 'auto',
                        boxShadow: '0 25px 50px rgba(0,0,0,0.2)'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
                            <h2 style={{ fontSize: '24px', fontWeight: 900, margin: 0 }}>
                                {editingRule ? 'Редагувати правило' : 'Нове правило автоматизації'}
                            </h2>
                            <button onClick={() => setShowCreateModal(false)} style={{ border: 'none', background: 'none', cursor: 'pointer' }}>
                                <X size={24} />
                            </button>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                            <div>
                                <label style={labelStyle}>Назва правила *</label>
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                    style={inputStyle}
                                    placeholder="Наприклад: Відправка ТТН"
                                />
                            </div>

                            <div>
                                <label style={labelStyle}>Опис</label>
                                <input
                                    type="text"
                                    value={formData.description}
                                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                                    style={inputStyle}
                                    placeholder="Коротке пояснення правила"
                                />
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                <div>
                                    <label style={labelStyle}>Тригер *</label>
                                    <select
                                        value={formData.trigger_type}
                                        onChange={e => setFormData({ ...formData, trigger_type: e.target.value })}
                                        style={inputStyle}
                                    >
                                        {TRIGGER_TYPES.map(t => (
                                            <option key={t.id} value={t.id}>{t.label}</option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label style={labelStyle}>Значення тригера</label>
                                    <input
                                        type="text"
                                        value={formData.trigger_value}
                                        onChange={e => setFormData({ ...formData, trigger_value: e.target.value })}
                                        style={inputStyle}
                                        placeholder="Наприклад: shipped"
                                    />
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                <div>
                                    <label style={labelStyle}>Дія *</label>
                                    <select
                                        value={formData.action_type}
                                        onChange={e => setFormData({ ...formData, action_type: e.target.value })}
                                        style={inputStyle}
                                    >
                                        {ACTION_TYPES.map(a => (
                                            <option key={a.id} value={a.id}>{a.label}</option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label style={labelStyle}>Затримка (години)</label>
                                    <input
                                        type="number"
                                        value={formData.delay_hours}
                                        onChange={e => setFormData({ ...formData, delay_hours: parseInt(e.target.value) || 0 })}
                                        style={inputStyle}
                                        min="0"
                                    />
                                </div>
                            </div>

                            <div>
                                <label style={labelStyle}>Шаблон повідомлення *</label>
                                <textarea
                                    value={formData.action_template}
                                    onChange={e => setFormData({ ...formData, action_template: e.target.value })}
                                    style={{ ...inputStyle, minHeight: '100px', resize: 'vertical' }}
                                    placeholder="Використовуйте змінні: {customer_name}, {order_id}, {tracking_number}, {order_total}, {payment_link}"
                                />
                            </div>

                            <button
                                onClick={saveRule}
                                style={{
                                    width: '100%',
                                    padding: '16px',
                                    backgroundColor: '#22c55e',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '3px',
                                    fontSize: '16px',
                                    fontWeight: 800,
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '8px'
                                }}
                            >
                                <Save size={20} />
                                {editingRule ? 'Оновити правило' : 'Створити правило'}
                            </button>
                        </div>
                    </div>
                </div>,
              document.body
            )}
        </div>
    );
}

const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: '13px',
    fontWeight: 700,
    color: '#475569',
    marginBottom: '8px'
};

const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '12px 16px',
    border: '1px solid #e2e8f0',
    borderRadius: '3px',
    fontSize: '14px',
    outline: 'none'
};
