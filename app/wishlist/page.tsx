'use client';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Heart, ShoppingBag, Trash2, ArrowRight, ShoppingCart, Sparkles, Bell } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { useWishlistStore } from '@/store/wishlist-store';
import { useCartStore } from '@/store/cart-store';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';

export default function WishlistPage() {
    const { items, toggleItem, initialize } = useWishlistStore();
    const addItem = useCartStore(state => state.addItem);
    const [products, setProducts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [isClient, setIsClient] = useState(false);

    const supabase = createClient();

    useEffect(() => {
        setIsClient(true);
        initialize();
    }, []);

    useEffect(() => {
        if (isClient && items.length > 0) {
            fetchProductDetails();
        } else if (isClient) {
            setProducts([]);
            setLoading(false);
        }
    }, [items, isClient]);

    const fetchProductDetails = async () => {
        setLoading(true);
        const productIds = items.map(i => i.product_id);

        const { data, error } = await supabase
            .from('products')
            .select('*, categories(slug, name)')
            .in('id', productIds);

        if (data) {
            setProducts(data);
        }
        setLoading(false);
    };

    const handleAddToCart = (product: any) => {
        addItem({
            id: `${product.id}-wishlist`,
            product_id: product.id,
            name: product.name,
            price: Number(product.price),
            qty: 1,
            image: product.images[0],
            category_slug: product.categories?.slug,
            slug: product.slug
        });
        toast.success('Товар додано в кошик!');
    };

    if (!isClient) return null;

    return (
        <main style={mainStyle}>
            <div style={containerStyle}>
                <header style={{ marginBottom: '64px', textAlign: 'center' }}>
                    <div style={badgeStyle}>ВАШ ВИБІР</div>
                    <h1 style={titleStyle}>Список бажань ❤️</h1>
                    <p style={subtitleStyle}>Збережені товари, які вам сподобались. Поверніться до них, коли будете готові!</p>
                </header>

                {loading ? (
                    <div style={{ textAlign: 'center', padding: '100px' }}>Завантаження...</div>
                ) : products.length > 0 ? (
                    <div style={wishlistGrid}>
                        <AnimatePresence>
                            {products.map((product) => (
                                <motion.div
                                    key={product.id}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 0.95 }}
                                    style={wishlistCard}
                                >
                                    <Link href={`/catalog/${product.categories?.slug}/${product.slug}`} style={imageContainer}>
                                        <Image
                                            src={product.images[0]}
                                            alt={product.name}
                                            fill
                                            style={{ objectFit: 'cover' }}
                                        />
                                        {product.stock <= 0 && (
                                            <div style={outOfStockOverlay}>НЕМАЄ В НАЯВНОСТІ</div>
                                        )}
                                    </Link>

                                    <div style={contentArea}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                                            <h3 style={productName}>{product.name}</h3>
                                            <div style={priceStyle}>{product.price} ₴</div>
                                        </div>

                                        <p style={shortDesc}>{product.short_description || 'Преміальна якість матеріалів.'}</p>

                                        <div style={actionsRow}>
                                            {product.stock > 0 ? (
                                                <button onClick={() => handleAddToCart(product)} style={addToCartBtn}>
                                                    <ShoppingCart size={18} /> У кошик
                                                </button>
                                            ) : (
                                                <button style={notifyBtn}>
                                                    <Bell size={18} /> Повідомити
                                                </button>
                                            )}
                                            <button
                                                onClick={() => toggleItem(product.id)}
                                                style={removeBtn}
                                                title="Видалити"
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        </div>
                                    </div>
                                </motion.div>
                            ))}
                        </AnimatePresence>
                    </div>
                ) : (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        style={emptyState}
                    >
                        <div style={emptyIconWrapper}>
                            <Heart size={48} color="#e2e8f0" />
                        </div>
                        <h2 style={{ fontSize: '24px', fontWeight: 900, marginBottom: '16px' }}>Ваш список порожній</h2>
                        <p style={{ color: '#64748b', marginBottom: '32px' }}>Схоже, ви ще нічого не додали до спиsku бажань.</p>
                        <Link href="/catalog" style={browseBtn}>
                            Переглянути каталог <ArrowRight size={20} />
                        </Link>
                    </motion.div>
                )}

                {/* Viral Hook */}
                <div style={viralBanner}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        <div style={sparkleBox}><Sparkles size={24} color="#ef4444" /></div>
                        <div>
                            <div style={{ fontWeight: 900, fontSize: '18px' }}>Бажаєте отримати ці товари у подарунок?</div>
                            <p style={{ color: '#64748b', fontSize: '14px', marginTop: '4px' }}>Натякніть близьким прямо зі сторінки товару!</p>
                        </div>
                    </div>
                </div>
            </div>
        </main>
    );
}

