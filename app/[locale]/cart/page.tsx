'use client';
import { useTranslation } from '@/lib/i18n/context';
import { useEffect } from 'react';
import styles from './cart.module.css';
import { useCartStore } from '@/store/cart-store';
import { Navigation } from '@/components/ui/Navigation';
import { Footer } from '@/components/ui/Footer';
import Image from 'next/image';
import { Trash2, Plus, Minus, ChevronRight } from 'lucide-react';
import { logCartEvent } from '@/lib/analytics';
import { useRouter } from 'next/navigation';


export default function CartPage() {
    const { t, locale } = useTranslation();
    const { items, removeItem, updateQuantity, getTotal } = useCartStore();
    const router = useRouter();

    // Track checkout initiation
    useEffect(() => {
        if (items.length > 0) {
            logCartEvent('begin_checkout');
        }
    }, [items.length]);

    const goToCheckout = () => {
        if (items.length === 0) return;
        router.push(`/${locale}/checkout`);
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
                        <p style={{ fontSize: '20px', color: '#888', marginBottom: '32px' }}>{t('cart.empty')}</p>
                        <div style={{ display: 'flex', justifyContent: 'center' }}>
                            <a href="/catalog" style={{ ...actionBtnStyle, borderRadius: '6px', width: 'fit-content' }} className="hover-lift">До каталогу</a>
                        </div>
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
                                            <div style={{ width: '80px', height: '80px', borderRadius: "3px", overflow: 'hidden', position: 'relative' }}>
                                                <Image src={item.image || ''} alt={item.name} fill style={{ objectFit: 'cover' }} />
                                            </div>
                                            <div style={{ flex: 1 }}>
                                                <div style={{ fontWeight: 800, fontSize: '16px', marginBottom: '4px' }}>{item.name}</div>
                                                <div style={{ fontSize: '13px', color: '#888' }}>
                                                    {/* Show options as key:value pairs, fallback to personalization_note */}
                                                    {item.options && Object.keys(item.options).length > 0
                                                      ? Object.entries(item.options)
                                                          .filter(([,v]) => v && String(v).trim())
                                                          .map(([k,v]) => `${k}: ${v}`)
                                                          .join(' · ')
                                                      : (item as any).personalization_note || ''
                                                    }
                                                    {(item as any).personalization_note && Object.keys(item.options||{}).length > 0 && (
                                                      <div style={{ marginTop:2, fontSize:11, color:'#aaa' }}>{(item as any).personalization_note}</div>
                                                    )}
                                                </div>
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', background: '#f8fafc', padding: '6px', borderRadius: "3px" }}>
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

                        </div>

                        {/* Right Column: Order Summary */}
                        <aside style={{ position: 'sticky', top: '120px', height: 'fit-content' }}>
                            <div style={{ ...cardStyle, backgroundColor: 'var(--primary)', color: 'white' }}>
                                <h2 style={{ fontSize: '20px', fontWeight: 800, marginBottom: '32px' }}>{t('cart.total')}</h2>
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
                                    onClick={goToCheckout}
                                    style={{ ...actionBtnStyle, backgroundColor: 'white', color: 'var(--primary)', width: '100%' }}
                                    className="hover-lift"
                                >
                                    <ChevronRight size={20} /> {t('cart.checkout') || 'Оформити замовлення'}
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

const cardStyle = { backgroundColor: 'white', padding: '40px', borderRadius: "3px", boxShadow: '0 4px 30px rgba(0,0,0,0.03)', border: '1px solid #f0f0f0' };
const actionBtnStyle = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '12px',
    padding: '18px 36px',
    borderRadius: "6px",
    border: 'none',
    backgroundColor: '#263a99',
    color: 'white',
    fontSize: '18px',
    fontWeight: 700,
    cursor: 'pointer',
    textDecoration: 'none'
};
const qtyBtnStyle = { width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', background: 'transparent', cursor: 'pointer', color: '#64748b' };
