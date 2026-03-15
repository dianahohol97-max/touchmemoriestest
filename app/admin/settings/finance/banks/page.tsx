'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
    Plus,
    CreditCard,
    Building2,
    Trash2,
    RefreshCcw,
    Save,
    X,
    CheckCircle2,
    AlertCircle,
    User,
    DollarSign,
    ExternalLink
} from 'lucide-react';
import { toast } from 'sonner';

const BANK_LOGOS: Record<string, string> = {
    'Monobank': 'https://vsem.ua/content/images/logos/monobank.png',
    'PrivatBank': 'https://privatbank.ua/static/privatbank/img/logo.svg',
    'PUMB': 'https://www.pumb.ua/themes/pumb/assets/images/logo.svg',
    'Oschadbank': 'https://www.oschadbank.ua/themes/oshad/assets/images/logo.svg',
    'Raiffeisen': 'https://raiffeisen.ua/img/logo.svg'
};

export default function BankAccountsPage() {
    const supabase = createClient();

    const [accounts, setAccounts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [staff, setStaff] = useState<any[]>([]);
    const [editingAccount, setEditingAccount] = useState<any>(null);

    const [formData, setFormData] = useState({
        bank_name: 'Monobank',
        label: '',
        iban: '',
        card_number: '',
        api_key: '',
        currency: 'UAH',
        assigned_staff_id: '',
        is_active: true
    });

    useEffect(() => {
        fetchAccounts();
        fetchStaff();
    }, []);

    async function fetchAccounts() {
        setLoading(true);
        const { data, error } = await supabase.from('bank_accounts').select('*, staff(name)').order('created_at');
        if (data) setAccounts(data);
        setLoading(false);
    }

    async function fetchStaff() {
        const { data } = await supabase.from('staff').select('id, name');
        if (data) setStaff(data);
    }

    const resetForm = () => {
        setFormData({
            bank_name: 'Monobank',
            label: '',
            iban: '',
            card_number: '',
            api_key: '',
            currency: 'UAH',
            assigned_staff_id: '',
            is_active: true
        });
        setEditingAccount(null);
    };

    const handleEdit = (account: any) => {
        setEditingAccount(account);
        setFormData({
            bank_name: account.bank_name,
            label: account.label,
            iban: account.iban || '',
            card_number: account.card_number || '',
            api_key: account.api_key || '',
            currency: account.currency,
            assigned_staff_id: account.assigned_staff_id || '',
            is_active: account.is_active
        });
        setIsModalOpen(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        const payload = {
            ...formData,
            updated_at: new Date().toISOString()
        };

        let error;
        if (editingAccount) {
            const { error: err } = await supabase.from('bank_accounts').update(payload).eq('id', editingAccount.id);
            error = err;
        } else {
            const { error: err } = await supabase.from('bank_accounts').insert([payload]);
            error = err;
        }

        if (error) {
            toast.error('Помилка при збереженні');
        } else {
            toast.success(editingAccount ? 'Рахунок оновлено' : 'Рахунок додано');
            setIsModalOpen(false);
            resetForm();
            fetchAccounts();
        }
        setLoading(false);
    };

    const deleteAccount = async (id: string) => {
        if (!confirm('Ви впевнені, що хочете видалити цей рахунок?')) return;
        const { error } = await supabase.from('bank_accounts').delete().eq('id', id);
        if (error) {
            toast.error('Помилка при видаленні');
        } else {
            toast.success('Рахунок видалено');
            fetchAccounts();
        }
    };

    const syncBalance = async (account: any) => {
        if (!account.api_key || account.bank_name !== 'Monobank') {
            toast.error('Синхронізація доступна тільки для Monobank з API ключем');
            return;
        }
        toast.info('Початок синхронізації...');
        // Mock sync for now, in a real app this would call an API route
        setTimeout(async () => {
            const mockBalance = account.balance + Math.floor(Math.random() * 1000);
            await supabase.from('bank_accounts').update({ balance: mockBalance }).eq('id', account.id);
            fetchAccounts();
            toast.success('Баланс оновлено');
        }, 1500);
    };

    return (
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px' }}>
                <div>
                    <h1 style={{ fontSize: '32px', fontWeight: 950, color: '#1e293b', marginBottom: '8px' }}>Банківські рахунки</h1>
                    <p style={{ color: '#64748b' }}>Керуйте рахунками для прийому оплат та відстеження фінансів.</p>
                </div>
                <button
                    onClick={() => { resetForm(); setIsModalOpen(true); }}
                    style={addBtnStyle}
                >
                    <Plus size={20} />
                    Додати рахунок
                </button>
            </div>

            {loading && accounts.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '100px' }}>Завантаження...</div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '24px' }}>
                    {accounts.map(account => (
                        <div key={account.id} style={{ ...cardStyle, opacity: account.is_active ? 1 : 0.6 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
                                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                                    <div style={bankIconCircle}>
                                        <Building2 size={20} color="#64748b" />
                                    </div>
                                    <div>
                                        <div style={{ fontSize: '18px', fontWeight: 800, color: '#1e293b' }}>{account.label}</div>
                                        <div style={{ fontSize: '13px', color: '#94a3b8' }}>{account.bank_name}</div>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', gap: '10px' }}>
                                    <button onClick={() => handleEdit(account)} style={iconActionBtn} title="Редагувати"><RefreshCcw size={16} /></button>
                                    <button onClick={() => deleteAccount(account.id)} style={{ ...iconActionBtn, color: '#ef4444' }} title="Видалити"><Trash2 size={16} /></button>
                                </div>
                            </div>

                            <div style={{ marginBottom: '20px' }}>
                                <div style={{ fontSize: '24px', fontWeight: 900, color: '#1e293b' }}>
                                    {account.balance?.toLocaleString()} {account.currency}
                                </div>
                                <div style={{ fontSize: '12px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    Поточний баланс
                                    {account.api_key && <RefreshCcw size={12} style={{ cursor: 'pointer' }} onClick={() => syncBalance(account)} />}
                                </div>
                            </div>

                            <div style={detailsGrid}>
                                <div>
                                    <label style={miniLabel}>IBAN</label>
                                    <div style={detailValue}>{account.iban || '—'}</div>
                                </div>
                                <div>
                                    <label style={miniLabel}>Відповідальний</label>
                                    <div style={detailValue}>
                                        <User size={12} style={{ marginRight: '4px' }} />
                                        {account.staff?.name || 'Всі'}
                                    </div>
                                </div>
                            </div>

                            {!account.is_active && (
                                <div style={{ marginTop: '16px', fontSize: '12px', color: '#f43f5e', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <AlertCircle size={14} /> Неактивний
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* Account Modal */}
            {isModalOpen && (
                <div style={modalOverlay} onClick={() => setIsModalOpen(false)}>
                    <div style={modalContent} onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                            <h2 style={{ fontSize: '20px', fontWeight: 900 }}>{editingAccount ? 'Редагувати рахунок' : 'Додати новий рахунок'}</h2>
                            <button onClick={() => setIsModalOpen(false)} style={closeBtn}><X size={20} /></button>
                        </div>

                        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                <div>
                                    <label style={formLabel}>Банк</label>
                                    <select
                                        style={formInput}
                                        value={formData.bank_name}
                                        onChange={e => setFormData({ ...formData, bank_name: e.target.value })}
                                    >
                                        <option>Monobank</option>
                                        <option>ПриватБанк</option>
                                        <option>ПУМБ</option>
                                        <option>Ощадбанк</option>
                                        <option>Райффайзен</option>
                                        <option>Інший</option>
                                    </select>
                                </div>
                                <div>
                                    <label style={formLabel}>Валюта</label>
                                    <select
                                        style={formInput}
                                        value={formData.currency}
                                        onChange={e => setFormData({ ...formData, currency: e.target.value })}
                                    >
                                        <option>UAH</option>
                                        <option>USD</option>
                                        <option>EUR</option>
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label style={formLabel}>Назва/Мітка (напр. "ФОП Основний")</label>
                                <input
                                    type="text"
                                    style={formInput}
                                    value={formData.label}
                                    required
                                    onChange={e => setFormData({ ...formData, label: e.target.value })}
                                />
                            </div>

                            <div>
                                <label style={formLabel}>IBAN</label>
                                <input
                                    type="text"
                                    style={formInput}
                                    value={formData.iban}
                                    onChange={e => setFormData({ ...formData, iban: e.target.value })}
                                />
                            </div>

                            <div>
                                <label style={formLabel}>API Ключ / Токен (для синхронізації)</label>
                                <input
                                    type="password"
                                    style={formInput}
                                    value={formData.api_key}
                                    onChange={e => setFormData({ ...formData, api_key: e.target.value })}
                                />
                                <p style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>Потрібно для Monobank, щоб автоматично підтягувати баланс та платежі.</p>
                            </div>

                            <div>
                                <label style={formLabel}>Призначити (Team member)</label>
                                <select
                                    style={formInput}
                                    value={formData.assigned_staff_id}
                                    onChange={e => setFormData({ ...formData, assigned_staff_id: e.target.value })}
                                >
                                    <option value="">Всі (доступно всім адмінам)</option>
                                    {staff.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                </select>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <input
                                    type="checkbox"
                                    id="is_active"
                                    checked={formData.is_active}
                                    onChange={e => setFormData({ ...formData, is_active: e.target.checked })}
                                />
                                <label htmlFor="is_active" style={{ fontSize: '14px', fontWeight: 600 }}>Активний рахунок</label>
                            </div>

                            <button type="submit" style={submitBtn} disabled={loading}>
                                {loading ? 'Збереження...' : (editingAccount ? 'Оновити рахунок' : 'Додати рахунок')}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

const cardStyle = { backgroundColor: 'white', padding: '24px', borderRadius: '24px', border: '1px solid #f1f5f9', boxShadow: '0 4px 20px rgba(0,0,0,0.02)' };
const addBtnStyle = { display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 24px', backgroundColor: '#1e293b', color: 'white', borderRadius: '14px', border: 'none', fontWeight: 700, cursor: 'pointer' };
const bankIconCircle = { width: '40px', height: '40px', borderRadius: '50%', backgroundColor: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center' };
const iconActionBtn = { background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '4px' };
const miniLabel = { fontSize: '11px', textTransform: 'uppercase' as any, fontWeight: 800, color: '#94a3b8', display: 'block', marginBottom: '4px' };
const detailValue = { fontSize: '14px', color: '#475569', fontWeight: 600, display: 'flex', alignItems: 'center' };
const detailsGrid = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' };
const modalOverlay = { position: 'fixed' as any, top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 };
const modalContent = { backgroundColor: 'white', borderRadius: '32px', padding: '32px', width: '100%', maxWidth: '500px', boxShadow: '0 20px 50px rgba(0,0,0,0.1)' };
const formLabel = { display: 'block', fontSize: '12px', fontWeight: 800, color: '#64748b', marginBottom: '8px', textTransform: 'uppercase' as any };
const formInput = { width: '100%', padding: '12px 16px', borderRadius: '12px', border: '1.5px solid #e2e8f0', outline: 'none', fontSize: '15px' };
const submitBtn = { width: '100%', padding: '14px', backgroundColor: '#1e293b', color: 'white', borderRadius: '12px', border: 'none', fontWeight: 700, fontSize: '16px', cursor: 'pointer', marginTop: '10px' };
const closeBtn = { background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' };
