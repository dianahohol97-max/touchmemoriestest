'use client';
import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { createClient } from '@/lib/supabase/client';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import {
    Loader2, Plus, Edit2, Trash2, Mail, MessageSquare,
    Save, X, Info, Send, Users, ArrowRight
} from 'lucide-react';

interface MessageTemplate {
    id?: string;
    name: string;
    type: 'sms' | 'email';
    category: 'order' | 'payment' | 'delivery' | 'marketing';
    subject?: string;
    body: string;
    variables: string[];
    is_active: boolean;
    usage_count?: number;
    last_used_at?: string;
}

const CATEGORY_CONFIG = {
    'order': { label: 'Замовлення', color: '#263a99' },
    'payment': { label: 'Оплата', color: '#22c55e' },
    'delivery': { label: 'Доставка', color: '#f59e0b' },
    'marketing': { label: 'Маркетинг', color: '#ec4899' }
};

const AVAILABLE_VARIABLES = [
    { key: '{client_name}', label: 'Ім\'я клієнта' },
    { key: '{order_id}', label: 'ID замовлення' },
    { key: '{tracking_number}', label: 'Трек-номер' },
    { key: '{total_price}', label: 'Сума' },
    { key: '{payment_link}', label: 'Посилання на оплату' },
];

export default function MessageTemplatesPage() {
    const supabase = createClient();
    const [templates, setTemplates] = useState<MessageTemplate[]>([]);
    const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
    const [isEditing, setIsEditing] = useState(false);
    const [showSendModal, setShowSendModal] = useState(false);
    const [currentTemplate, setCurrentTemplate] = useState<MessageTemplate | null>(null);
    const [selectedTemplate, setSelectedTemplate] = useState<MessageTemplate | null>(null);
    const [clients, setClients] = useState<any[]>([]);
    const [selectedClient, setSelectedClient] = useState('');
    const [filterType, setFilterType] = useState<'all' | 'sms' | 'email'>('all');
    const [filterCategory, setFilterCategory] = useState<string>('all');

    useEffect(() => {
        fetchTemplates();
        fetchClients();
    }, []);

    const fetchTemplates = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('message_templates')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            toast.error('Помилка завантаження шаблонів');
        } else {
            setTemplates(data || []);
        }
        setLoading(false);
    };

    const fetchClients = async () => {
        const { data } = await supabase
            .from('clients')
            .select('id, first_name, last_name, phone, email')
            .order('created_at', { ascending: false })
            .limit(100);
        setClients(data || []);
    };

    const handleEdit = (tmpl: MessageTemplate) => {
        setCurrentTemplate(tmpl);
        setIsEditing(true);
    };

    const handleCreate = (type: 'sms' | 'email') => {
        setCurrentTemplate({
            name: '',
            type,
            category: 'order',
            subject: '',
            body: '',
            variables: [],
            is_active: true
        });
        setIsEditing(true);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!currentTemplate) return;

        try {
            if (currentTemplate.id) {
                // Update
                const { error } = await supabase
                    .from('message_templates')
                    .update({
                        name: currentTemplate.name,
                        type: currentTemplate.type,
                        category: currentTemplate.category,
                        subject: currentTemplate.subject,
                        body: currentTemplate.body,
                        variables: currentTemplate.variables,
                        is_active: currentTemplate.is_active
                    })
                    .eq('id', currentTemplate.id);
                if (error) throw error;
                toast.success('Шаблон оновлено');
            } else {
                // Insert
                const { error } = await supabase
                    .from('message_templates')
                    .insert([{
                        name: currentTemplate.name,
                        type: currentTemplate.type,
                        category: currentTemplate.category,
                        subject: currentTemplate.subject,
                        body: currentTemplate.body,
                        variables: currentTemplate.variables,
                        is_active: currentTemplate.is_active
                    }]);
                if (error) throw error;
                toast.success('Шаблон створено');
            }

            setIsEditing(false);
            setCurrentTemplate(null);
            fetchTemplates();
        } catch (err) {
            toast.error('Сталася помилка при збереженні');
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Ви впевнені, що хочете видалити цей шаблон?')) return;

        const { error } = await supabase
            .from('message_templates')
            .delete()
            .eq('id', id);

        if (error) toast.error('Помилка видалення');
        else {
            toast.success('Шаблон видалено');
            fetchTemplates();
        }
    };

    const insertVariable = (variable: string) => {
        if (!currentTemplate) return;
        const newBody = currentTemplate.body + variable;
        setCurrentTemplate({ ...currentTemplate, body: newBody });
    };

    const getSMSCount = (text: string) => {
        const length = text.length;
        if (length === 0) return 0;
        return Math.ceil(length / 160);
    };

    const handleSendNow = (template: MessageTemplate) => {
        setSelectedTemplate(template);
        setShowSendModal(true);
    };

    const sendMessage = async () => {
        if (!selectedTemplate || !selectedClient) {
            toast.error('Оберіть клієнта');
            return;
        }

        const client = clients.find(c => c.id === selectedClient);
        if (!client) return;

        // Replace variables with actual data
        let message = selectedTemplate!.body;
        message = message.replace(/{client_name}/g, `${client.first_name} ${client.last_name}`);
        message = message.replace(/{order_id}/g, 'N/A');
        message = message.replace(/{tracking_number}/g, 'N/A');
        message = message.replace(/{total_price}/g, 'N/A');
        message = message.replace(/{payment_link}/g, 'N/A');

        if (selectedTemplate!.type === 'sms') {
            // Send SMS via TurboSMS
            toast.info('Відправка SMS...');
            // TODO: Implement TurboSMS API call
            await new Promise(resolve => setTimeout(resolve, 1000));
            toast.success(`SMS відправлено на ${client.phone}`);
        } else {
            // Send Email
            toast.info('Відправка Email...');
            // TODO: Implement Email sending
            await new Promise(resolve => setTimeout(resolve, 1000));
            toast.success(`Email відправлено на ${client.email}`);
        }

        // Update usage stats
        await supabase
            .from('message_templates')
            .update({
                usage_count: (selectedTemplate!.usage_count || 0) + 1,
                last_used_at: new Date().toISOString()
            })
            .eq('id', selectedTemplate!.id);

        setShowSendModal(false);
        setSelectedClient('');
        fetchTemplates();
    };

    const filteredTemplates = templates.filter(t => {
        if (filterType !== 'all' && t.type !== filterType) return false;
        if (filterCategory !== 'all' && t.category !== filterCategory) return false;
        return true;
    });

    if (loading && !isEditing) {
        return <div style={{ display: 'flex', justifyContent: 'center', padding: '100px' }}><Loader2 className="animate-spin" size={32} color="#263A99" /></div>;
    }

    return (
        <div style={{ padding: '32px', maxWidth: '1400px', margin: '0 auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
                <div>
                    <h1 style={{ fontSize: '28px', fontWeight: 800, marginBottom: '8px', color: '#263A99' }}>Шаблони повідомлень</h1>
                    <p style={{ color: '#64748b' }}>SMS та Email шаблони з автопідстановкою змінних</p>
                </div>

                {!isEditing && (
                    <div style={{ display: 'flex', gap: '12px' }}>
                        <button
                            onClick={() => handleCreate('sms')}
                            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 20px', borderRadius: '50px', background: '#263A99', color: 'white', fontWeight: 600, border: 'none', cursor: 'pointer', boxShadow: '0 4px 16px rgba(38,58,153,0.25)' }}
                        >
                            <MessageSquare size={18} /> Створити SMS
                        </button>
                        <button
                            onClick={() => handleCreate('email')}
                            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 20px', borderRadius: '50px', background: '#22c55e', color: 'white', fontWeight: 600, border: 'none', cursor: 'pointer', boxShadow: '0 4px 16px rgba(34,197,94,0.25)' }}
                        >
                            <Mail size={18} /> Створити Email
                        </button>
                    </div>
                )}
            </div>

            {/* Filters */}
            {!isEditing && (
                <div style={{ display: 'flex', gap: '16px', marginBottom: '24px', padding: '20px', background: 'white', borderRadius: '12px', border: '1px solid #f1f5f9' }}>
                    <div style={{ flex: 1 }}>
                        <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#64748b', marginBottom: '8px' }}>Тип</label>
                        <select
                            value={filterType}
                            onChange={e => setFilterType(e.target.value as any)}
                            style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #e2e8f0', outline: 'none', fontSize: '14px', backgroundColor: 'white', cursor: 'pointer' }}
                        >
                            <option value="all">Всі</option>
                            <option value="sms">SMS</option>
                            <option value="email">Email</option>
                        </select>
                    </div>
                    <div style={{ flex: 1 }}>
                        <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#64748b', marginBottom: '8px' }}>Категорія</label>
                        <select
                            value={filterCategory}
                            onChange={e => setFilterCategory(e.target.value)}
                            style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #e2e8f0', outline: 'none', fontSize: '14px', backgroundColor: 'white', cursor: 'pointer' }}
                        >
                            <option value="all">Всі категорії</option>
                            {Object.entries(CATEGORY_CONFIG).map(([key, val]) => (
                                <option key={key} value={key}>{val.label}</option>
                            ))}
                        </select>
                    </div>
                </div>
            )}

            {isEditing && currentTemplate ? (
                <motion.div
                    initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                    style={{ background: 'white', padding: '32px', borderRadius: '12px', boxShadow: '0 4px 20px rgba(0,0,0,0.05)', border: '1px solid #f1f5f9' }}
                >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                        <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#263A99' }}>
                            {currentTemplate.id ? 'Редагувати шаблон' : `Новий ${currentTemplate.type === 'sms' ? 'SMS' : 'Email'} шаблон`}
                        </h2>
                        <button onClick={() => { setIsEditing(false); setCurrentTemplate(null); }} style={{ background: '#f1f5f9', border: 'none', width: '36px', height: '36px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#64748b' }}>
                            <X size={18} />
                        </button>
                    </div>

                    <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                            <div>
                                <label style={{ display: 'block', fontSize: '14px', fontWeight: 600, color: '#263A99', marginBottom: '8px' }}>Назва шаблону</label>
                                <input
                                    required
                                    type="text"
                                    value={currentTemplate.name}
                                    onChange={e => setCurrentTemplate({ ...currentTemplate, name: e.target.value })}
                                    placeholder="Наприклад: Підтвердження замовлення"
                                    style={{ width: '100%', padding: '12px 16px', borderRadius: '8px', border: '1px solid #e2e8f0', outline: 'none', fontSize: '15px' }}
                                />
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: '14px', fontWeight: 600, color: '#263A99', marginBottom: '8px' }}>Категорія</label>
                                <select
                                    value={currentTemplate.category}
                                    onChange={e => setCurrentTemplate({ ...currentTemplate, category: e.target.value as any })}
                                    style={{ width: '100%', padding: '12px 16px', borderRadius: '8px', border: '1px solid #e2e8f0', outline: 'none', fontSize: '15px', backgroundColor: 'white' }}
                                >
                                    {Object.entries(CATEGORY_CONFIG).map(([key, val]) => (
                                        <option key={key} value={key}>{val.label}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {currentTemplate.type === 'email' && (
                            <div>
                                <label style={{ display: 'block', fontSize: '14px', fontWeight: 600, color: '#263A99', marginBottom: '8px' }}>Тема листа</label>
                                <input
                                    type="text"
                                    value={currentTemplate.subject || ''}
                                    onChange={e => setCurrentTemplate({ ...currentTemplate, subject: e.target.value })}
                                    placeholder="Дякуємо за замовлення #{order_id}"
                                    style={{ width: '100%', padding: '12px 16px', borderRadius: '8px', border: '1px solid #e2e8f0', outline: 'none', fontSize: '15px' }}
                                />
                            </div>
                        )}

                        {/* Variable buttons */}
                        <div style={{ background: '#f8f9ff', padding: '16px', borderRadius: '8px', border: '1px solid #eef0fb' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                                <Info size={16} color="#263A99" />
                                <span style={{ fontSize: '14px', fontWeight: 600, color: '#263A99' }}>Змінні</span>
                            </div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                {AVAILABLE_VARIABLES.map(v => (
                                    <button
                                        key={v.key}
                                        type="button"
                                        onClick={() => insertVariable(v.key)}
                                        style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #263A99', background: 'white', color: '#263A99', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
                                    >
                                        + {v.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '8px' }}>
                                <label style={{ display: 'block', fontSize: '14px', fontWeight: 600, color: '#263A99' }}>
                                    {currentTemplate.type === 'sms' ? 'Текст SMS' : 'Тіло листа'}
                                </label>
                                {currentTemplate.type === 'sms' && (
                                    <div style={{ fontSize: '13px', color: getSMSCount(currentTemplate.body) > 1 ? '#ef4444' : '#22c55e', fontWeight: 700 }}>
                                        {currentTemplate.body.length} символів • {getSMSCount(currentTemplate.body)} SMS
                                    </div>
                                )}
                            </div>
                            <textarea
                                required
                                rows={currentTemplate.type === 'email' ? 12 : 6}
                                value={currentTemplate.body}
                                onChange={e => setCurrentTemplate({ ...currentTemplate, body: e.target.value })}
                                placeholder={currentTemplate.type === 'sms'
                                    ? 'Вітаємо, {client_name}! Ваше замовлення #{order_id} прийнято.'
                                    : '<html><body>Вітаємо, {client_name}!...</body></html>'}
                                style={{ width: '100%', padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0', outline: 'none', fontSize: '14px', resize: 'vertical', lineHeight: '1.6', fontFamily: currentTemplate.type === 'email' ? 'monospace' : 'inherit' }}
                            />
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', background: '#f8fafc', borderRadius: '8px' }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', fontWeight: 600, color: '#64748b', cursor: 'pointer' }}>
                                <input
                                    type="checkbox"
                                    checked={currentTemplate.is_active}
                                    onChange={e => setCurrentTemplate({ ...currentTemplate, is_active: e.target.checked })}
                                    style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                                />
                                Шаблон активний
                            </label>

                            <div style={{ display: 'flex', gap: '12px' }}>
                                <button type="button" onClick={() => { setIsEditing(false); setCurrentTemplate(null); }} style={{ padding: '12px 24px', borderRadius: '50px', border: '1px solid #e2e8f0', background: 'white', color: '#64748b', fontWeight: 600, cursor: 'pointer' }}>
                                    Скасувати
                                </button>
                                <button type="submit" style={{ padding: '12px 24px', borderRadius: '50px', border: 'none', background: '#263A99', color: 'white', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 16px rgba(38,58,153,0.25)' }}>
                                    <Save size={18} /> Зберегти
                                </button>
                            </div>
                        </div>
                    </form>
                </motion.div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', gap: '20px' }}>
                    {filteredTemplates.map(tmpl => {
                        const cat = CATEGORY_CONFIG[tmpl.category];
                        return (
                            <motion.div
                                key={tmpl.id}
                                layout
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                style={{
                                    background: 'white',
                                    borderRadius: '12px',
                                    padding: '24px',
                                    border: '2px solid #f1f5f9',
                                    boxShadow: '0 4px 12px rgba(0,0,0,0.03)',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    opacity: tmpl.is_active ? 1 : 0.6
                                }}
                            >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                        {tmpl.type === 'sms' ? <MessageSquare size={20} color="#263A99" /> : <Mail size={20} color="#22c55e" />}
                                        <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#263A99', margin: 0 }}>{tmpl.name}</h3>
                                    </div>
                                    <span style={{ fontSize: '11px', fontWeight: 700, padding: '5px 10px', borderRadius: '6px', background: cat.color, color: 'white' }}>
                                        {cat.label}
                                    </span>
                                </div>

                                {tmpl.type === 'email' && tmpl.subject && (
                                    <div style={{ fontSize: '13px', color: '#475569', marginBottom: '12px', paddingBottom: '12px', borderBottom: '1px solid #f1f5f9' }}>
                                        <strong>Тема:</strong> {tmpl.subject}
                                    </div>
                                )}

                                <div style={{
                                    color: '#64748b',
                                    whiteSpace: 'pre-wrap',
                                    flex: 1,
                                    display: '-webkit-box',
                                    WebkitLineClamp: tmpl.type === 'email' ? 2 : 3,
                                    WebkitBoxOrient: 'vertical',
                                    overflow: 'hidden',
                                    background: '#f8fafc',
                                    padding: '12px',
                                    borderRadius: '8px',
                                    fontFamily: tmpl.type === 'email' ? 'monospace' : 'inherit',
                                    fontSize: tmpl.type === 'email' ? '11px' : '13px'
                                }}>
                                    {tmpl.body}
                                </div>

                                {tmpl.type === 'sms' && (
                                    <div style={{ fontSize: '12px', color: '#64748b', marginTop: '8px' }}>
                                        {tmpl.body.length} символів • {getSMSCount(tmpl.body)} SMS
                                    </div>
                                )}

                                {(tmpl.usage_count || 0) > 0 && (
                                    <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #f1f5f9' }}>
                                        Використано: {tmpl.usage_count} разів
                                    </div>
                                )}

                                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
                                    <button
                                        onClick={() => handleSendNow(tmpl)}
                                        style={{ background: '#22c55e', border: 'none', padding: '10px 16px', borderRadius: '8px', cursor: 'pointer', color: 'white', fontWeight: 600, fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}
                                    >
                                        <Send size={14} /> Відправити
                                    </button>
                                    <button
                                        onClick={() => handleEdit(tmpl)}
                                        style={{ background: '#f8fafc', border: '1px solid #e2e8f0', padding: '10px', borderRadius: '8px', cursor: 'pointer', color: '#263A99' }}
                                    >
                                        <Edit2 size={16} />
                                    </button>
                                    <button
                                        onClick={() => handleDelete(tmpl.id!)}
                                        style={{ background: '#fef2f2', border: '1px solid #fee2e2', padding: '10px', borderRadius: '8px', cursor: 'pointer', color: '#ef4444' }}
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </motion.div>
                        );
                    })}
                    {filteredTemplates.length === 0 && (
                        <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '60px 20px', background: '#f8fafc', borderRadius: '12px', border: '2px dashed #cbd5e1' }}>
                            {filterType === 'sms' ? <MessageSquare size={48} color="#cbd5e1" style={{ marginBottom: '16px' }} /> : <Mail size={48} color="#cbd5e1" style={{ marginBottom: '16px' }} />}
                            <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#263A99', marginBottom: '8px' }}>Немає шаблонів</h3>
                            <p style={{ color: '#64748b' }}>Створіть свій перший шаблон для відправки повідомлень.</p>
                        </div>
                    )}
                </div>
            )}

            {/* Send Modal */}
            {showSendModal && mounted && createPortal(
              <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={() => setShowSendModal(false)}>
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        onClick={e => e.stopPropagation()}
                        style={{ background: 'white', padding: '32px', borderRadius: '16px', maxWidth: '500px', width: '90%', boxShadow: '0 20px 50px rgba(0,0,0,0.2)' }}
                    >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                            <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#263A99' }}>
                                Відправити {selectedTemplate!.type === 'sms' ? 'SMS' : 'Email'}
                            </h2>
                            <button onClick={() => setShowSendModal(false)} style={{ background: '#f1f5f9', border: 'none', width: '36px', height: '36px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#64748b' }}>
                                <X size={18} />
                            </button>
                        </div>

                        <div style={{ marginBottom: '24px' }}>
                            <label style={{ display: 'block', fontSize: '14px', fontWeight: 600, color: '#263A99', marginBottom: '8px' }}>
                                <Users size={16} style={{ display: 'inline', marginRight: '6px' }} />
                                Оберіть клієнта
                            </label>
                            <select
                                value={selectedClient}
                                onChange={e => setSelectedClient(e.target.value)}
                                style={{ width: '100%', padding: '12px 16px', borderRadius: '8px', border: '1px solid #e2e8f0', outline: 'none', fontSize: '15px', backgroundColor: 'white' }}
                            >
                                <option value="">-- Оберіть клієнта --</option>
                                {clients.map(client => (
                                    <option key={client.id} value={client.id}>
                                        {client.first_name} {client.last_name} • {selectedTemplate!.type === 'sms' ? client.phone : client.email}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div style={{ background: '#f8f9ff', padding: '16px', borderRadius: '8px', marginBottom: '24px' }}>
                            <div style={{ fontSize: '13px', fontWeight: 600, color: '#263A99', marginBottom: '8px' }}>Шаблон:</div>
                            <div style={{ fontSize: '14px', color: '#475569', whiteSpace: 'pre-wrap' }}>{selectedTemplate!.body}</div>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                            <button onClick={() => setShowSendModal(false)} style={{ padding: '12px 24px', borderRadius: '50px', border: '1px solid #e2e8f0', background: 'white', color: '#64748b', fontWeight: 600, cursor: 'pointer' }}>
                                Скасувати
                            </button>
                            <button onClick={sendMessage} disabled={!selectedClient} style={{ padding: '12px 24px', borderRadius: '50px', border: 'none', background: selectedClient ? '#22c55e' : '#cbd5e1', color: 'white', fontWeight: 600, cursor: selectedClient ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: selectedClient ? '0 4px 16px rgba(34,197,94,0.25)' : 'none' }}>
                                <Send size={18} /> Відправити зараз
                            </button>
                        </div>
                    </motion.div>
                </div>,
              document.body
            )}
        </div>
    );
}
