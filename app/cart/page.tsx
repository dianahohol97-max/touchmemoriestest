'use client';
import { useState, useEffect, useMemo } from 'react';
import styles from './cart.module.css';
import { useCartStore } from '@/store/cart-store';
import { Navigation } from '@/components/ui/Navigation';
import { Footer } from '@/components/ui/Footer';
import Image from 'next/image';
import { Trash2, Plus, Minus, MapPin, Truck, ChevronRight, Loader2, CreditCard } from 'lucide-react';
import { toast } from 'sonner';
import { logCartEvent } from '@/lib/analytics';


export default function CartPage() {
    const { items, removeItem, updateQuantity, getTotal, clearCart } = useCartStore();
    const [loading, setLoading] = useState(false);

    // Track checkout initiation
    useEffect(() => {
        if (items.length > 0) {
            logCartEvent('begin_checkout');
        }
    }, [items.length]);

    // Form State

    const [customer, setCustomer] = useState({ name: '', email: '', phone: '' });
    const [deliveryMethod, setDeliveryMethod] = useState('np-warehouse'); // np-warehouse, np-courier, pickup, international
    const [deliveryInfo, setDeliveryInfo] = useState({ city: '', cityRef: '', warehouse: '', warehouseRef: '', address: '', country: '', zip: '' });

    // NP Search State
    const [cities, setCities] = useState<any[]>([]);
    const [citySearch, setCitySearch] = useState('');
    const [warehouses, setWarehouses] = useState<any[]>([]);
    const [isSearchingCities, setIsSearchingCities] = useState(false);
    const [isSearchingWarehouses, setIsSearchingWarehouses] = useState(false);

    // City Search Debounce
    useEffect(() => {
        if (citySearch.length < 2) { setCities([]); return; }

        const delay = setTimeout(async () => {
            setIsSearchingCities(true);
            try {
                const res = await fetch('/api/novaposhta', {
                    method: 'POST',
                    body: JSON.stringify({
                        modelName: 'Address',
                        calledMethod: 'getCities',
                        methodProperties: { FindByString: citySearch, Limit: '20' }
                    })
                });
                const data = await res.json();
                if (data.success) setCities(data.data);
            } catch (e) { console.error('City search error:', e); }
            setIsSearchingCities(false);
        }, 500);

        return () => clearTimeout(delay);
    }, [citySearch]);

    // Warehouse Search when city selected
    useEffect(() => {
        if (!deliveryInfo.cityRef || deliveryMethod !== 'np-warehouse') { setWarehouses([]); return; }

        const fetchWarehouses = async () => {
            setIsSearchingWarehouses(true);
            try {
                const res = await fetch('/api/novaposhta', {
                    method: 'POST',
                    body: JSON.stringify({
                        modelName: 'Address',
                        calledMethod: 'getWarehouses',
                        methodProperties: { CityRef: deliveryInfo.cityRef }
                    })
                });
                const data = await res.json();
                if (data.success) setWarehouses(data.data);
            } catch (e) { console.error('Warehouse search error:', e); }
            setIsSearchingWarehouses(false);
        };

        fetchWarehouses();
    }, [deliveryInfo.cityRef, deliveryMethod]);

    const handleCheckout = async () => {
        if (!customer.name || !customer.email || !customer.phone) { toast.error('Заповніть контактні дані'); return; }
        if (items.length === 0) { toast.error('Кошик порожній'); return; }

        setLoading(true);
        try {
            const res = await fetch('/api/checkout/create-invoice', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    customer,
                    items,
                    delivery: { method: deliveryMethod, info: deliveryInfo },
                    total: getTotal()
                })
            });
            const data = await res.json();

            if (data.success && data.pageUrl) {
                window.location.href = data.pageUrl;
            } else {
                toast.error(data.error || 'Помилка при створенні замовлення');
            }
        } catch (e) {
            toast.error('Щось пішло не так. Спробуйте пізніше');
        }
        setLoading(false);
    };

    const total = getTotal();

    return (
        <div style={{ minHeight: '100vh', backgroundColor: '#fcfcfc' }}>
            <Navigation />

            <main style={{ padding: '140px 20px 80px', maxWidth: '1200px', margin: '0 auto' }}>
                <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '40px', fontWeight: 900, marginBottom: '40px' }}>
                    Ваш кошик
                </h1>

                {items.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '80px 0' }}>
                        <p style={{ fontSize: '20px', color: '#888', marginBottom: '32px' }}>Кошик порожній</p>
                        <a href="/catalog" style={actionBtnStyle} className="hover-lift">До каталогу</a>
                    </div>
                ) : (
                    <div className={styles.cartGrid} style={{ display: 'grid', gridTemplateColumns: '1fr 400px', gap: '60px' }}>

                        {/* Left Column: Items & Shipping */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '40px' }}>

                            {/* Items List */}
                            <div style={cardStyle}>
                                <h2 style={{ fontSize: '20px', fontWeight: 800, marginBottom: '24px' }}>Товари ({items.length})</h2>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                                    {items.map((item) => (
                                        <div key={item.id} style={{ display: 'flex', gap: '20px', alignItems: 'center', paddingBottom: '24px', borderBottom: '1px solid #f0f0f0' }}>
                                            <div style={{ width: '80px', height: '80px', borderRadius: '12px', overflow: 'hidden', position: 'relative' }}>
                                                <Image src={item.image || ''} alt={item.name} fill style={{ objectFit: 'cover' }} />
                                            </div>
                                            <div style={{ flex: 1 }}>
                                                <div style={{ fontWeight: 800, fontSize: '16px', marginBottom: '4px' }}>{item.name}</div>
                                                <div style={{ fontSize: '13px', color: '#888' }}>
                                                    {item.options?.format} • {item.options?.cover} • {item.options?.pages} стор.
                                                </div>
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', background: '#f8fafc', padding: '6px', borderRadius: '8px' }}>
                                                <button onClick={() => updateQuantity(item.id, item.qty - 1)} style={qtyBtnStyle}><Minus size={14} /></button>
                                                <span style={{ fontWeight: 700, minWidth: '20px', textAlign: 'center' }}>{item.qty}</span>
                                                <button onClick={() => updateQuantity(item.id, item.qty + 1)} style={qtyBtnStyle}><Plus size={14} /></button>
                                            </div>
                                            <div style={{ fontWeight: 800, fontSize: '16px', minWidth: '80px', textAlign: 'right' }}>
                                                {item.price * item.qty} ₴
                                            </div>
                                            <button onClick={() => removeItem(item.id)} style={{ padding: '8px', border: 'none', background: 'transparent', cursor: 'pointer', color: '#ff4d4d' }}>
                                                <Trash2 size={20} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Delivery Section */}
                            <div style={cardStyle}>
                                <h2 style={{ fontSize: '20px', fontWeight: 800, marginBottom: '24px' }}>Доставка та отримувач</h2>

                                {/* Contact Info */}
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '32px' }}>
                                    <input placeholder="Ім'я та Прізвище" style={inputStyle} value={customer.name} onChange={e => setCustomer({ ...customer, name: e.target.value })} />
                                    <input placeholder="Email" style={inputStyle} value={customer.email} onChange={e => setCustomer({ ...customer, email: e.target.value })} />
                                    <input placeholder="Телефон" style={inputStyle} value={customer.phone} onChange={e => setCustomer({ ...customer, phone: e.target.value })} />
                                </div>

                                {/* Delivery Methods */}
                                <h3 style={sectionLabelStyle}>Спосіб доставки</h3>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px', marginBottom: '24px' }}>
                                    {[
                                        { id: 'np-warehouse', label: 'НП Відділення', icon: <Truck size={18} /> },
                                        { id: 'np-courier', label: 'НП Курʼєр', icon: <MapPin size={18} /> },
                                        { id: 'pickup', label: 'Самовивіз', icon: <ChevronRight size={18} /> },
                                        { id: 'international', label: 'Міжнародна', icon: <ChevronRight size={18} /> }
                                    ].map(m => (
                                        <button
                                            key={m.id}
                                            onClick={() => setDeliveryMethod(m.id)}
                                            style={{
                                                ...methodBtnStyle,
                                                borderColor: deliveryMethod === m.id ? 'var(--primary)' : '#e2e8f0',
                                                backgroundColor: deliveryMethod === m.id ? 'rgba(var(--primary-rgb), 0.05)' : 'white',
                                                color: deliveryMethod === m.id ? 'var(--primary)' : '#444'
                                            }}
                                        >
                                            {m.icon} <span>{m.label}</span>
                                        </button>
                                    ))}
                                </div>

                                {/* Delivery Form Details */}
                                {deliveryMethod === 'np-warehouse' && (
                                    <div style={{ display: 'grid', gap: '16px' }}>
                                        <div style={{ position: 'relative' }}>
                                            <input
                                                placeholder="Введіть місто..."
                                                style={inputStyle}
                                                value={citySearch}
                                                onChange={e => { setCitySearch(e.target.value); setDeliveryInfo({ ...deliveryInfo, city: '', cityRef: '' }); }}
                                            />
                                            {isSearchingCities && <Loader2 size={18} style={{ position: 'absolute', right: '16px', top: '16px' }} className={styles.spin} />}
                                            {cities.length > 0 && !deliveryInfo.cityRef && (
                                                <div style={dropdownStyle}>
                                                    {cities.map(c => (
                                                        <div key={c.Ref} style={dropdownItemStyle} onClick={() => { setDeliveryInfo({ ...deliveryInfo, city: c.Description, cityRef: c.Ref }); setCitySearch(c.Description); setCities([]); }}>
                                                            {c.Description}, {c.AreaDescription} обл.
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                        {deliveryInfo.cityRef && (
                                            <div style={{ position: 'relative' }}>
                                                <select
                                                    style={inputStyle}
                                                    value={deliveryInfo.warehouseRef}
                                                    onChange={e => setDeliveryInfo({ ...deliveryInfo, warehouse: e.target.options[e.target.selectedIndex].text, warehouseRef: e.target.value })}
                                                >
                                                    <option value="">Оберіть відділення...</option>
                                                    {warehouses.map(w => <option key={w.Ref} value={w.Ref}>{w.Description}</option>)}
                                                </select>
                                                {isSearchingWarehouses && <Loader2 size={18} style={{ position: 'absolute', right: '32px', top: '16px' }} className={styles.spin} />}
                                            </div>
                                        )}
                                    </div>
                                )}

                                {deliveryMethod === 'np-courier' && (
                                    <div style={{ display: 'grid', gap: '16px' }}>
                                        <input placeholder="Введіть повну адресу..." style={inputStyle} value={deliveryInfo.address} onChange={e => setDeliveryInfo({ ...deliveryInfo, address: e.target.value })} />
                                    </div>
                                )}

                            </div>
                        </div>

                        {/* Right Column: Order Summary */}
                        <aside style={{ position: 'sticky', top: '120px', height: 'fit-content' }}>
                            <div style={{ ...cardStyle, backgroundColor: 'var(--primary)', color: 'white' }}>
                                <h2 style={{ fontSize: '20px', fontWeight: 800, marginBottom: '32px' }}>Разом до сплати</h2>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '32px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', opacity: 0.8 }}>
                                        <span>Проміжна сума</span>
                                        <span>{total} ₴</span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', opacity: 0.8 }}>
                                        <span>Доставка</span>
                                        <span>За тарифами НП</span>
                                    </div>
                                    <div style={{ borderTop: '1px solid rgba(255,255,255,0.2)', paddingTop: '16px', display: 'flex', justifyContent: 'space-between', fontSize: '24px', fontWeight: 900 }}>
                                        <span>Всього</span>
                                        <span>{total} ₴</span>
                                    </div>
                                </div>

                                <button
                                    onClick={handleCheckout}
                                    disabled={loading}
                                    style={{ ...actionBtnStyle, backgroundColor: 'white', color: 'var(--primary)', width: '100%' }}
                                    className="hover-lift"
                                >
                                    {loading ? <Loader2 size={24} className={styles.spin} /> : <><CreditCard size={20} /> Оплатити замовлення</>}
                                </button>
                            </div>
                        </aside>

                    </div>
                )}
            </main>

            <Footer />
        </div>
    );
}