const mainStyle = { minHeight: '100vh', backgroundColor: '#fafafa', paddingTop: '100px', paddingBottom: '100px' };
const containerStyle = { maxWidth: '1200px', margin: '0 auto', padding: '0 24px' };
const badgeStyle = { display: 'inline-block', backgroundColor: '#fff1f2', color: '#ef4444', padding: '6px 16px', borderRadius: '3px', fontSize: '12px', fontWeight: 900, marginBottom: '24px', letterSpacing: '0.05em' };
const titleStyle = { fontSize: '48px', fontWeight: 900, color: '#263A99', marginBottom: '20px', letterSpacing: '-0.02em' };
const subtitleStyle = { color: '#64748b', fontSize: '18px', maxWidth: '600px', margin: '0 auto', lineHeight: 1.6 };

const wishlistGrid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '32px' };
const wishlistCard = { backgroundColor: 'white', borderRadius: '3px', overflow: 'hidden', display: 'flex', flexDirection: 'column' as any, border: '1px solid #f1f5f9', boxShadow: '0 10px 30px rgba(0,0,0,0.03)' };
const imageContainer = { position: 'relative' as any, width: '100%', aspectRatio: '16/10', overflow: 'hidden' };
const contentArea = { padding: '24px', flex: 1, display: 'flex', flexDirection: 'column' as any };
const productName = { fontSize: '18px', fontWeight: 800, color: '#263A99' };
const priceStyle = { fontWeight: 900, fontSize: '18px', color: 'var(--primary)' };
const shortDesc = { fontSize: '14px', color: '#64748b', marginBottom: '24px', flex: 1 };
const actionsRow = { display: 'flex', gap: '12px' };

const addToCartBtn = { flex: 1, backgroundColor: '#263A99', color: 'white', border: 'none', borderRadius: '3px', fontWeight: 800, padding: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', cursor: 'pointer' };
const notifyBtn = { flex: 1, backgroundColor: '#f1f5f9', color: '#64748b', border: 'none', borderRadius: '3px', fontWeight: 800, padding: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', cursor: 'pointer' };
const removeBtn = { width: '48px', height: '48px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '3px', border: '2px solid #f1f5f9', color: '#94a3b8', cursor: 'pointer', transition: 'all 0.2s' };
const outOfStockOverlay = { position: 'absolute' as any, top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(255,255,255,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 900, color: '#263A99', letterSpacing: '0.1em' };

const emptyState = { textAlign: 'center' as any, padding: '100px 24px', backgroundColor: 'white', borderRadius: '3px', border: '2px dashed #e2e8f0' };
const emptyIconWrapper = { width: '100px', height: '100px', borderRadius: '3px', backgroundColor: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 32px' };
const browseBtn = { display: 'inline-flex', alignItems: 'center', gap: '12px', padding: '18px 36px', borderRadius: '3px', backgroundColor: '#ef4444', color: 'white', fontWeight: 900, fontSize: '18px', textDecoration: 'none', boxShadow: '0 10px 30px rgba(239, 68, 68, 0.3)' };

const viralBanner = { marginTop: '80px', padding: '40px', backgroundColor: '#fffafb', borderRadius: '3px', border: '1px solid #ffeff2' };
const sparkleBox = { width: '56px', height: '56px', borderRadius: '3px', backgroundColor: '#fff1f2', display: 'flex', alignItems: 'center', justifyContent: 'center' };
