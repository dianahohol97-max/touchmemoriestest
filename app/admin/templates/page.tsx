'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import {
    Loader2, Plus, Edit2, Trash2, Mail,
    Save, X, Info
} from 'lucide-react';

const CATEGORY_COLORS: Record<string, { bg: string, text: string, label: string }> = {
    'shipping': { bg: '#dcfce7', text: '#166534', label: 'Доставка' },
    'delay': { bg: '#fee2e2', text: '#991b1b', label: 'Затримка' },
    'quality': { bg: '#fef3c7', text: '#92400e', label: 'Якість' },
    'general': { bg: '#f1f5f9', text: '#475569', label: 'Загальне' }
};

export default function TemplatesPage() {
    const supabase = createClient();
    const [templates, setTemplates] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [isEditing, setIsEditing] = useState(false);
    const [currentTemplate, setCurrentTemplate] = useState<any>(null);

    useEffect(() => {
        fetchTemplates();
    }, []);

    const fetchTemplates = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('reply_templates')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            toast.error('Помилка завантаження шаблонів');
        } else {
            setTemplates(data || []);
        }
        setLoading(false);
    };

    const handleEdit = (tmpl: any) => {
        setCurrentTemplate(tmpl);
        setIsEditing(true);
    };

    const handleCreate = () => {
        setCurrentTemplate({
            name: '',
            subject: '',
            body: '',
            category: 'general'
        });
        setIsEditing(true);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();

        try {
            if (currentTemplate.id) {
                // Update
                const { error } = await supabase
                    .from('reply_templates')
                    .update({
                        name: currentTemplate.name,
                        subject: currentTemplate.subject,
                        body: currentTemplate.body,
                        category: currentTemplate.category
                    })
                    .eq('id', currentTemplate.id);
                if (error) throw error;
                toast.success('Шаблон оновлено');
            } else {
                // Insert
                const { error } = await supabase
                    .from('reply_templates')
                    .insert([{
                        name: currentTemplate.name,
                        subject: currentTemplate.subject,
                        body: currentTemplate.body,
                        category: currentTemplate.category
                    }]);
                if (error) throw error;
                toast.success('Шаблон створено');
            }

            setIsEditing(false);
            fetchTemplates();
        } catch (err) {
            toast.error('Сталася помилка при збереженні');
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Ви впевнені, що хочете видалити цей шаблон?')) return;

        const { error } = await supabase
            .from('reply_templates')
            .delete()
            .eq('id', id);

        if (error) toast.error('Помилка видалення');
        else {
            toast.success('Шаблон видалено');
            fetchTemplates();
        }
    };

    if (loading && !isEditing) {
        return <div style={{ display: 'flex', justifyContent: 'center', padding: '100px' }}><Loader2 className="animate-spin" size={32} /></div>;
    }

    return (
        <div style={{ padding: '32px', maxWidth: '1200px', margin: '0 auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
                <div>
                    <h1 style={{ fontSize: '28px', fontWeight: 800, marginBottom: '8px' }}>Шаблони відповідей ✉️</h1>
                    <p style={{ color: '#64748b' }}>Керування шаблонами для швидких листів клієнтам</p>
                </div>

                {!isEditing && (
                    <button
                        onClick={handleCreate}
                        style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', borderRadius: "3px", background: 'var(--primary)', color: 'white', fontWeight: 600, border: 'none', cursor: 'pointer', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                    >
                        <Plus size={18} /> Створити шаблон
                    </button>
                )}
            </div>

            {isEditing ? (
                <motion.div
                    initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                    style={{ background: 'white', padding: '32px', borderRadius: "3px", boxShadow: '0 4px 20px rgba(0,0,0,0.03)', border: '1px solid #f1f5f9' }}
                >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                        <h2 style={{ fontSize: '20px', fontWeight: 700 }}>{currentTemplate.id ? 'Редагувати шаблон' : 'Новий шаблон'}</h2>
                        <button onClick={() => setIsEditing(false)} style={{ background: '#f1f5f9', border: 'none', width: '36px', height: '36px', borderRadius: "3px", display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#64748b' }}>
                            <X size={18} />
                        </button>
                    </div>

                    <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                            <div>
                                <label style={{ display: 'block', fontSize: '14px', fontWeight: 600, color: '#263A99', marginBottom: '8px' }}>Внутрішня назва</label>
                                <input
                                    required
                                    type="text"
                                    value={currentTemplate.name}
                                    onChange={e => setCurrentTemplate({ ...currentTemplate, name: e.target.value })}
                                    placeholder="Наприклад: Затримка 1-2 дні"
                                    style={{ width: '100%', padding: '12px 16px', borderRadius: "3px", border: '1px solid #e2e8f0', outline: 'none', fontSize: '15px' }}
                                />
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: '14px', fontWeight: 600, color: '#263A99', marginBottom: '8px' }}>Категорія</label>
                                <select
                                    value={currentTemplate.category}
                                    onChange={e => setCurrentTemplate({ ...currentTemplate, category: e.target.value })}
                                    style={{ width: '100%', padding: '12px 16px', borderRadius: "3px", border: '1px solid #e2e8f0', outline: 'none', fontSize: '15px', backgroundColor: 'white' }}
                                >
                                    <option value="general">Загальне</option>
                                    <option value="shipping">Доставка</option>
                                    <option value="delay">Затримка</option>
                                    <option value="quality">Якість</option>
                                </select>
                            </div>
                        </div>

                        <div>
                            <label style={{ display: 'block', fontSize: '14px', fontWeight: 600, color: '#263A99', marginBottom: '8px' }}>Тема листа (Subject)</label>
                            <input
                                required
                                type="text"
                                value={currentTemplate.subject}
                                onChange={e => setCurrentTemplate({ ...currentTemplate, subject: e.target.value })}
                                placeholder="Ваше замовлення №{{order_number}} відправлено!"
                                style={{ width: '100%', padding: '12px 16px', borderRadius: "3px", border: '1px solid #e2e8f0', outline: 'none', fontSize: '15px' }}
                            />
                        </div>

                        <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '8px' }}>
                                <label style={{ display: 'block', fontSize: '14px', fontWeight: 600, color: '#263A99' }}>Тіло листа</label>
                                <div style={{ fontSize: '12px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <Info size={14} /> Змінні: {'{{customer_name}}, {{order_number}}, {{ttn}}, {{product_name}}'}
                                </div>
                            </div>
                            <textarea
                                required
                                rows={8}
                                value={currentTemplate.body}
                                onChange={e => setCurrentTemplate({ ...currentTemplate, body: e.target.value })}
                                placeholder="Вітаємо, {{customer_name}}..."
                                style={{ width: '100%', padding: '16px', borderRadius: "3px", border: '1px solid #e2e8f0', outline: 'none', fontSize: '15px', resize: 'vertical', lineHeight: '1.5' }}
                            />
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '12px' }}>
                            <button type="button" onClick={() => setIsEditing(false)} style={{ padding: '12px 24px', borderRadius: "3px", border: '1px solid #e2e8f0', background: 'white', color: '#64748b', fontWeight: 600, cursor: 'pointer' }}>
                                Скасувати
                            </button>
                            <button type="submit" style={{ padding: '12px 24px', borderRadius: "3px", border: 'none', background: 'var(--primary)', color: 'white', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Save size={18} /> Зберегти шаблон
                            </button>
                        </div>
                    </form>
                </motion.div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '24px' }}>
                    {templates.map(tmpl => {
                        const cat = CATEGORY_COLORS[tmpl.category] || CATEGORY_COLORS['general'];
                        return (
                            <motion.div
                                key={tmpl.id}
                                layout
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                style={{ background: 'white', borderRadius: "3px", padding: '24px', border: '1px solid #f1f5f9', boxShadow: '0 4px 12px rgba(0,0,0,0.02)', display: 'flex', flexDirection: 'column' }}
                            >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                                    <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#263A99', margin: 0 }}>{tmpl.name}</h3>
                                    <span style={{ fontSize: '12px', fontWeight: 600, padding: '4px 8px', borderRadius: "3px", background: cat.bg, color: cat.text }}>
                                        {cat.label}
                                    </span>
                                </div>

                                <div style={{ fontSize: '14px', color: '#475569', marginBottom: '12px', paddingBottom: '12px', borderBottom: '1px dashed #e2e8f0' }}>
                                    <strong>Тема:</strong> {tmpl.subject}
                                </div>

                                <div style={{ fontSize: '13px', color: '#64748b', whiteSpace: 'pre-wrap', flex: 1, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                                    {tmpl.body}
                                </div>

                                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '20px' }}>
                                    <button
                                        onClick={() => handleEdit(tmpl)}
                                        style={{ background: '#f8fafc', border: '1px solid #e2e8f0', padding: '8px', borderRadius: "3px", cursor: 'pointer', color: '#263A99' }}
                                    >
                                        <Edit2 size={16} />
                                    </button>
                                    <button
                                        onClick={() => handleDelete(tmpl.id)}
                                        style={{ background: '#fef2f2', border: '1px solid #fee2e2', padding: '8px', borderRadius: "3px", cursor: 'pointer', color: '#ef4444' }}
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </motion.div>
                        );
                    })}
                    {templates.length === 0 && (
                        <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '60px 20px', background: '#f8fafc', borderRadius: "3px", border: '1px dashed #cbd5e1' }}>
                            <Mail size={48} color="#cbd5e1" style={{ marginBottom: '16px' }} />
                            <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#263A99', marginBottom: '8px' }}>Немає шаблонів</h3>
                            <p style={{ color: '#64748b' }}>Створіть свій перший шаблон для швидких відповідей.</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
