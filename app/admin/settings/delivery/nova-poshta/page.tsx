'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
    Plus,
    Truck,
    Trash2,
    Save,
    X,
    CheckCircle2,
    MapPin,
    Phone,
    ShieldCheck,
    Star
} from 'lucide-react';
import { toast } from 'sonner';

export default function NovaPoshtaSettingsPage() {
    const supabase = createClient();

    const [accounts, setAccounts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingAccount, setEditingAccount] = useState<any>(null);

    const [formData, setFormData] = useState({
        label: '',
        api_key: '',
        sender_name: '',
        sender_phone: '',
        sender_city_ref: '',
        sender_warehouse_ref: '',
        is_default: false,
        is_active: true
    });

    useEffect(() => {
        fetchAccounts();
    }, []);

    async function fetchAccounts() {
        setLoading(true);
        const { data } = await supabase.from('np_accounts').select('*').order('created_at');
        if (data) setAccounts(data);
        setLoading(false);
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        if (formData.is_default) {
            // Unset other defaults if this one is default
            await supabase.from('np_accounts').update({ is_default: false }).neq('id', '00000000-0000-0000-0000-000000000000');
        }

        let error;
        if (editingAccount) {
            const { error: err } = await supabase.from('np_accounts').update(formData).eq('id', editingAccount.id);
            error = err;
        } else {
            const { error: err } = await supabase.from('np_accounts').insert([formData]);
            error = err;
        }

        if (error) {
            toast.error('Помилка при збереженні');
        } else {
            toast.success('Аккаунт НП збережено');
            setIsModalOpen(false);
            setEditingAccount(null);
            setFormData({ label: '', api_key: '', sender_name: '', sender_phone: '', sender_city_ref: '', sender_warehouse_ref: '', is_default: false, is_active: true });
            fetchAccounts();
        }
        setLoading(false);
    };

    const deleteAccount = async (id: string) => {
        if (!confirm('Видалити цей аккаунт?')) return;
        const { error } = await supabase.from('np_accounts').delete().eq('id', id);
        if (error) toast.error('Помилка');
        else fetchAccounts();
    };

    return (
        <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px' }}>
                <div>
                    <h1 style={{ fontSize: '32px', fontWeight: 950, color: '#1e293b', marginBottom: '8px' }}>Нова Пошта</h1>
                    <p style={{ color: '#64748b' }}>Налаштування декількох кабінетів Нової Пошти для відправки замовлень.</p>
                </div>
                <button onClick={() => { setEditingAccount(null); setIsModalOpen(true); }} style={addBtnStyle}>
                    <Plus size={20} />
                    Додати API ключ
                </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '24px' }}>
                {accounts.map(acc => (
                    <div key={acc.id} style={{ ...cardStyle, border: acc.is_default ? '2px solid #3b82f6' : '1px solid #f1f5f9' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <div style={{ padding: '8px', backgroundColor: '#eff6ff', borderRadius: '10px', color: '#3b82f6' }}><Truck size={20} /></div>
                                <span style={{ fontWeight: 800, fontSize: '18px' }}>{acc.label}</span>
                            </div>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <button onClick={() => { setEditingAccount(acc); setFormData(acc); setIsModalOpen(true); }} style={iconBtn}><Save size={16} /></button>
                                <button onClick={() => deleteAccount(acc.id)} style={{ ...iconBtn, color: '#ef4444' }}><Trash2 size={16} /></button>
                            </div>
                        </div>

                        {acc.is_default && (
                            <div style={{ marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: 800, color: '#3b82f6', textTransform: 'uppercase' }}>
                                <Star size={12} fill="#3b82f6" /> Основний аккаунт
                            </div>
                        )}

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            <div style={infoRow}><Phone size={14} /> {acc.sender_name} ({acc.sender_phone || 'не вказано'})</div>
                            <div style={infoRow}><MapPin size={14} /> {acc.sender_city_ref ? 'City Ref set' : 'Адреса за замовчуванням'}</div>
                        </div>

                        <div style={{ marginTop: '20px', padding: '10px', backgroundColor: '#f8fafc', borderRadius: '10px', fontSize: '12px', color: '#64748b', fontFamily: 'monospace' }}>
                            API Key: {acc.api_key.substring(0, 4)}...{acc.api_key.substring(acc.api_key.length - 4)}
                        </div>
                    </div>
                ))}
            </div>

            {/* Modal */}
            {isModalOpen && (
                <div style={modalOverlay} onClick={() => setIsModalOpen(false)}>
                    <div style={modalContent} onClick={e => e.stopPropagation()}>
                        <h2 style={{ marginBottom: '24px', fontWeight: 900 }}>{editingAccount ? 'Редагувати' : 'Додати'} аккаунт Нової Пошти</h2>
                        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <div>
                                <label style={formLabel}>Назва мітки (напр. "ФОП Іванченко")</label>
                                <input style={formInput} value={formData.label} onChange={e => setFormData({ ...formData, label: e.target.value })} required />
                            </div>
                            <div>
                                <label style={formLabel}>API Ключ</label>
                                <input type="password" style={formInput} value={formData.api_key} onChange={e => setFormData({ ...formData, api_key: e.target.value })} required />
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                <div>
                                    <label style={formLabel}>Ім'я відправника</label>
                                    <input style={formInput} value={formData.sender_name} onChange={e => setFormData({ ...formData, sender_name: e.target.value })} />
                                </div>
                                <div>
                                    <label style={formLabel}>Телефон</label>
                                    <input style={formInput} value={formData.sender_phone} onChange={e => setFormData({ ...formData, sender_phone: e.target.value })} />
                                </div>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                <div>
                                    <label style={formLabel}>City Ref (optional)</label>
                                    <input style={formInput} value={formData.sender_city_ref} onChange={e => setFormData({ ...formData, sender_city_ref: e.target.value })} />
                                </div>
                                <div>
                                    <label style={formLabel}>Warehouse Ref (optional)</label>
                                    <input style={formInput} value={formData.sender_warehouse_ref} onChange={e => setFormData({ ...formData, sender_warehouse_ref: e.target.value })} />
                                </div>
                            </div>

                            <div style={{ display: 'flex', gap: '20px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <input type="checkbox" id="np_default" checked={formData.is_default} onChange={e => setFormData({ ...formData, is_default: e.target.checked })} />
                                    <label htmlFor="np_default" style={{ fontSize: '14px', fontWeight: 600 }}>Основний</label>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <input type="checkbox" id="np_active" checked={formData.is_active} onChange={e => setFormData({ ...formData, is_active: e.target.checked })} />
                                    <label htmlFor="np_active" style={{ fontSize: '14px', fontWeight: 600 }}>Активний</label>
                                </div>
                            </div>

                            <button type="submit" style={submitBtn}>Зберегти налаштування</button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

const addBtnStyle = { display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 24px', backgroundColor: '#1e293b', color: 'white', borderRadius: '14px', border: 'none', fontWeight: 700, cursor: 'pointer' };
const cardStyle = { backgroundColor: 'white', padding: '24px', borderRadius: '24px', boxShadow: '0 4px 15px rgba(0,0,0,0.02)' };
const iconBtn = { background: '#f8fafc', border: 'none', padding: '8px', borderRadius: '8px', color: '#64748b', cursor: 'pointer' };
const infoRow = { display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: '#475569', fontWeight: 500 };
const modalOverlay = { position: 'fixed' as any, top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 };
const modalContent = { backgroundColor: 'white', borderRadius: '32px', padding: '32px', width: '100%', maxWidth: '550px' };
const formLabel = { display: 'block', fontSize: '12px', fontWeight: 800, color: '#64748b', marginBottom: '8px', textTransform: 'uppercase' as any };
const formInput = { width: '100%', padding: '12px 16px', borderRadius: '12px', border: '1.5px solid #e2e8f0', fontSize: '15px' };
const submitBtn = { width: '100%', padding: '14px', backgroundColor: '#1e293b', color: 'white', borderRadius: '12px', border: 'none', fontWeight: 700, marginTop: '10px', cursor: 'pointer' };