const cardStyle = { backgroundColor: 'white', padding: '40px', borderRadius: '32px', boxShadow: '0 4px 30px rgba(0,0,0,0.03)', border: '1px solid #f0f0f0' };
const inputStyle = { width: '100%', padding: '16px', borderRadius: '16px', border: '1.5px solid #eef2f6', outline: 'none', fontSize: '15px' };
const sectionLabelStyle = { fontSize: '13px', fontWeight: 800, textTransform: 'uppercase' as any, letterSpacing: '0.05em', color: '#888', marginBottom: '16px' };
const methodBtnStyle = {
    display: 'flex',
    flexDirection: 'column' as any,
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    padding: '16px',
    borderRadius: '16px',
    border: '2.5px solid',
    fontSize: '13px',
    fontWeight: 700,
    cursor: 'pointer',
    transition: 'all 0.2s'
};
const actionBtnStyle = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '12px',
    padding: '18px 36px',
    borderRadius: '20px',
    border: 'none',
    backgroundColor: 'var(--primary)',
    color: 'white',
    fontSize: '18px',
    fontWeight: 800,
    cursor: 'pointer',
    textDecoration: 'none'
};
const qtyBtnStyle = { width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', background: 'transparent', cursor: 'pointer', color: '#64748b' };
const dropdownStyle = { position: 'absolute' as any, top: 'calc(100% + 4px)', left: 0, right: 0, backgroundColor: 'white', borderRadius: '16px', boxShadow: '0 10px 40px rgba(0,0,0,0.1)', border: '1px solid #f0f0f0', zIndex: 100, maxHeight: '240px', overflowY: 'auto' as any };
const dropdownItemStyle = { padding: '12px 20px', fontSize: '14px', cursor: 'pointer', borderBottom: '1px solid #f8fafc' };
