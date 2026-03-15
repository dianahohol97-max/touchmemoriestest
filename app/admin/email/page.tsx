'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Mail, Users, Ticket, Zap, Plus, Search, Calendar, RefreshCw, X } from 'lucide-react';
import toast from 'react-hot-toast';

export default function MarketingAdminPage() {
    const supabase = createClient();
    const [activeTab, setActiveTab] = useState<'campaigns' | 'subscribers' | 'promos' | 'automations'>('campaigns');

    // Data states
    const [campaigns, setCampaigns] = useState<any[]>([]);
    const [subscribers, setSubscribers] = useState<any[]>([]);
    const [promos, setPromos] = useState<any[]>([]);
    const [automations, setAutomations] = useState<any[]>([]);
    const [products, setProducts] = useState<any[]>([]);
    const [categories, setCategories] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    // Modal states
    const [isCreatePromoModalOpen, setIsCreatePromoModalOpen] = useState(false);
    const [isCreateCampaignModalOpen, setIsCreateCampaignModalOpen] = useState(false);
    const [isConfigAutomationModalOpen, setIsConfigAutomationModalOpen] = useState(false);
    const [editingAutomation, setEditingAutomation] = useState<any>(null);

    const [newPromo, setNewPromo] = useState({
        code: '',
        type: 'percent',
        value: '',
        min_order_amount: '0',
        max_uses: '',
        is_single_use: true,
        valid_until: '',
        applicable_product_ids: [] as string[],
        applicable_category_ids: [] as string[]
    });

    const [newCampaign, setNewCampaign] = useState({
        subject: '',
        type: 'promotion',
        html_body: '',
        preview_text: '',
        segment: 'all'
    });

    useEffect(() => {
        fetchData();
    }, [activeTab]);

    const fetchData = async () => {
        setLoading(true);
        try {
            if (activeTab === 'campaigns') {
                const { data } = await supabase.from('email_campaigns').select('*').order('created_at', { ascending: false });
                setCampaigns(data || []);
            } else if (activeTab === 'subscribers') {
                const { data } = await supabase.from('subscribers').select('*').order('subscribed_at', { ascending: false });
                setSubscribers(data || []);
            } else if (activeTab === 'promos') {
                const { data } = await supabase.from('promo_codes').select('*').order('created_at', { ascending: false });
                setPromos(data || []);

                // Fetch products and categories for selection
                const { data: pData } = await supabase.from('products').select('id, name').order('name');
                const { data: cData } = await supabase.from('categories').select('id, name').order('name');
                setProducts(pData || []);
                setCategories(cData || []);
            } else if (activeTab === 'automations') {
                const { data } = await supabase.from('marketing_automations').select('*').order('type', { ascending: true });
                setAutomations(data || []);
            }
        } catch (error) {
            console.error('Fetch error:', error);
            toast.error('Помилка завантаження даних');
        } finally {
            setLoading(false);
        }
    };

    const handleSavePromo = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newPromo.code || !newPromo.value) {
            toast.error('Код та Значення є обов\'язковими');
            return;
        }

        const { error } = await supabase.from('promo_codes').insert({
            code: newPromo.code.toUpperCase().trim(),
            type: newPromo.type,
            value: Number(newPromo.value),
            min_order_amount: Number(newPromo.min_order_amount) || 0,
            max_uses: newPromo.max_uses ? Number(newPromo.max_uses) : null,
            is_single_use_per_customer: newPromo.is_single_use,
            valid_until: newPromo.valid_until ? new Date(newPromo.valid_until).toISOString() : null,
            applicable_product_ids: newPromo.applicable_product_ids,
            applicable_category_ids: newPromo.applicable_category_ids,
            created_by: 'admin_manual'
        });

        if (error) {
            toast.error(error.message);
        } else {
            toast.success('Промокод успішно створено!');
            setIsCreatePromoModalOpen(false);
            setNewPromo({
                code: '', type: 'percent', value: '', min_order_amount: '0', max_uses: '',
                is_single_use: true, valid_until: '',
                applicable_product_ids: [], applicable_category_ids: []
            });
            fetchData();
        }
    };

    const handleSaveCampaign = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newCampaign.subject || !newCampaign.html_body) {
            toast.error('Тема та вміст є обов\'язковими');
            return;
        }

        const { error } = await supabase.from('email_campaigns').insert({
            ...newCampaign,
            status: 'draft'
        });

        if (error) {
            toast.error(error.message);
        } else {
            toast.success('Розсилку створено (чернетка)!');
            setIsCreateCampaignModalOpen(false);
            setNewCampaign({ subject: '', type: 'promotion', html_body: '', preview_text: '', segment: 'all' });
            fetchData();
        }
    };

    const handleSaveAutomation = async (e: React.FormEvent) => {
        e.preventDefault();
        const { error } = await supabase.from('marketing_automations')
            .update({
                settings: editingAutomation.settings,
                is_active: editingAutomation.is_active,
                updated_at: new Date().toISOString()
            })
            .eq('id', editingAutomation.id);

        if (error) {
            toast.error(error.message);
        } else {
            toast.success('Налаштування збережено!');
            setIsConfigAutomationModalOpen(false);
            fetchData();
        }
    };

    const handleNewCampaign = () => {
        setIsCreateCampaignModalOpen(true);
    };

    // Shared styles
    const cardStyle = { backgroundColor: '#fff', borderRadius: '3px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', border: '1px solid #f1f5f9', overflow: 'hidden' as const };
    const thStyle = { padding: '16px', textAlign: 'left' as const, fontSize: '14px', fontWeight: 600, color: '#64748b', borderBottom: '1px solid #e2e8f0', backgroundColor: '#f8fafc' };
    const tdStyle = { padding: '16px', borderBottom: '1px solid #f1f5f9', fontSize: '14px' };
    const btnPrimary = { padding: '8px 16px', backgroundColor: '#263A99', color: 'white', fontWeight: 600, borderRadius: '3px', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px' };
    const btnSecondary = { padding: '8px 16px', backgroundColor: '#fff', border: '1px solid #e2e8f0', color: '#475569', fontWeight: 600, borderRadius: '3px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px' };
    const searchInputWrapper = { position: 'relative' as const, display: 'flex', alignItems: 'center' };
    const searchInput = { padding: '8px 16px 8px 36px', border: '1px solid #e2e8f0', borderRadius: '3px', width: '300px', fontSize: '14px', outline: 'none' };
    const badgeStyle = (bg: string, text: string) => ({ backgroundColor: bg, color: text, padding: '4px 8px', borderRadius: '3px', fontSize: '12px', fontWeight: 700, textTransform: 'uppercase' as const, display: 'inline-block' });

    return (
        <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', flexDirection: 'column' }}>

            <div style={{ marginBottom: '32px' }}>
                <h1 style={{ fontSize: '28px', fontWeight: 700, color: '#263A99', margin: '0 0 8px 0' }}>Маркетинг</h1>
                <p style={{ color: '#64748b', fontSize: '15px', margin: 0 }}>Управління підписками, email-розсилками та промокодами</p>
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: '16px', borderBottom: '1px solid #e2e8f0', marginBottom: '32px', overflowX: 'auto' }}>
                <TabButton
                    active={activeTab === 'campaigns'}
                    onClick={() => setActiveTab('campaigns')}
                    icon={<Mail size={18} />}
                    label="Кампанії"
                />
                <TabButton
                    active={activeTab === 'subscribers'}
                    onClick={() => setActiveTab('subscribers')}
                    icon={<Users size={18} />}
                    label="Підписники"
                />
                <TabButton
                    active={activeTab === 'promos'}
                    onClick={() => setActiveTab('promos')}
                    icon={<Ticket size={18} />}
                    label="Промокоди"
                />
                <TabButton
                    active={activeTab === 'automations'}
                    onClick={() => setActiveTab('automations')}
                    icon={<Zap size={18} />}
                    label="Автоматизації"
                />
            </div>

            {/* Content Area */}
            {loading ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '200px', color: '#94a3b8' }}>
                    <RefreshCw size={24} style={{ animation: 'spin 1s linear infinite', marginRight: '12px' }} />
                    <span style={{ fontSize: '15px' }}>Завантаження...</span>
                </div>
            ) : (
                <>
                    {/* Campaigns Tab */}
                    {activeTab === 'campaigns' && (
                        <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                                <div style={searchInputWrapper}>
                                    <Search size={16} color="#94a3b8" style={{ position: 'absolute', left: '12px' }} />
                                    <input type="text" placeholder="Пошук кампаній..." style={searchInput} />
                                </div>
                                <button onClick={handleNewCampaign} style={btnPrimary}>
                                    <Plus size={18} />
                                    Створити розсилку
                                </button>
                            </div>

                            <div style={cardStyle}>
                                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                    <thead>
                                        <tr>
                                            <th style={thStyle}>Тема</th>
                                            <th style={thStyle}>Тип</th>
                                            <th style={thStyle}>Статус</th>
                                            <th style={thStyle}>Відправлено</th>
                                            <th style={thStyle}>Відкрито</th>
                                            <th style={thStyle}>Дата</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {campaigns.length === 0 ? (
                                            <tr><td colSpan={6} style={{ padding: '32px', textAlign: 'center', color: '#64748b' }}>Немає збережених кампаній</td></tr>
                                        ) : (
                                            campaigns.map(c => (
                                                <tr key={c.id}>
                                                    <td style={{ ...tdStyle, fontWeight: 500, color: '#263A99' }}>{c.subject}</td>
                                                    <td style={tdStyle}>
                                                        <span style={badgeStyle('#f3e8ff', '#7e22ce')}>{c.type}</span>
                                                    </td>
                                                    <td style={tdStyle}>
                                                        <span style={badgeStyle(c.status === 'sent' ? '#dcfce7' : '#f1f5f9', c.status === 'sent' ? '#15803d' : '#475569')}>
                                                            {c.status}
                                                        </span>
                                                    </td>
                                                    <td style={{ ...tdStyle, color: '#64748b' }}>{c.total_sent}</td>
                                                    <td style={{ ...tdStyle, color: '#64748b' }}>{c.total_opened}</td>
                                                    <td style={{ ...tdStyle, color: '#64748b' }}>{new Date(c.created_at).toLocaleDateString('uk-UA')}</td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* Subscribers Tab */}
                    {activeTab === 'subscribers' && (
                        <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                                <div style={searchInputWrapper}>
                                    <Search size={16} color="#94a3b8" style={{ position: 'absolute', left: '12px' }} />
                                    <input type="text" placeholder="Пошук підписників..." style={searchInput} />
                                </div>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                    <button style={btnSecondary}>
                                        Експорт CSV
                                    </button>
                                </div>
                            </div>

                            <div style={cardStyle}>
                                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                    <thead>
                                        <tr>
                                            <th style={thStyle}>Email</th>
                                            <th style={thStyle}>Ім'я</th>
                                            <th style={thStyle}>Сегменти</th>
                                            <th style={thStyle}>Статус</th>
                                            <th style={thStyle}>Джерело</th>
                                            <th style={thStyle}>Підписано</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {subscribers.length === 0 ? (
                                            <tr><td colSpan={6} style={{ padding: '32px', textAlign: 'center', color: '#64748b' }}>Немає підписників</td></tr>
                                        ) : (
                                            subscribers.map(s => (
                                                <tr key={s.id}>
                                                    <td style={{ ...tdStyle, fontWeight: 500, color: '#263A99' }}>{s.email}</td>
                                                    <td style={{ ...tdStyle, color: '#64748b' }}>{s.name || '-'}</td>
                                                    <td style={tdStyle}>
                                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                                            {s.segments?.map((seg: string) => (
                                                                <span key={seg} style={{ backgroundColor: '#f1f5f9', color: '#475569', padding: '2px 6px', borderRadius: '3px', fontSize: '12px' }}>
                                                                    {seg}
                                                                </span>
                                                            )) || '-'}
                                                        </div>
                                                    </td>
                                                    <td style={tdStyle}>
                                                        <span style={badgeStyle(s.is_active ? '#dcfce7' : '#fee2e2', s.is_active ? '#15803d' : '#b91c1c')}>
                                                            {s.is_active ? 'Активний' : 'Відписаний'}
                                                        </span>
                                                    </td>
                                                    <td style={{ ...tdStyle, color: '#64748b', textTransform: 'capitalize' }}>{s.source}</td>
                                                    <td style={{ ...tdStyle, color: '#64748b' }}>{new Date(s.subscribed_at).toLocaleDateString('uk-UA')}</td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* Promos Tab */}
                    {activeTab === 'promos' && (
                        <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                                <div style={searchInputWrapper}>
                                    <Search size={16} color="#94a3b8" style={{ position: 'absolute', left: '12px' }} />
                                    <input type="text" placeholder="Пошук промокодів..." style={searchInput} />
                                </div>
                                <button onClick={() => setIsCreatePromoModalOpen(true)} style={btnPrimary}>
                                    <Plus size={18} />
                                    Створити промокод
                                </button>
                            </div>

                            <div style={cardStyle}>
                                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                    <thead>
                                        <tr>
                                            <th style={thStyle}>Код</th>
                                            <th style={thStyle}>Знижка</th>
                                            <th style={thStyle}>Статус</th>
                                            <th style={thStyle}>Використано</th>
                                            <th style={thStyle}>Діє до</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {promos.length === 0 ? (
                                            <tr><td colSpan={5} style={{ padding: '32px', textAlign: 'center', color: '#64748b' }}>Немає промокодів</td></tr>
                                        ) : (
                                            promos.map(p => {
                                                const isExpired = p.valid_until && new Date(p.valid_until) < new Date();
                                                const isActive = p.is_active && !isExpired;

                                                return (
                                                    <tr key={p.id}>
                                                        <td style={tdStyle}>
                                                            <span style={{ fontFamily: 'monospace', fontWeight: 700, backgroundColor: '#f1f5f9', padding: '4px 8px', borderRadius: '3px', color: '#263A99' }}>
                                                                {p.code}
                                                            </span>
                                                        </td>
                                                        <td style={{ ...tdStyle, fontWeight: 600, color: '#263A99' }}>
                                                            {p.type === 'percent' ? `-${p.value}%` : `-${p.value} грн`}
                                                        </td>
                                                        <td style={tdStyle}>
                                                            <span style={badgeStyle(isActive ? '#dcfce7' : '#fee2e2', isActive ? '#15803d' : '#b91c1c')}>
                                                                {isActive ? 'Активний' : 'Недійсний'}
                                                            </span>
                                                        </td>
                                                        <td style={{ ...tdStyle, color: '#64748b' }}>
                                                            {p.uses_count} {p.max_uses ? `/ ${p.max_uses}` : ''}
                                                        </td>
                                                        <td style={{ ...tdStyle, color: '#64748b' }}>
                                                            {p.valid_until ? new Date(p.valid_until).toLocaleDateString('uk-UA') : 'Безстроково'}
                                                        </td>
                                                    </tr>
                                                );
                                            })
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* Automations Tab */}
                    {activeTab === 'automations' && (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '24px' }}>
                            {automations.map(auto => {
                                const isBirthday = auto.type === 'birthday';
                                const Icon = isBirthday ? Calendar : Users;
                                const color = isBirthday ? '#9333ea' : '#263A99';
                                const bg = isBirthday ? '#f3e8ff' : '#eff6ff';

                                return (
                                    <div key={auto.id} style={{ ...cardStyle, padding: '24px' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                                <div style={{ backgroundColor: bg, color: color, padding: '12px', borderRadius: '3px' }}>
                                                    <Icon size={24} />
                                                </div>
                                                <div>
                                                    <h3 style={{ margin: '0 0 4px 0', fontSize: '18px', fontWeight: 700, color: '#263A99' }}>
                                                        {isBirthday ? 'Привітання з Днем Народження' : 'Привітальне повідомлення'}
                                                    </h3>
                                                    <p style={{ margin: 0, fontSize: '14px', color: '#64748b' }}>
                                                        {isBirthday ? 'Відправляє подарунковий код в день народження' : 'При підписці на новини сайту'}
                                                    </p>
                                                </div>
                                            </div>
                                            <span style={badgeStyle(auto.is_active ? '#dcfce7' : '#fee2e2', auto.is_active ? '#15803d' : '#b91c1c')}>
                                                {auto.is_active ? 'Увімкнено' : 'Вимкнено'}
                                            </span>
                                        </div>
                                        <div style={{ backgroundColor: '#f8fafc', padding: '16px', borderRadius: '3px', border: '1px solid #f1f5f9', marginBottom: '16px', fontSize: '14px', color: '#475569' }}>
                                            {isBirthday ? (
                                                <>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}><span>Знижка:</span> <span style={{ fontWeight: 600, color: '#263A99' }}>-{auto.settings?.discount_value}{auto.settings?.discount_type === 'percent' ? '%' : ' ₴'}</span></div>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Діє (днів):</span> <span style={{ fontWeight: 600, color: '#263A99' }}>{auto.settings?.valid_days}</span></div>
                                                </>
                                            ) : (
                                                <>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}><span>Промокод:</span> <span style={{ fontWeight: 600, color: '#263A99', fontFamily: 'monospace' }}>{auto.settings?.promo_code}</span></div>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Знижка:</span> <span style={{ fontWeight: 600, color: '#263A99' }}>-{auto.settings?.discount_value}{auto.settings?.discount_type === 'percent' ? '%' : ' ₴'}</span></div>
                                                </>
                                            )}
                                        </div>
                                        <button
                                            onClick={() => {
                                                setEditingAutomation({ ...auto });
                                                setIsConfigAutomationModalOpen(true);
                                            }}
                                            style={{ width: '100%', padding: '10px', border: '2px solid #e2e8f0', backgroundColor: '#fff', color: '#475569', fontWeight: 600, borderRadius: '3px', cursor: 'pointer', fontSize: '15px' }}
                                        >
                                            Налаштувати
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </>
            )}

            {/* Create Promo Modal */}
            {isCreatePromoModalOpen && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ ...cardStyle, width: '100%', maxWidth: '600px', padding: '24px', maxHeight: '90vh', overflowY: 'auto' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                            <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 700, color: '#263A99' }}>Новий промокод</h2>
                            <button onClick={() => setIsCreatePromoModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}>
                                <X size={20} />
                            </button>
                        </div>

                        <form onSubmit={handleSavePromo} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '16px' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#475569', marginBottom: '8px' }}>Код (напр. SUMMER20)</label>
                                    <input type="text" required value={newPromo.code} onChange={e => setNewPromo({ ...newPromo, code: e.target.value })} style={{ ...searchInput, width: '100%', padding: '10px 16px' }} />
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#475569', marginBottom: '8px' }}>Тип</label>
                                    <select value={newPromo.type} onChange={e => setNewPromo({ ...newPromo, type: e.target.value })} style={{ ...searchInput, width: '100%', padding: '10px', cursor: 'pointer' }}>
                                        <option value="percent">Відсоток (%)</option>
                                        <option value="fixed">Сума (₴)</option>
                                    </select>
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#475569', marginBottom: '8px' }}>Значення знижки</label>
                                    <input type="number" required min="1" value={newPromo.value} onChange={e => setNewPromo({ ...newPromo, value: e.target.value })} style={{ ...searchInput, width: '100%', padding: '10px 16px' }} />
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#475569', marginBottom: '8px' }}>Мінімальна сума (₴)</label>
                                    <input type="number" min="0" value={newPromo.min_order_amount} onChange={e => setNewPromo({ ...newPromo, min_order_amount: e.target.value })} style={{ ...searchInput, width: '100%', padding: '10px 16px' }} />
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#475569', marginBottom: '8px' }}>Ліміт використань (шт)</label>
                                    <input type="number" placeholder="Безліміт" value={newPromo.max_uses} onChange={e => setNewPromo({ ...newPromo, max_uses: e.target.value })} style={{ ...searchInput, width: '100%', padding: '10px 16px' }} />
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#475569', marginBottom: '8px' }}>Діє до (опціонально)</label>
                                    <input type="date" value={newPromo.valid_until} onChange={e => setNewPromo({ ...newPromo, valid_until: e.target.value })} style={{ ...searchInput, width: '100%', padding: '10px 12px' }} />
                                </div>
                            </div>

                            <div>
                                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#475569', marginBottom: '8px' }}>Діє для товарів (опціонально)</label>
                                <div style={{ maxHeight: '100px', overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '3px', padding: '8px' }}>
                                    {products.map(p => (
                                        <label key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', marginBottom: '4px', cursor: 'pointer' }}>
                                            <input
                                                type="checkbox"
                                                checked={newPromo.applicable_product_ids.includes(p.id)}
                                                onChange={(e) => {
                                                    const ids = e.target.checked
                                                        ? [...newPromo.applicable_product_ids, p.id]
                                                        : newPromo.applicable_product_ids.filter(id => id !== p.id);
                                                    setNewPromo({ ...newPromo, applicable_product_ids: ids });
                                                }}
                                            />
                                            {p.name}
                                        </label>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#475569', marginBottom: '8px' }}>Діє для категорій (опціонально)</label>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', border: '1px solid #e2e8f0', borderRadius: '3px', padding: '8px' }}>
                                    {categories.map(c => (
                                        <label key={c.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer' }}>
                                            <input
                                                type="checkbox"
                                                checked={newPromo.applicable_category_ids.includes(c.id)}
                                                onChange={(e) => {
                                                    const ids = e.target.checked
                                                        ? [...newPromo.applicable_category_ids, c.id]
                                                        : newPromo.applicable_category_ids.filter(id => id !== c.id);
                                                    setNewPromo({ ...newPromo, applicable_category_ids: ids });
                                                }}
                                            />
                                            {c.name}
                                        </label>
                                    ))}
                                </div>
                            </div>

                            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: '#263A99', marginTop: '8px', cursor: 'pointer' }}>
                                <input type="checkbox" checked={newPromo.is_single_use} onChange={e => setNewPromo({ ...newPromo, is_single_use: e.target.checked })} style={{ width: '16px', height: '16px' }} />
                                <span>Одне використання на клієнта</span>
                            </label>

                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '16px' }}>
                                <button type="button" onClick={() => setIsCreatePromoModalOpen(false)} style={btnSecondary}>
                                    Скасувати
                                </button>
                                <button type="submit" style={btnPrimary}>
                                    Зберегти промокод
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Create Campaign Modal */}
            {isCreateCampaignModalOpen && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ ...cardStyle, width: '100%', maxWidth: '700px', padding: '24px', maxHeight: '90vh', overflowY: 'auto' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                            <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 700, color: '#263A99' }}>Нова розсилка</h2>
                            <button onClick={() => setIsCreateCampaignModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}>
                                <X size={20} />
                            </button>
                        </div>

                        <form onSubmit={handleSaveCampaign} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <div>
                                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#475569', marginBottom: '8px' }}>Тема листа</label>
                                <input type="text" required value={newCampaign.subject} onChange={e => setNewCampaign({ ...newCampaign, subject: e.target.value })} style={{ ...searchInput, width: '100%', padding: '10px 16px' }} />
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#475569', marginBottom: '8px' }}>Тип</label>
                                    <select value={newCampaign.type} onChange={e => setNewCampaign({ ...newCampaign, type: e.target.value })} style={{ ...searchInput, width: '100%', padding: '10px', cursor: 'pointer' }}>
                                        <option value="promotion">Акція</option>
                                        <option value="new_product">Новий товар</option>
                                        <option value="birthday">День народження</option>
                                    </select>
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#475569', marginBottom: '8px' }}>Сегмент</label>
                                    <select value={newCampaign.segment} onChange={e => setNewCampaign({ ...newCampaign, segment: e.target.value })} style={{ ...searchInput, width: '100%', padding: '10px', cursor: 'pointer' }}>
                                        <option value="all">Всі підписники</option>
                                        <option value="active">Активні клієнти</option>
                                        <option value="new">Нові клієнти</option>
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#475569', marginBottom: '8px' }}>Текст прев'ю (Snippet)</label>
                                <input type="text" value={newCampaign.preview_text} onChange={e => setNewCampaign({ ...newCampaign, preview_text: e.target.value })} style={{ ...searchInput, width: '100%', padding: '10px 16px' }} />
                            </div>

                            <div>
                                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#475569', marginBottom: '8px' }}>HTML Вміст (або текст)</label>
                                <textarea
                                    required
                                    rows={10}
                                    value={newCampaign.html_body}
                                    onChange={e => setNewCampaign({ ...newCampaign, html_body: e.target.value })}
                                    style={{ ...searchInput, width: '100%', padding: '10px 16px', fontFamily: 'monospace', height: 'auto' }}
                                />
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '16px' }}>
                                <button type="button" onClick={() => setIsCreateCampaignModalOpen(false)} style={btnSecondary}>
                                    Скасувати
                                </button>
                                <button type="submit" style={btnPrimary}>
                                    Зберегти як чернетку
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Config Automation Modal */}
            {isConfigAutomationModalOpen && editingAutomation && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ ...cardStyle, width: '100%', maxWidth: '500px', padding: '24px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                            <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 700, color: '#263A99' }}>Налаштування автоматизації</h2>
                            <button onClick={() => setIsConfigAutomationModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}>
                                <X size={20} />
                            </button>
                        </div>

                        <form onSubmit={handleSaveAutomation} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', backgroundColor: '#f8fafc', borderRadius: '3px', cursor: 'pointer' }}>
                                <input
                                    type="checkbox"
                                    checked={editingAutomation.is_active}
                                    onChange={e => setEditingAutomation({ ...editingAutomation, is_active: e.target.checked })}
                                    style={{ width: '20px', height: '20px' }}
                                />
                                <span style={{ fontWeight: 600, color: '#263A99' }}>Автоматизація активована</span>
                            </label>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#475569', marginBottom: '8px' }}>Значення знижки</label>
                                    <input
                                        type="number"
                                        value={editingAutomation.settings?.discount_value || 0}
                                        onChange={e => setEditingAutomation({ ...editingAutomation, settings: { ...editingAutomation.settings, discount_value: Number(e.target.value) } })}
                                        style={{ ...searchInput, width: '100%', padding: '10px 16px' }}
                                    />
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#475569', marginBottom: '8px' }}>Тип знижки</label>
                                    <select
                                        value={editingAutomation.settings?.discount_type || 'percent'}
                                        onChange={e => setEditingAutomation({ ...editingAutomation, settings: { ...editingAutomation.settings, discount_type: e.target.value } })}
                                        style={{ ...searchInput, width: '100%', padding: '10px' }}
                                    >
                                        <option value="percent">Відсоток (%)</option>
                                        <option value="fixed">Фіксована (₴)</option>
                                    </select>
                                </div>
                            </div>

                            {editingAutomation.type === 'birthday' ? (
                                <div>
                                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#475569', marginBottom: '8px' }}>Термін дії коду (днів)</label>
                                    <input
                                        type="number"
                                        value={editingAutomation.settings?.valid_days || 0}
                                        onChange={e => setEditingAutomation({ ...editingAutomation, settings: { ...editingAutomation.settings, valid_days: Number(e.target.value) } })}
                                        style={{ ...searchInput, width: '100%', padding: '10px 16px' }}
                                    />
                                </div>
                            ) : (
                                <div>
                                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#475569', marginBottom: '8px' }}>Код купону</label>
                                    <input
                                        type="text"
                                        value={editingAutomation.settings?.promo_code || ''}
                                        onChange={e => setEditingAutomation({ ...editingAutomation, settings: { ...editingAutomation.settings, promo_code: e.target.value.toUpperCase() } })}
                                        style={{ ...searchInput, width: '100%', padding: '10px 16px' }}
                                    />
                                </div>
                            )}

                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '16px' }}>
                                <button type="button" onClick={() => setIsConfigAutomationModalOpen(false)} style={btnSecondary}>
                                    Скасувати
                                </button>
                                <button type="submit" style={btnPrimary}>
                                    Зберегти зміни
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

function TabButton({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) {
    return (
        <button
            onClick={onClick}
            style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '12px 16px',
                fontSize: '15px',
                fontWeight: 600,
                color: active ? '#263A99' : '#64748b',
                backgroundColor: 'transparent',
                border: 'none',
                borderBottom: active ? '2px solid #263A99' : '2px solid transparent',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.2s'
            }}
            onMouseOver={(e) => {
                if (!active) e.currentTarget.style.color = '#263A99';
            }}
            onMouseOut={(e) => {
                if (!active) e.currentTarget.style.color = '#64748b';
            }}
        >
            {icon}
            {label}
        </button>
    );
}
