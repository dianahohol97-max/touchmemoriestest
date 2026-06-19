'use client';
import { useTranslation } from '@/lib/i18n/context';
import { useEffect, useState, useRef } from 'react';
import styles from './cart.module.css';
import { useCartStore } from '@/store/cart-store';
import { Navigation } from '@/components/ui/Navigation';
import { Footer } from '@/components/ui/Footer';
import Image from 'next/image';
import { Trash2, Plus, Minus, ChevronRight, ImageIcon, Pencil } from 'lucide-react';
import { logCartEvent } from '@/lib/analytics';
import { createClient } from '@/lib/supabase/client';
import { duplicateDiscountForCart } from '@/lib/payment/duplicate-discount';
import { listCartEditSnapshotIds, getCartEditSnapshot, deleteCartEditSnapshot } from '@/lib/cart-edit-store';
import { useRouter } from 'next/navigation';


export default function CartPage() {
    const { t, locale } = useTranslation();
    const { items, removeItem, updateQuantity } = useCartStore();
    const router = useRouter();

    // Which cart items have a re-openable design snapshot (saved by the editor
    // when the item was added). Only those show an "Редагувати" button — the
    // snapshot lives in sessionStorage, so editing is available within the
    // current browsing session.
    const [editableIds, setEditableIds] = useState<Set<string>>(new Set());
    useEffect(() => {
        if (typeof window === 'undefined') return;
        let cancelled = false;
        (async () => {
            const ids = new Set<string>();
            const cartIds = new Set(items.map((i) => i.id));
            // Durable snapshots (survive sessions / large books).
            try {
                for (const id of await listCartEditSnapshotIds()) {
                    if (cartIds.has(id)) ids.add(id);
                }
            } catch { /* ignore */ }
            // Same-session fast-path snapshots (items added before this deploy).
            for (const it of items) {
                try { if (sessionStorage.getItem('tmCartEdit_' + it.id)) ids.add(it.id); } catch { /* ignore */ }
            }
            if (!cancelled) setEditableIds(ids);
        })();
        return () => { cancelled = true; };
    }, [items]);

    // Which items the customer wants to order RIGHT NOW. Defaults to all. The
    // customer can uncheck items to leave them in the cart for a separate order
    // (e.g. a different delivery address or a later date). Checkout reads this
    // selection and processes only the chosen items; the rest stay in the cart.
    const prevItemIdsRef = useRef<Set<string>>(new Set());
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    useEffect(() => {
        setSelectedIds((prev) => {
            const next = new Set<string>();
            for (const it of items) {
                // keep previous choice; brand-new items default to selected
                if (prev.size === 0 || prev.has(it.id) || !prevItemIdsRef.current.has(it.id)) next.add(it.id);
            }
            prevItemIdsRef.current = new Set(items.map((i) => i.id));
            return next;
        });
    }, [items]);

    const toggleSelected = (id: string) => {
        setSelectedIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    };
    const allSelected = items.length > 0 && items.every((i) => selectedIds.has(i.id));
    const toggleSelectAll = () => {
        setSelectedIds(allSelected ? new Set() : new Set(items.map((i) => i.id)));
    };

    const editCartItem = async (item: { id: string }) => {
        try {
            let snap = await getCartEditSnapshot(item.id);
            if (!snap) {
                const raw = sessionStorage.getItem('tmCartEdit_' + item.id);
                if (!raw) return;
                snap = JSON.parse(raw);
            }
            sessionStorage.setItem('bookConstructorConfig', JSON.stringify(snap.config));
            sessionStorage.setItem('bookConstructorPhotos', snap.photos || '[]');
            const slug = (snap.config?.productSlug || '').toLowerCase().trim();
            sessionStorage.setItem(slug ? `bookEditorDraft_${slug}` : 'bookEditorDraft', JSON.stringify(snap.draft || {}));
            sessionStorage.setItem('bookEditCartItemId', item.id);
            router.push(`/${locale}/editor/book/layout`);
        } catch { /* ignore */ }
    };

    const removeCartItem = (id: string) => {
        removeItem(id);
        try { sessionStorage.removeItem('tmCartEdit_' + id); } catch { /* ignore */ }
        void deleteCartEditSnapshot(id);
    };

    // Track checkout initiation
    useEffect(() => {
        if (items.length > 0) {
            logCartEvent('begin_checkout');
        }
    }, [items.length]);

    const goToCheckout = () => {
        const ids = items.filter((i) => selectedIds.has(i.id)).map((i) => i.id);
        if (ids.length === 0) return;
        try { sessionStorage.setItem('tmCheckoutItemIds', JSON.stringify(ids)); } catch { /* ignore */ }
        router.push(`/${locale}/checkout`);
    };

    // Summary reflects only the SELECTED items (what will be ordered now).
    const selItems = items.filter((i) => selectedIds.has(i.id));
    const total = selItems.reduce((s, i) => s + i.price * i.qty, 0);
    const dupDiscount = duplicateDiscountForCart(selItems as any);
    const netTotal = Math.max(0, total - dupDiscount);
    const selectedCount = selItems.length;

    // Some items (built in the constructor) are added without an image. Fall back
    // to the product's catalog image so the cart always shows an illustration.
    const [catalogImages, setCatalogImages] = useState<Record<string, string>>({});
    useEffect(() => {
        const missing = Array.from(new Set(
            items.filter((i) => !i.image && i.product_id).map((i) => i.product_id as string)
        ));
        if (missing.length === 0) return;
        const supabase = createClient();
        (async () => {
            const { data } = await supabase
                .from('products')
                .select('id, images, og_image')
                .in('id', missing);
            if (!data) return;
            const map: Record<string, string> = {};
            for (const p of data as any[]) {
                const img = p.og_image || (Array.isArray(p.images) && p.images[0]) || '';
                if (img) map[p.id] = img;
            }
            if (Object.keys(map).length) setCatalogImages((prev) => ({ ...prev, ...map }));
        })();
    }, [items]);

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
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', gap: 12, flexWrap: 'wrap' }}>
                                    <h2 style={{ fontSize: '20px', fontWeight: 800, margin: 0 }}>Товари ({items.length})</h2>
                                    {items.length > 1 && (
                                        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#64748b', cursor: 'pointer', userSelect: 'none' }}>
                                            <input type="checkbox" checked={allSelected} onChange={toggleSelectAll}
                                                style={{ width: 18, height: 18, accentColor: '#263a99', cursor: 'pointer' }} />
                                            Обрати всі
                                        </label>
                                    )}
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                                    {items.map((item) => (
                                        <div key={item.id} style={{ display: 'flex', gap: '20px', alignItems: 'center', paddingBottom: '24px', borderBottom: '1px solid #f0f0f0', opacity: selectedIds.has(item.id) ? 1 : 0.5, transition: 'opacity 0.15s' }}>
                                            <input type="checkbox" aria-label="Обрати товар для замовлення"
                                                checked={selectedIds.has(item.id)} onChange={() => toggleSelected(item.id)}
                                                style={{ width: 20, height: 20, accentColor: '#263a99', cursor: 'pointer', flexShrink: 0 }} />
                                            <div style={{ width: '80px', height: '80px', borderRadius: "3px", overflow: 'hidden', position: 'relative', background: '#f1f5f9' }}>
                                                {(() => {
                                                    const imgSrc = item.image || (item.product_id ? catalogImages[item.product_id] : '') || '';
                                                    return imgSrc
                                                        ? <Image src={imgSrc} alt={item.name} fill style={{ objectFit: 'cover' }}
                                                            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                                                        : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}><ImageIcon size={24} /></div>;
                                                })()}
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
                                                {editableIds.has(item.id) && (
                                                    <button onClick={() => editCartItem(item)}
                                                        style={{ marginTop: 8, display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', border: '1.5px solid #1e2d7d', background: '#fff', color: '#1e2d7d', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                                                        <Pencil size={13} /> Редагувати
                                                    </button>
                                                )}
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', background: '#f8fafc', padding: '6px', borderRadius: "3px" }}>
                                                <button onClick={() => updateQuantity(item.id, item.qty - 1)} style={qtyBtnStyle}><Minus size={14} /></button>
                                                <span style={{ fontWeight: 700, minWidth: '20px', textAlign: 'center' }}>{item.qty}</span>
                                                <button onClick={() => updateQuantity(item.id, item.qty + 1)} style={qtyBtnStyle}><Plus size={14} /></button>
                                            </div>
                                            <div style={{ fontWeight: 800, fontSize: '16px', minWidth: '80px', textAlign: 'right' }}>
                                                {item.price * item.qty} ₴
                                            </div>
                                            <button onClick={() => removeCartItem(item.id)} style={{ padding: '8px', border: 'none', background: 'transparent', cursor: 'pointer', color: '#ff4d4d' }}>
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
                                    {dupDiscount > 0 && (
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
                                            <span>🎁 Знижка за копії</span>
                                            <span>-{dupDiscount} ₴</span>
                                        </div>
                                    )}
                                    <div style={{ display: 'flex', justifyContent: 'space-between', opacity: 0.8 }}>
                                        <span>Доставка</span>
                                        <span>За тарифами НП</span>
                                    </div>
                                    <div style={{ borderTop: '1px solid rgba(255,255,255,0.2)', paddingTop: '16px', display: 'flex', justifyContent: 'space-between', fontSize: '24px', fontWeight: 900 }}>
                                        <span>Всього</span>
                                        <span>{netTotal} ₴</span>
                                    </div>
                                </div>

                                <button
                                    onClick={goToCheckout}
                                    disabled={selectedCount === 0}
                                    style={{ ...actionBtnStyle, backgroundColor: 'white', color: 'var(--primary)', width: '100%', opacity: selectedCount === 0 ? 0.5 : 1, cursor: selectedCount === 0 ? 'not-allowed' : 'pointer' }}
                                    className="hover-lift"
                                >
                                    <ChevronRight size={20} /> {(t('cart.checkout') || 'Оформити замовлення')}{items.length > 1 ? ` (${selectedCount})` : ''}
                                </button>
                                {items.length > 1 && selectedCount > 0 && selectedCount < items.length && (
                                    <p style={{ margin: '12px 0 0', fontSize: 12, opacity: 0.8, textAlign: 'center' }}>
                                        Замовиш {selectedCount} з {items.length}. Решта лишиться в кошику для окремого замовлення.
                                    </p>
                                )}
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
