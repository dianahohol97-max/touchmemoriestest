'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
    Plus,
    FileText,
    Settings,
    Trash2,
    Save,
    X,
    CheckCircle2,
    ShieldCheck,
    ToggleLeft,
    ToggleRight
} from 'lucide-react';
import { toast } from 'sonner';

export default function FiscalizationPage() {
    const supabase = createClient();

    const [accounts, setAccounts] = useState<any[]>([]);
    const [rules, setRules] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingAccount, setEditingAccount] = useState<any>(null);

    const [formData, setFormData] = useState({
        label: '',
        login: '',
        password: '',
        cashier_name: '',
        is_active: true
    });

    useEffect(() => {
        fetchData();
    }, []);

    async function fetchData() {
        setLoading(true);
        const [accountsRes, rulesRes] = await Promise.all([
            supabase.from('fiscal_accounts').select('*').order('created_at'),
            supabase.from('fiscal_rules').select('*').order('payment_type')
        ]);
        if (accountsRes.data) setAccounts(accountsRes.data);
        if (rulesRes.data) setRules(rulesRes.data);
        setLoading(false);
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        let error;
        if (editingAccount) {
            const { error: err } = await supabase.from('fiscal_accounts').update(formData).eq('id', editingAccount.id);
            error = err;
        } else {
            const { error: err } = await supabase.from('fiscal_accounts').insert([formData]);
            error = err;
        }

        if (error) {
            toast.error('Помилка при збереженні');
        } else {
            toast.success('Аккаунт збережено');
            setIsModalOpen(false);
            setEditingAccount(null);
            setFormData({ label: '', login: '', password: '', cashier_name: '', is_active: true });
            fetchData();
        }
        setLoading(false);
    };

    const toggleRule = async (type: string, enabled: boolean) => {
        const { error } = await supabase.from('fiscal_rules').update({ is_enabled: enabled }).eq('payment_type', type);
        if (error) toast.error('Помилка');
        else fetchData();
    };

    const updateRuleAccount = async (type: string, accountId: string) => {
        const { error } = await supabase.from('fiscal_rules').update({ fiscal_account_id: accountId }).eq('payment_type', type);
        if (error) toast.error('Помилка');
        else fetchData();
    };

    const updateRuleReceiptType = async (type: string, receiptType: string) => {
        const { error } = await supabase.from('fiscal_rules').update({ receipt_type: receiptType }).eq('payment_type', type);
        if (error) toast.error('Помилка');
        else fetchData();
    };

    return (
        <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
            <div style={{ marginBottom: '40px' }}>
                <h1 style={{ fontSize: '32px', fontWeight: 950, color: '#1e293b', marginBottom: '8px' }}>Фіскалізація</h1>
                <p style={{ color: '#64748b' }}>Налаштування інтеграції з Checkbox (checkbox.ua) та правил видачі чеків.</p>
            </div>

            {/* Checkbox Accounts Section */}
            <section style={{ marginBottom: '60px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                    <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#1e293b' }}>Аккаунти Checkbox</h2>
                    <button onClick={() => { setEditingAccount(null); setIsModalOpen(true); }} style={addBtnStyle}>
                        <Plus size={18} /> Додати аккаунт
                    </button>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
                    {accounts.map(acc => (
                        <div key={acc.id} style={accountCard}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <div>
                                    <div style={{ fontWeight: 800, fontSize: '16px' }}>{acc.label}</div>
                                    <div style={{ fontSize: '13px', color: '#64748b' }}>{acc.login}</div>
                                    <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>Касир: {acc.cashier_name}</div>
                                </div>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                    <button onClick={() => { setEditingAccount(acc); setFormData(acc); setIsModalOpen(true); }} style={iconBtn}><Settings size={16} /></button>
                                </div>
                            </div>
                            <div style={{ marginTop: '16px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: acc.is_active ? '#10b981' : '#f43f5e' }}></div>
                                <span style={{ fontSize: '12px', fontWeight: 700, color: acc.is_active ? '#10b981' : '#f43f5e' }}>
                                    {acc.is_active ? 'Активний' : 'Неактивний'}
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            {/* Fiscalization Rules Table */}
            <section>
                <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#1e293b', marginBottom: '24px' }}>Правила фіскалізації</h2>
                <div style={tableContainer}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ textAlign: 'left', borderBottom: '2px solid #f1f5f9' }}>
                                <th style={thStyle}>Тип оплати</th>
                                <th style={thStyle}>Фіскалізувати?</th>
                                <th style={thStyle}>Аккаунт Checkbox</th>
                                <th style={thStyle}>Тип чеку</th>
                            </tr>
                        </thead>
                        <tbody>
                            {rules.map(rule => (
                                <tr key={rule.payment_type} style={{ borderBottom: '1px solid #f8fafc' }}>
                                    <td style={tdStyle}>
                                        <b style={{ textTransform: 'capitalize' }}>
                                            {rule.payment_type === 'prepayment' ? 'Передоплата' :
                                                rule.payment_type === 'postpayment' ? 'Післяоплата' :
                                                    rule.payment_type === 'full' ? 'Повна оплата' : 'Повернення'}
                                        </b>
                                    </td>
                                    <td style={tdStyle}>
                                        <button
                                            onClick={() => toggleRule(rule.payment_type, !rule.is_enabled)}
                                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: rule.is_enabled ? '#10b981' : '#cbd5e1' }}
                                        >
                                            {rule.is_enabled ? <ToggleRight size={32} /> : <ToggleLeft size={32} />}
                                        </button>
                                    </td>
                                    <td style={tdStyle}>
                                        <select
                                            style={inlineSelect}
                                            value={rule.fiscal_account_id || ''}
                                            onChange={e => updateRuleAccount(rule.payment_type, e.target.value)}
                                        >
                                            <option value="">Не обрано</option>
                                            {accounts.map(acc => <option key={acc.id} value={acc.id}>{acc.label}</option>)}
                                        </select>
                                    </td>
                                    <td style={tdStyle}>
                                        <select
                                            style={inlineSelect}
                                            value={rule.receipt_type}
                                            onChange={e => updateRuleReceiptType(rule.payment_type, e.target.value)}
                                        >
                                            <option value="prepayment">Чек передоплати</option>
                                            <option value="full">Повний чек</option>
                                            <option value="return">Чек повернення</option>
                                        </select>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </section>

            {/* Modal */}
            {isModalOpen && (
                <div style={modalOverlay} onClick={() => setIsModalOpen(false)}>
                    <div style={modalContent} onClick={e => e.stopPropagation()}>
                        <h2 style={{ marginBottom: '24px', fontWeight: 900 }}>{editingAccount ? 'Редагувати' : 'Додати'} аккаунт Checkbox</h2>
                        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <div>
                                <label style={formLabel}>Назва (напр. "ФОП Іванов")</label>
                                <input style={formInput} value={formData.label} onChange={e => setFormData({ ...formData, label: e.target.value })} required />
                            </div>
                            <div>
                                <label style={formLabel}>Логін (Email/Phone)</label>
                                <input style={formInput} value={formData.login} onChange={e => setFormData({ ...formData, login: e.target.value })} required />
                            </div>
                            <div>
                                <label style={formLabel}>Пароль / API Ключ</label>
                                <input type="password" style={formInput} value={formData.password} onChange={e => setFormData({ ...formData, password: e.target.value })} />
                            </div>
                            <div>
                                <label style={formLabel}>Ім'я касира (для чеку)</label>
                                <input style={formInput} value={formData.cashier_name} onChange={e => setFormData({ ...formData, cashier_name: e.target.value })} />
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <input type="checkbox" id="acc_active" checked={formData.is_active} onChange={e => setFormData({ ...formData, is_active: e.target.checked })} />
                                <label htmlFor="acc_active" style={{ fontSize: '14px', fontWeight: 600 }}>Активний</label>
                            </div>
                            <button type="submit" style={submitBtn}>Зберегти</button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

const addBtnStyle = { display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', backgroundColor: '#1e293b', color: 'white', borderRadius: '12px', border: 'none', fontWeight: 700, cursor: 'pointer' };
const accountCard = { backgroundColor: 'white', padding: '24px', borderRadius: '24px', border: '1px solid #f1f5f9', boxShadow: '0 4px 15px rgba(0,0,0,0.02)' };
const iconBtn = { background: '#f8fafc', border: 'none', padding: '8px', borderRadius: '8px', color: '#64748b', cursor: 'pointer' };
const tableContainer = { backgroundColor: 'white', borderRadius: '24px', border: '1px solid #f1f5f9', padding: '16px', overflow: 'hidden' };
const thStyle = { padding: '16px', color: '#64748b', fontSize: '13px', fontWeight: 800, textTransform: 'uppercase' as any };
const tdStyle = { padding: '20px 16px', fontSize: '15px', color: '#1e293b' };
const inlineSelect = { padding: '8px 12px', borderRadius: '8px', border: '1.5px solid #e2e8f0', outline: 'none', fontSize: '14px' };
const modalOverlay = { position: 'fixed' as any, top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 };
const modalContent = { backgroundColor: 'white', borderRadius: '32px', padding: '32px', width: '100%', maxWidth: '450px' };
const formLabel = { display: 'block', fontSize: '12px', fontWeight: 800, color: '#64748b', marginBottom: '8px' };
const formInput = { width: '100%', padding: '12px 16px', borderRadius: '12px', border: '1.5px solid #e2e8f0', fontSize: '15px' };
const submitBtn = { width: '100%', padding: '14px', backgroundColor: '#1e293b', color: 'white', borderRadius: '12px', border: 'none', fontWeight: 700, marginTop: '10px', cursor: 'pointer' };
