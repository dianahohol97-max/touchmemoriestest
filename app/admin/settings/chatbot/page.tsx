'use client';
import { useState, useEffect } from 'react';
import { Save, Bot, MessageSquare } from 'lucide-react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';

const getSupabase = () => createClient();

export default function ChatbotSettingsPage() {
    const supabase = getSupabase();
    const [systemPrompt, setSystemPrompt] = useState('');
    const [autoEscalate, setAutoEscalate] = useState('10');
    const [platforms, setPlatforms] = useState({ telegram: true, instagram: false, facebook: false });
    const [workingHours, setWorkingHours] = useState({ start: '09:00', end: '21:00' });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        loadSettings();
    }, []);

    const loadSettings = async () => {
        setLoading(true);
        const { data, error } = await supabase.from('settings').select('*');
        if (!error && data) {
            data.forEach(item => {
                if (item.key === 'chatbot_system_prompt') setSystemPrompt(item.value);
                if (item.key === 'chatbot_auto_escalate_count') setAutoEscalate(item.value);
                if (item.key === 'chatbot_enabled_platforms') setPlatforms(item.value);
                if (item.key === 'chatbot_working_hours') setWorkingHours(item.value);
            });
        } else {
            console.error('Failed to load settings', error);
        }
        setLoading(false);
    };

    const handleSave = async () => {
        setSaving(true);
        const updates = [
            { key: 'chatbot_system_prompt', value: systemPrompt },
            { key: 'chatbot_auto_escalate_count', value: autoEscalate },
            { key: 'chatbot_enabled_platforms', value: platforms },
            { key: 'chatbot_working_hours', value: workingHours }
        ];

        let hasError = false;
        for (const up of updates) {
            const { error } = await supabase
                .from('settings')
                .upsert({ key: up.key, value: up.value }, { onConflict: 'key' });
            if (error) hasError = true;
        }

        if (hasError) {
            toast.error('Сталась помилка при збереженні');
        } else {
            toast.success('Налаштування збережено');
        }
        setSaving(false);
    };

    if (loading) return <div style={{ padding: '40px', color: '#64748b' }}>Завантаження...</div>;

    return (
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '32px' }}>
                <div>
                    <h1 style={{ fontSize: '24px', fontWeight: 800, margin: '0 0 8px 0', color: '#1e293b' }}>
                        Налаштування AI Chatbot
                    </h1>
                    <p style={{ color: '#64748b', margin: 0 }}>Керування характером бота та правилами обробки повідомлень.</p>
                </div>
                <button
                    onClick={handleSave}
                    disabled={saving}
                    style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', borderRadius: '12px', backgroundColor: 'var(--primary)', color: 'white', fontWeight: 700, border: 'none', cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}
                >
                    <Save size={18} />
                    {saving ? 'Збереження...' : 'Зберегти зміни'}
                </button>
            </div>

            <div style={{ backgroundColor: 'white', padding: '32px', borderRadius: '24px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', marginBottom: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                    <div style={{ width: '40px', height: '40px', borderRadius: '10px', backgroundColor: '#e0e7ff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3730a3' }}>
                        <Bot size={24} />
                    </div>
                    <div>
                        <h2 style={{ fontSize: '18px', fontWeight: 700, margin: 0 }}>Системний Промпт (Claude)</h2>
                        <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#64748b' }}>Інструкції для AI. Динамічні змінні (товари, замовлення) додаються автоматично.</p>
                    </div>
                </div>
                <textarea
                    value={systemPrompt}
                    onChange={e => setSystemPrompt(e.target.value)}
                    style={{ width: '100%', minHeight: '300px', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '14px', lineHeight: 1.6, outline: 'none', fontFamily: 'monospace', resize: 'vertical' }}
                />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                <div style={{ backgroundColor: 'white', padding: '24px', borderRadius: '24px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                        <div style={{ width: '36px', height: '36px', borderRadius: '10px', backgroundColor: '#fee2e2', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#991b1b' }}>
                            <MessageSquare size={20} />
                        </div>
                        <h2 style={{ fontSize: '16px', fontWeight: 700, margin: 0 }}>Ескалація</h2>
                    </div>
                    <label style={{ display: 'block', fontSize: '14px', fontWeight: 600, marginBottom: '8px' }}>Після скількох повідомлень кликати менеджера:</label>
                    <input
                        type="number"
                        value={autoEscalate}
                        onChange={e => setAutoEscalate(e.target.value)}
                        style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', border: '1px solid #e2e8f0', outline: 'none' }}
                        min="1" max="50"
                    />
                </div>

                <div style={{ backgroundColor: 'white', padding: '24px', borderRadius: '24px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                        <div style={{ width: '36px', height: '36px', borderRadius: '10px', backgroundColor: '#dcfce7', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#166534' }}>
                            <Bot size={20} />
                        </div>
                        <h2 style={{ fontSize: '16px', fontWeight: 700, margin: 0 }}>Робочі години бота</h2>
                    </div>
                    <div style={{ display: 'flex', gap: '16px' }}>
                        <div style={{ flex: 1 }}>
                            <label style={{ display: 'block', fontSize: '13px', color: '#64748b', marginBottom: '4px' }}>Початок</label>
                            <input
                                type="time"
                                value={workingHours.start}
                                onChange={e => setWorkingHours({ ...workingHours, start: e.target.value })}
                                style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid #e2e8f0', outline: 'none' }}
                            />
                        </div>
                        <div style={{ flex: 1 }}>
                            <label style={{ display: 'block', fontSize: '13px', color: '#64748b', marginBottom: '4px' }}>Кінець</label>
                            <input
                                type="time"
                                value={workingHours.end}
                                onChange={e => setWorkingHours({ ...workingHours, end: e.target.value })}
                                style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid #e2e8f0', outline: 'none' }}
                            />
                        </div>
                    </div>
                </div>
            </div>

        </div>
    );
}
