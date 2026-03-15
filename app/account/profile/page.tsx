'use client';
export const dynamic = 'force-dynamic';
import { useState, useEffect } from 'react';
import { createBrowserClient } from '@supabase/ssr';

export default function ProfilePage() {
    const [formData, setFormData] = useState({
        first_name: '',
        last_name: '',
        phone: '',
        birthday: '',
        email_subscribed: false,
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [success, setSuccess] = useState(false);

    const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    useEffect(() => {
        const fetchProfile = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;

            const { data } = await supabase
                .from('customers')
                .select('*')
                .eq('email', session.user.email)
                .single();

            if (data) {
                setFormData({
                    first_name: data.first_name || '',
                    last_name: data.last_name || '',
                    phone: data.phone || '',
                    birthday: data.birthday || '',
                    email_subscribed: data.email_subscribed || false,
                });
            }
            setLoading(false);
        };
        fetchProfile();
    }, []);

    const handleSave = async () => {
        setSaving(true);
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        await supabase
            .from('customers')
            .update(formData)
            .eq('email', session.user.email);

        setSaving(false);
        setSuccess(true);
        setTimeout(() => setSuccess(false), 3000);
    };

    if (loading) return <div style={{ padding: '40px', color: '#64748b' }}>Завантаження...</div>;

    const inputStyle: React.CSSProperties = {
        width: '100%',
        padding: '12px',
        border: '1px solid #e2e8f0',
        borderRadius: '8px',
        fontSize: '14px',
        boxSizing: 'border-box',
        fontFamily: 'inherit',
        outline: 'none',
        color: '#263A99',
    };

    const labelStyle: React.CSSProperties = {
        display: 'block',
        fontSize: '13px',
        fontWeight: 600,
        marginBottom: '6px',
        color: '#475569',
    };

    return (
        <div style={{ maxWidth: '560px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 800, marginBottom: '24px', color: '#263A99' }}>
                Особисті дані
            </h2>

            {success && (
                <div style={{
                    backgroundColor: '#f0fdf4',
                    color: '#16a34a',
                    padding: '12px',
                    borderRadius: '8px',
                    marginBottom: '20px',
                    fontSize: '14px',
                    fontWeight: 600,
                }}>
                    ✓ Зміни збережено успішно
                </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                <div>
                    <label style={labelStyle}>Ім&apos;я</label>
                    <input
                        type="text"
                        value={formData.first_name}
                        onChange={e => setFormData({ ...formData, first_name: e.target.value })}
                        style={inputStyle}
                        placeholder="Введіть ім'я"
                    />
                </div>
                <div>
                    <label style={labelStyle}>Прізвище</label>
                    <input
                        type="text"
                        value={formData.last_name}
                        onChange={e => setFormData({ ...formData, last_name: e.target.value })}
                        style={inputStyle}
                        placeholder="Введіть прізвище"
                    />
                </div>
            </div>

            <div style={{ marginBottom: '16px' }}>
                <label style={labelStyle}>Телефон</label>
                <input
                    type="tel"
                    value={formData.phone}
                    placeholder="+380..."
                    onChange={e => setFormData({ ...formData, phone: e.target.value })}
                    style={inputStyle}
                />
            </div>

            <div style={{ marginBottom: '24px' }}>
                <label style={labelStyle}>Дата народження</label>
                <input
                    type="date"
                    value={formData.birthday}
                    onChange={e => setFormData({ ...formData, birthday: e.target.value })}
                    style={inputStyle}
                />
            </div>

            <div style={{
                backgroundColor: '#f8fafc',
                padding: '16px',
                borderRadius: '12px',
                marginBottom: '24px',
                border: '1px solid #f1f5f9',
            }}>
                <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
                    <div>
                        <div style={{ fontSize: '14px', fontWeight: 700, color: '#263A99' }}>Email розсилка</div>
                        <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>Отримувати новини та акції</div>
                    </div>
                    <input
                        type="checkbox"
                        checked={formData.email_subscribed}
                        onChange={e => setFormData({ ...formData, email_subscribed: e.target.checked })}
                        style={{ width: '18px', height: '18px', accentColor: '#263A99' }}
                    />
                </label>
            </div>

            <button
                onClick={handleSave}
                disabled={saving}
                style={{
                    padding: '14px 32px',
                    backgroundColor: '#263A99',
                    color: 'white',
                    border: 'none',
                    borderRadius: '12px',
                    fontSize: '15px',
                    fontWeight: 700,
                    cursor: saving ? 'not-allowed' : 'pointer',
                    opacity: saving ? 0.7 : 1,
                    transition: 'opacity 0.2s',
                }}
            >
                {saving ? 'Збереження...' : 'Зберегти зміни'}
            </button>
        </div>
    );
}
