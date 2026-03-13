'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Save, Loader2, Plus, Trash2, Copy, Search } from 'lucide-react';
import { toast } from 'sonner';

export default function CreateOrderPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);

    // Form state
    const [customer, setCustomer] = useState({
        name: '',
        phone: '',
        email: '',
        instagram: '',
        telegram: '',
        birthday: ''
    });

    const [items, setItems] = useState([
        { id: Date.now(), name: '', price: 0, qty: 1, comment: '' }
    ]);

    const [delivery, setDelivery] = useState({
        method: 'Нова Пошта (Відділення)',
        city: '',
        warehouse: '',
        cost: 0
    });

    const [notes, setNotes] = useState('');

    const addItem = () => {
        setItems([...items, { id: Date.now(), name: '', price: 0, qty: 1, comment: '' }]);
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
    const total = subtotal + Number(delivery.cost);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!customer.name || !customer.phone) {
            toast.error('Ім\'я та телефон клієнта є обов\'язковими');
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
                    name: i.name,
                    price: Number(i.price),
                    qty: Number(i.qty),
                    sum: Number(i.price) * Number(i.qty),
                    format: 'Кастомний',
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
                notes: notes ? `\n--- Внутрішні нотатки ---\n${notes}` : ''
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
                        <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '28px', fontWeight: 900, color: '#1e293b' }}>
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
                            <label style={labelStyle}>Ім'я Прізвище *</label>
                            <input
                                required
                                type="text"
                                placeholder="Петро Петренко"
                                value={customer.name}
                                onChange={(e) => setCustomer({ ...customer, name: e.target.value })}
                                style={inputStyle}
                            />
                        </div>
                        <div>
                            <label style={labelStyle}>Телефон *</label>
                            <input
                                required
                                type="text"
                                placeholder="+38"
                                value={customer.phone}
                                onChange={(e) => setCustomer({ ...customer, phone: e.target.value })}
                                style={inputStyle}
                            />
                        </div>
                        <div>
                            <label style={labelStyle}>Email</label>
                            <input
                                type="email"
                                placeholder="petro@example.com"
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
                            <label style={labelStyle}>Дата народження (опціонально)</label>
                            <input
                                type="date"
                                value={customer.birthday}
                                onChange={(e) => setCustomer({ ...customer, birthday: e.target.value })}
                                style={inputStyle}
                            />
                        </div>
                    </div>
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
                            <div key={item.id} style={{ display: 'flex', gap: '16px', alignItems: 'flex-start', padding: '16px', backgroundColor: '#f8fafc', borderRadius: '16px', border: '1px solid #f1f5f9' }}>
                                <div style={{ width: '32px', height: '32px', backgroundColor: '#e2e8f0', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: 800, color: '#64748b', flexShrink: 0 }}>
                                    {index + 1}
                                </div>
                                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '12px' }}>
                                        <div>
                                            <label style={labelStyle}>Назва (вільне введення)</label>
                                            <input
                                                required
                                                type="text"
                                                placeholder="напр. Фотокнига 20х20, 20 стор, шкіра"
                                                value={item.name}
                                                onChange={(e) => updateItem(item.id, 'name', e.target.value)}
                                                style={inputStyle}
                                            />
                                        </div>
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
                                    <div>
                                        <label style={labelStyle}>Коментар до товару</label>
                                        <textarea
                                            placeholder="Наприклад: імена, дати, побажання до оформлення..."
                                            value={item.comment}
                                            onChange={(e) => updateItem(item.id, 'comment', e.target.value)}
                                            style={{ ...inputStyle, resize: 'vertical', minHeight: '60px' }}
                                            rows={2}
                                        />
                                    </div>
                                </div>
                                {items.length > 1 && (
                                    <button type="button" onClick={() => removeItem(item.id)} style={{ padding: '8px', color: '#ef4444', backgroundColor: '#fee2e2', border: 'none', borderRadius: '8px', cursor: 'pointer', marginTop: '24px' }}>
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
                                    <option value="Нова Пошта (Відділення)">Нова Пошта (Відділення)</option>
                                    <option value="Нова Пошта (Поштомат)">Нова Пошта (Поштомат)</option>
                                    <option value="Кур'єр Нова Пошта">Кур'єр Нова Пошта</option>
                                    <option value="Самовивіз">Самовивіз</option>
                                    <option value="Міжнародна (Укрпошта)">Міжнародна (Укрпошта)</option>
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

                        <div style={{ backgroundColor: '#f8fafc', padding: '20px', borderRadius: '16px', border: '1px solid #f1f5f9', marginTop: 'auto' }}>
                            <div style={totalRowStyle}>
                                <span>Товари:</span>
                                <span>{subtotal} ₴</span>
                            </div>
                            <div style={totalRowStyle}>
                                <span>Доставка:</span>
                                <span>{delivery.cost || 0} ₴</span>
                            </div>
                            <div style={{ ...totalRowStyle, borderTop: '2px dashed #cbd5e1', paddingTop: '16px', marginTop: '16px', fontSize: '24px', color: 'var(--primary)', fontWeight: 900 }}>
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
                        {loading ? <Loader2 size={18} className="spin" /> : <Save size={18} />}
                        Зберегти та створити замовлення
                    </button>
                </div>
            </form>

            <style jsx>{`
                .spin { animation: spin 1s linear infinite; }
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
            `}</style>
        </div>
    );
}

// Styling Constants
const cardStyle = { backgroundColor: 'white', padding: '32px', borderRadius: '32px', border: '1px solid #f1f5f9', boxShadow: '0 4px 25px rgba(0,0,0,0.02)' };
const cardTitleStyle = { fontSize: '18px', fontWeight: 800, color: '#1e293b', marginBottom: '24px' };
const backBtnStyle = { display: 'flex', alignItems: 'center', justifyContent: 'center', width: '44px', height: '44px', borderRadius: '12px', backgroundColor: 'white', border: '1.5px solid #e2e8f0', color: '#64748b', cursor: 'pointer' };
const labelStyle = { display: 'block', fontSize: '12px', fontWeight: 800, color: '#475569', marginBottom: '8px' };
const inputStyle = { width: '100%', padding: '12px 16px', borderRadius: '12px', border: '1.5px solid #e2e8f0', outline: 'none', fontSize: '15px', color: '#1e293b', backgroundColor: 'white', fontFamily: 'inherit' };
const selectStyle = { ...inputStyle, appearance: 'none' as any, cursor: 'pointer', backgroundImage: 'url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%2364748b\' stroke-width=\'2\' stroke-linecap=\'round\' stroke-linejoin=\'round\'%3e%3cpolyline points=\'6 9 12 15 18 9\'%3e%3c/polyline%3e%3c/svg%3e")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 16px center', backgroundSize: '16px' };
const totalRowStyle = { display: 'flex', justifyContent: 'space-between', fontSize: '15px', fontWeight: 700, color: '#475569', marginBottom: '8px' };
const btnPrimaryStyle = { padding: '14px 28px', backgroundColor: 'var(--primary)', color: 'white', borderRadius: '14px', border: 'none', fontWeight: 800, fontSize: '15px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', opacity: 1, transition: 'all 0.2s' };
const btnSecondaryStyle = { padding: '14px 24px', backgroundColor: 'white', color: '#475569', borderRadius: '14px', border: '1.5px solid #e2e8f0', fontWeight: 700, fontSize: '15px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' };
