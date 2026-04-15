'use client';
import { useState, useEffect } from 'react';
import styles from './admin-new-order.module.css';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Save, Loader2, Plus, Trash2, Copy, Search, Tag, ChevronDown, Package } from 'lucide-react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';

export default function CreateOrderPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);

    // Form state
    const [customer, setCustomer] = useState({
        first_name: '',
        last_name: '',
        phone: '',
        email: '',
        instagram: '',
        telegram: '',
        birthday: ''
    });

    const [allProducts, setAllProducts] = useState<any[]>([]);
    const [allCategories, setAllCategories] = useState<any[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [isProductDropdownOpen, setIsProductDropdownOpen] = useState<number | null>(null);

    const [items, setItems] = useState<any[]>([
        { id: Date.now(), product_id: '', variant_id: '', name: '', price: 0, cost_price: 0, qty: 1, comment: '', variants: [], options: [], selected_options: {} }
    ]);

    const [delivery, setDelivery] = useState({
        method: 'nova_poshta_warehouse',
        city: '',
        warehouse: '',
        cost: 0
    });

    const [notes, setNotes] = useState('');
    const [source, setSource] = useState('instagram');
    const [paymentStatus, setPaymentStatus] = useState('pending');
    const [bankAccountId, setBankAccountId] = useState('');
    const [paidAmount, setPaidAmount] = useState(0);
    const [bankAccounts, setBankAccounts] = useState<any[]>([]);

    const supabase = createClient();

    useEffect(() => {
        const fetchData = async () => {
            const { data: bankData } = await supabase.from('bank_accounts').select('id, bank_name, label, card_number, currency').eq('is_active', true).order('bank_name');
            if (bankData) setBankAccounts(bankData);
            const { data: catData } = await supabase.from('categories').select('*').order('sort_order');
            const { data: prodData } = await supabase.from('products').select('*').eq('is_active', true);
            if (catData) setAllCategories(catData);
            if (prodData) setAllProducts(prodData);
        };
        fetchData();
    }, [supabase]);

    const addItem = () => {
        setItems([...items, { id: Date.now(), product_id: '', variant_id: '', name: '', price: 0, cost_price: 0, qty: 1, comment: '', variants: [], options: [], selected_options: {} }]);
    };

    const removeItem = (id: number) => {
        if (items.length === 1) return;
        setItems(items.filter(item => item.id !== id));
    };

    const updateItem = (id: number, field: string, value: any) => {
        setItems(items.map(item => item.id === id ? { ...item, [field]: value } : item));
    };

    // Calculate totals
    const subtotal = items.reduce((acc, item) => acc + (item.price * item.qty), 0);
    const subtotalCost = items.reduce((acc, item) => acc + ((item.cost_price || 0) * item.qty), 0);
    const total = subtotal + Number(delivery.cost);
    const profit = subtotal - subtotalCost;
    const margin = subtotal > 0 ? (profit / subtotal) * 100 : 0;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!customer.first_name || !customer.last_name || !customer.phone) {
            toast.error('Ім\'я, Прізвище та телефон клієнта є обов\'язковими');
            return;
        }

        if (items.some(item => !item.name.trim())) {
            toast.error('Всі товари повинні мати назви');
            return;
        }

        setLoading(true);
        toast.loading('Створення замовлення...', { id: 'create-order' });

        try {
            const payload = {
                customer,
                items: items.map(i => ({
                    product_id: i.product_id,
                    variant_id: i.variant_id,
                    name: i.name,
                    price: Number(i.price),
                    cost_price: Number(i.cost_price || 0),
                    qty: Number(i.qty),
                    sum: Number(i.price) * Number(i.qty),
                    format: Object.entries(i.selected_options || {}).map(([k,v]) => `${k}: ${v}`).join(', ') || 'Кастомний',
                    selected_options: i.selected_options || {},
                    comment: i.comment || ''
                })),
                delivery: {
                    method: delivery.method,
                    cost: Number(delivery.cost),
                    address: { city: delivery.city, warehouse: delivery.warehouse }
                },
                totals: {
                    subtotal,
                    total
                },
                notes: notes ? `\n--- Внутрішні нотатки ---\n${notes}` : '',
                payment: {
                    status: paymentStatus,
                    bank_account_id: bankAccountId || null,
                    paid_amount: paymentStatus === 'paid' ? (paidAmount || total)
                        : paymentStatus === 'partial' ? paidAmount : 0,
                },
                source
            };

            const res = await fetch('/api/admin/orders/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const data = await res.json();

            if (!res.ok) throw new Error(data.error || 'Помилка при створенні');

            toast.success(`Замовлення ${data.order_number} створено!`, { id: 'create-order' });
            router.push(`/admin/orders/${data.id}`);

        } catch (error: any) {
            console.error(error);
            toast.error(error.message, { id: 'create-order' });
            setLoading(false);
        }
    };

    return (
        <div style={{ maxWidth: '1000px', margin: '0 auto', paddingBottom: '80px' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <button onClick={() => router.back()} style={backBtnStyle} type="button">
                        <ArrowLeft size={20} />
                    </button>
                    <div>
                        <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '28px', fontWeight: 900, color: '#263A99' }}>
                            Створити замовлення
                        </h1>
                        <p style={{ color: '#64748b' }}>Ручне введення для замовлень з соцмереж (Instagram, Telegram тощо)</p>
                    </div>
                </div>
            </div>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
                {/* Customer Section */}
                <div style={cardStyle}>
                    <h2 style={cardTitleStyle}>Клієнт</h2>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                        <div>
                            <label style={labelStyle}>Ім'я *</label>
                            <input
                                required
                                type="text"
                                placeholder="Петро"
                                value={customer.first_name}
                                onChange={(e) => setCustomer({ ...customer, first_name: e.target.value })}
                                style={inputStyle}
                            />
                        </div>
                        <div>
                            <label style={labelStyle}>Прізвище *</label>
                            <input
                                required
                                type="text"
                                placeholder="Петренко"
                                value={customer.last_name}
                                onChange={(e) => setCustomer({ ...customer, last_name: e.target.value })}
                                style={inputStyle}
                            />
                        </div>
                        <div>
                            <label style={labelStyle}>Телефон *</label>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <select
                                    style={{ ...selectStyle, width: '100px', flexShrink: 0 }}
                                    disabled
                                >
                                    <option> +380</option>
                                </select>
                                <input
                                    required
                                    type="tel"
                                    placeholder="671234567"
                                    value={customer.phone}
                                    onChange={(e) => setCustomer({ ...customer, phone: e.target.value.replace(/\D/g, '') })}
                                    style={inputStyle}
                                />
                            </div>
                        </div>
                        <div>
                            <label style={labelStyle}>Email</label>
                            <input
                                type="email"
                                placeholder="client@example.com"
                                value={customer.email}
                                onChange={(e) => setCustomer({ ...customer, email: e.target.value })}
                                style={inputStyle}
                            />
                        </div>
                        <div>
                            <label style={labelStyle}>Instagram Nickname (опціонально)</label>
                            <input
                                type="text"
                                placeholder="@petro_petrenko"
                                value={customer.instagram}
                                onChange={(e) => setCustomer({ ...customer, instagram: e.target.value })}
                                style={inputStyle}
                            />
                        </div>
                        <div>
                            <label style={labelStyle}>Telegram Nickname (опціонально)</label>
                            <input
                                type="text"
                                placeholder="@username"
                                value={customer.telegram}
                                onChange={(e) => setCustomer({ ...customer, telegram: e.target.value })}
                                style={inputStyle}
                            />
                        </div>
                        <div>
                            <label style={labelStyle}>Дата народження</label>
                            <input
                                type="text"
                                placeholder="ДД.ММ.РРРР"
                                value={customer.birthday}
                                onChange={(e) => {
                                    let val = e.target.value.replace(/\D/g, '');
                                    if (val.length > 8) val = val.substring(0, 8);
                                    let formatted = val;
                                    if (val.length > 2) formatted = val.substring(0, 2) + '.' + val.substring(2);
                                    if (val.length > 4) formatted = val.substring(0, 2) + '.' + val.substring(2, 4) + '.' + val.substring(4);
                                    setCustomer({ ...customer, birthday: formatted });
                                }}
                                style={inputStyle}
                                maxLength={10}
                            />
                        </div>
                    </div>
                </div>

                {/* Source */}
                <div style={cardStyle}>
                    <h2 style={cardTitleStyle}>Джерело замовлення</h2>
                    <select value={source} onChange={e => setSource(e.target.value)} style={inputStyle}>
                        <option value="instagram">Instagram</option>
                        <option value="site">Сайт</option>
                        <option value="telegram">Telegram</option>
                        <option value="phone">Телефон</option>
                        <option value="manual">Вручну</option>
                        <option value="other">Інше</option>
                    </select>
                </div>

                {/* Items Section */}
                <div style={cardStyle}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                        <h2 style={{ ...cardTitleStyle, margin: 0 }}>Товари</h2>
                        <button type="button" onClick={addItem} style={btnSecondaryStyle}>
                            <Plus size={16} /> Додати товар
                        </button>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        {items.map((item, index) => (
                            <div key={item.id} style={{ display: 'flex', gap: '16px', alignItems: 'flex-start', padding: '16px', backgroundColor: '#f8fafc', borderRadius: "3px", border: '1px solid #f1f5f9' }}>
                                <div style={{ width: '32px', height: '32px', backgroundColor: '#e2e8f0', borderRadius: "3px", display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: 800, color: '#64748b', flexShrink: 0 }}>
                                    {index + 1}
                                </div>
                                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '12px' }}>
                                        <div style={{ position: 'relative' }}>
                                            <label style={labelStyle}>Товар *</label>
                                            <div style={{ position: 'relative' }}>
                                                <input
                                                    type="text"
                                                    placeholder="Пошук товару за назвою..."
                                                    value={item.name}
                                                    onChange={(e) => {
                                                        updateItem(item.id, 'name', e.target.value);
                                                        setIsProductDropdownOpen(index);
                                                    }}
                                                    onFocus={() => setIsProductDropdownOpen(index)}
                                                    style={{ ...inputStyle, paddingLeft: '40px' }}
                                                />
                                                <Search size={16} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                                            </div>

                                            {isProductDropdownOpen === index && (
                                                <div style={dropdownStyle}>
                                                    {allCategories.map(cat => {
                                                        const catProducts = allProducts.filter(p =>
                                                            p.category_id === cat.id &&
                                                            (p.name.toLowerCase().includes(item.name.toLowerCase()) || !item.name)
                                                        );
                                                        if (catProducts.length === 0) return null;
                                                        return (
                                                            <div key={cat.id}>
                                                                <div style={categoryHeaderStyle}> {cat.name} </div>
                                                                {catProducts.map(p => (
                                                                    <div
                                                                        key={p.id}
                                                                        onClick={() => {
                                                                            setItems(prev => prev.map(it => it.id === item.id ? {
                                                                                ...it,
                                                                                product_id: p.id,
                                                                                name: p.name,
                                                                                price: p.price,
                                                                                cost_price: p.cost_price || 0,
                                                                                variants: p.variants || [],
                                                                                options: p.options || [],
                                                                                selected_options: {},
                                                                            } : it));
                                                                            setIsProductDropdownOpen(null);
                                                                        }}
                                                                        style={dropdownItemStyle}
                                                                    >
                                                                        <div style={{ fontWeight: 600 }}>{p.name}</div>
                                                                        <div style={{ fontSize: '12px', color: '#64748b' }}>від {p.price} ₴</div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        );
                                                    })}
                                                    <div onClick={() => setIsProductDropdownOpen(null)} style={{ padding: '8px', textAlign: 'center', fontSize: '11px', color: '#94a3b8', cursor: 'pointer', borderTop: '1px solid #f1f5f9' }}>закрити</div>
                                                </div>
                                            )}
                                        </div>
                                        <div>
                                            <label style={labelStyle}>Варіант</label>
                                            {item.variants && item.variants.length > 0 ? (
                                                <select
                                                    value={item.variant_id}
                                                    onChange={(e) => {
                                                        const variant = item.variants.find((v: any) => v.id === e.target.value);
                                                        if (variant) {
                                                            updateItem(item.id, 'variant_id', variant.id);
                                                            updateItem(item.id, 'price', variant.price);
                                                            updateItem(item.id, 'cost_price', variant.cost_price || 0);
                                                        }
                                                    }}
                                                    style={selectStyle}
                                                >
                                                    <option value="">Оберіть варіант</option>
                                                    {item.variants.map((v: any) => (
                                                        <option key={v.id} value={v.id}>{v.name} ({v.price} ₴)</option>
                                                    ))}
                                                </select>
                                            ) : (
                                                <div style={{ ...inputStyle, backgroundColor: '#f1f5f9', color: '#94a3b8', fontSize: '13px' }}>Немає варіантів</div>
                                            )}
                                        </div>
                                        <div>
                                            <label style={labelStyle}>Кількість</label>
                                            <input
                                                required
                                                type="number"
                                                min="1"
                                                value={item.qty}
                                                onChange={(e) => updateItem(item.id, 'qty', Number(e.target.value))}
                                                style={inputStyle}
                                            />
                                        </div>
                                    </div>
                                    {/* Product Options / Characteristics */}
                                    {item.options && item.options.length > 0 && (
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '12px', padding: '12px', backgroundColor: '#f8fafc', borderRadius: 4, border: '1px solid #e2e8f0' }}>
                                            {item.options.map((opt: any) => (
                                                <div key={opt.name}>
                                                    <label style={{ ...labelStyle, fontSize: 11, color: '#64748b', marginBottom: 4 }}>{opt.name}</label>
                                                    <select
                                                        value={(item.selected_options || {})[opt.name] || ''}
                                                        onChange={e => {
                                                            const val = e.target.value;
                                                            const newOpts = { ...(item.selected_options || {}), [opt.name]: val };
                                                            const basePrice = allProducts.find((p: any) => p.id === item.product_id)?.price || 0;
                                                            const totalExtra = item.options.reduce((acc: number, o: any) => {
                                                                const sel = o.options?.find((x: any) => x.value === newOpts[o.name]);
                                                                return acc + (sel?.price || 0);
                                                            }, 0);
                                                            setItems(prev => prev.map(it => it.id === item.id ? { ...it, selected_options: newOpts, price: basePrice + totalExtra } : it));
                                                        }}
                                                        style={{ ...selectStyle, fontSize: 13 }}
                                                    >
                                                        <option value="">Оберіть...</option>
                                                        {opt.options?.map((o: any) => (
                                                            <option key={o.value} value={o.value}>
                                                                {o.label}{o.price > 0 ? ` (+${o.price} ₴)` : ''}
                                                            </option>
                                                        ))}
                                                    </select>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '12px' }}>
                                        <div>
                                            <label style={labelStyle}>Ціна (₴)</label>
                                            <input
                                                required
                                                type="number"
                                                min="0"
                                                value={item.price || ''}
                                                onChange={(e) => updateItem(item.id, 'price', Number(e.target.value))}
                                                style={inputStyle}
                                            />
                                        </div>
                                        <div>
                                            <label style={labelStyle}>Коментар до товару</label>
                                            <input
                                                placeholder="напр. Розмір, матеріал, напис..."
                                                value={item.comment}
                                                onChange={(e) => updateItem(item.id, 'comment', e.target.value)}
                                                style={inputStyle}
                                            />
                                        </div>
                                    </div>
                                </div>
                                {items.length > 1 && (
                                    <button type="button" onClick={() => removeItem(item.id)} style={{ padding: '8px', color: '#ef4444', backgroundColor: '#fee2e2', border: 'none', borderRadius: "3px", cursor: 'pointer', marginTop: '24px' }}>
                                        <Trash2 size={18} />
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Delivery & Totals Section */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px' }}>
                    <div style={cardStyle}>
                        <h2 style={cardTitleStyle}>Доставка</h2>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <div>
                                <label style={labelStyle}>Спосіб доставки</label>
                                <select
                                    value={delivery.method}
                                    onChange={(e) => setDelivery({ ...delivery, method: e.target.value })}
                                    style={selectStyle}
                                >
                                    <option value="nova_poshta_warehouse">Нова Пошта (Відділення)</option>
                                    <option value="nova_poshta_poshtomat">Нова Пошта (Поштомат)</option>
                                    <option value="nova_poshta_courier">Нова Пошта (Кур'єр)</option>
                                    <option value="pickup">Самовивіз</option>
                                    <option value="international">Міжнародна доставка</option>
                                    <option value="other">Інше</option>
                                </select>
                            </div>
                            <div>
                                <label style={labelStyle}>Місто</label>
                                <input
                                    type="text"
                                    placeholder="Київ"
                                    value={delivery.city}
                                    onChange={(e) => setDelivery({ ...delivery, city: e.target.value })}
                                    style={inputStyle}
                                />
                            </div>
                            <div>
                                <label style={labelStyle}>Відділення / Адреса</label>
                                <input
                                    type="text"
                                    placeholder="Відділення №1"
                                    value={delivery.warehouse}
                                    onChange={(e) => setDelivery({ ...delivery, warehouse: e.target.value })}
                                    style={inputStyle}
                                />
                            </div>
                        </div>
                    </div>

                {/*  Payment Section  */}
                <div style={cardStyle}>
                    <h2 style={cardTitleStyle}>Оплата</h2>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                        {/* Payment status */}
                        <div>
                            <label style={labelStyle}>Статус оплати *</label>
                            <select
                                value={paymentStatus}
                                onChange={e => setPaymentStatus(e.target.value)}
                                style={inputStyle}
                            >
                                <option value="pending">⏳ Очікує оплати</option>
                                <option value="partial"> Часткова оплата</option>
                                <option value="paid"> Оплачено повністю</option>
                                <option value="refunded">↩ Повернення</option>
                            </select>
                        </div>

                        {/* Paid amount — shown for partial */}
                        {paymentStatus === 'partial' && (
                            <div>
                                <label style={labelStyle}>Сума оплаты (₴) *</label>
                                <input
                                    type="number"
                                    min="0"
                                    value={paidAmount}
                                    onChange={e => setPaidAmount(Number(e.target.value))}
                                    placeholder="0"
                                    style={inputStyle}
                                />
                            </div>
                        )}

                        {/* Payment account */}
                        {paymentStatus !== 'pending' && (
                            <div style={paymentStatus === 'partial' ? { gridColumn: '1 / -1' } : {}}>
                                <label style={labelStyle}>Рахунок отримання</label>
                                {bankAccounts.length > 0 ? (
                                    <select
                                        value={bankAccountId}
                                        onChange={e => setBankAccountId(e.target.value)}
                                        style={inputStyle}
                                    >
                                        <option value="">— Оберіть рахунок —</option>
                                        {bankAccounts.map(acc => (
                                            <option key={acc.id} value={acc.id}>
                                                {acc.bank_name}{acc.label ? ` · ${acc.label}` : ''}{acc.card_number ? ` · ${acc.card_number.slice(-4)}` : ''}
                                            </option>
                                        ))}
                                    </select>
                                ) : (
                                    <div style={{ padding: '10px 14px', border: '1px dashed #cbd5e1', borderRadius: 4, fontSize: 13, color: '#94a3b8', backgroundColor: '#f8fafc' }}>
                                        Рахунки не налаштовані.{' '}
                                        <a href="/admin/settings/finance/banks" target="_blank" style={{ color: '#263A99', textDecoration: 'underline' }}>
                                            Додати рахунок →
                                        </a>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Summary hint */}
                    {paymentStatus !== 'pending' && (
                        <div style={{ marginTop: 16, padding: '10px 16px', background: paymentStatus === 'paid' ? '#f0fdf4' : '#fffbeb', borderRadius: 4, border: `1px solid ${paymentStatus === 'paid' ? '#bbf7d0' : '#fde68a'}`, fontSize: 13, color: paymentStatus === 'paid' ? '#166534' : '#92400e', display: 'flex', alignItems: 'center', gap: 8 }}>
                            {paymentStatus === 'paid' && ` Замовлення буде позначено як повністю оплачене на суму ${total} ₴`}
                            {paymentStatus === 'partial' && ` Часткова оплата: ${paidAmount} ₴ з ${total} ₴. Залишок: ${total - paidAmount} ₴`}
                            {paymentStatus === 'refunded' && '↩ Замовлення буде позначено як повернення'}
                        </div>
                    )}
                </div>


                    <div style={{ ...cardStyle, display: 'flex', flexDirection: 'column' }}>
                        <h2 style={cardTitleStyle}>Підсумок</h2>
                        <div style={{ flex: 1 }}>
                            <div style={{ marginBottom: '16px' }}>
                                <label style={labelStyle}>Вартість доставки (₴) - Опціонально</label>
                                <input
                                    type="number"
                                    min="0"
                                    value={delivery.cost}
                                    onChange={(e) => setDelivery({ ...delivery, cost: Number(e.target.value) })}
                                    style={inputStyle}
                                />
                            </div>
                            <div style={{ marginBottom: '16px' }}>
                                <label style={labelStyle}>Додаткові нотатки до замовлення</label>
                                <textarea
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                    placeholder="Коментар від менеджера..."
                                    style={{ ...inputStyle, resize: 'vertical', minHeight: '80px' }}
                                    rows={3}
                                />
                            </div>
                        </div>

                        <div style={{ backgroundColor: '#f8fafc', padding: '20px', borderRadius: "3px", border: '1px solid #f1f5f9', marginTop: 'auto' }}>
                            <div style={totalRowStyle}>
                                <span>Товари ({items.length} шт):</span>
                                <span>{subtotal} ₴</span>
                            </div>
                            <div style={totalRowStyle}>
                                <span>Доставка:</span>
                                <span>{delivery.cost || 0} ₴</span>
                            </div>
                            <div style={{ ...totalRowStyle, color: '#64748b', fontSize: '13px', borderTop: '1px solid #f1f5f9', paddingTop: '8px', marginTop: '8px' }}>
                                <span>Собівартість:</span>
                                <span>{subtotalCost} ₴</span>
                            </div>
                            <div style={{ ...totalRowStyle, color: '#10b981', fontSize: '13px' }}>
                                <span>Прибуток:</span>
                                <span>{profit} ₴</span>
                            </div>
                            <div style={{ ...totalRowStyle, color: '#263A99', fontSize: '13px' }}>
                                <span>Маржа:</span>
                                <span>{margin.toFixed(1)}%</span>
                            </div>
                            <div style={{ ...totalRowStyle, borderTop: '2px dashed #cbd5e1', paddingTop: '16px', marginTop: '16px', fontSize: '24px', color: '#263A99', fontWeight: 900 }}>
                                <span>Разом:</span>
                                <span>{total} ₴</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer Actions */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '16px', borderTop: '1px solid #e2e8f0', paddingTop: '32px' }}>
                    <button type="button" onClick={() => router.back()} style={btnSecondaryStyle}>
                        Скасувати
                    </button>
                    <button type="submit" disabled={loading} style={btnPrimaryStyle}>
                        {loading ? <Loader2 size={18} className={styles.spin} /> : <Save size={18} />}
                        Зберегти та створити замовлення
                    </button>
                </div>
            </form>

        </div>
    );
}

// Styling Constants
const cardStyle = { backgroundColor: 'white', padding: '32px', borderRadius: "3px", border: '1px solid #f1f5f9', boxShadow: '0 4px 25px rgba(0,0,0,0.02)' };
const cardTitleStyle = { fontSize: '18px', fontWeight: 800, color: '#263A99', marginBottom: '24px' };
const backBtnStyle = { display: 'flex', alignItems: 'center', justifyContent: 'center', width: '44px', height: '44px', borderRadius: "3px", backgroundColor: 'white', border: '1.5px solid #e2e8f0', color: '#64748b', cursor: 'pointer' };
const labelStyle = { display: 'block', fontSize: '12px', fontWeight: 600, color: '#64748b', marginBottom: '6px' };

const dropdownStyle: React.CSSProperties = {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    border: '1px solid #e2e8f0',
    borderRadius: "3px",
    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
    zIndex: 50,
    maxHeight: '300px',
    overflowY: 'auto'
};

const categoryHeaderStyle: React.CSSProperties = {
    padding: '8px 12px',
    fontSize: '11px',
    fontWeight: 800,
    color: '#94a3b8',
    backgroundColor: '#f8fafc',
    textTransform: 'uppercase',
    letterSpacing: '0.05em'
};

const dropdownItemStyle: React.CSSProperties = {
    padding: '10px 12px',
    cursor: 'pointer',
    borderBottom: '1px solid #f1f5f9',
    transition: 'background-color 0.2s',
    fontSize: '14px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
};
const inputStyle = { width: '100%', padding: '12px 16px', borderRadius: "3px", border: '1.5px solid #e2e8f0', outline: 'none', fontSize: '15px', color: '#263A99', backgroundColor: 'white', fontFamily: 'inherit' };
const selectStyle = { ...inputStyle, appearance: 'none' as any, cursor: 'pointer', backgroundImage: 'url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%2364748b\' stroke-width=\'2\' stroke-linecap=\'round\' stroke-linejoin=\'round\'%3e%3cpolyline points=\'6 9 12 15 18 9\'%3e%3c/polyline%3e%3c/svg%3e")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 16px center', backgroundSize: '16px' };
const totalRowStyle = { display: 'flex', justifyContent: 'space-between', fontSize: '15px', fontWeight: 700, color: '#475569', marginBottom: '8px' };
const btnPrimaryStyle = { padding: '14px 28px', backgroundColor: 'var(--primary)', color: 'white', borderRadius: "3px", border: 'none', fontWeight: 800, fontSize: '15px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', opacity: 1, transition: 'all 0.2s' };
const btnSecondaryStyle = { padding: '14px 24px', backgroundColor: 'white', color: '#475569', borderRadius: "3px", border: '1.5px solid #e2e8f0', fontWeight: 700, fontSize: '15px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' };
