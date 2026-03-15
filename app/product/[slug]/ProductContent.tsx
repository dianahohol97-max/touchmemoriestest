'use client';
import { useCart } from '@/context/CartContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import styles from './ProductContent.module.css';
import { trackViewItem, trackAddToCart } from '@/components/providers/AnalyticsProvider';

export default function ProductContent({ product }: { product: any }) {
    const { addItem } = useCart();
    const router = useRouter();
    const [withDesigner, setWithDesigner] = useState(false);

    useEffect(() => {
        if (product) {
            trackViewItem(product);
        }
    }, [product]);

    const handleAddToCart = () => {
        const designerFee = withDesigner ? (product.designer_service_price || 500) : 0;
        addItem({
            id: product.id,
            name: product.name,
            price: product.price + designerFee,
            qty: 1,
            image: product.images?.[0],
            options: {
                with_designer: withDesigner,
                designer_fee: designerFee
            }
        });
        trackAddToCart(product, 1);
        router.push('/cart');
    };

    return (
        <div>
            <header className="shop-header">
                <div className="container shop-nav">
                    <a href="/" style={{ fontSize: '1.5rem', fontWeight: 900, textDecoration: 'none', color: 'var(--primary)' }}>TOUCH MEMORIES</a>
                    <nav style={{ display: 'flex', gap: '30px' }}>
                        <a href="/catalog">Каталог</a>
                        <a href="/cart">Кошик</a>
                    </nav>
                </div>
            </header>

            <main className="container" style={{ padding: '60px 0' }}>
                <div className={styles.productGrid} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '60px' }}>
                    <div>
                        <img src={product.images?.[0] || 'https://via.placeholder.com/600x600'} alt={product.name} style={{ width: '100%', borderRadius: "3px", boxShadow: 'var(--shadow)' }} />
                    </div>
                    <div>
                        <div className="product-category">{product.categories?.name}</div>
                        <h1 className={styles.title} style={{ fontSize: '3rem', marginBottom: '20px' }}>{product.name}</h1>
                        <div style={{ fontSize: '2rem', fontWeight: 700, marginBottom: '20px', color: 'var(--primary)' }}>
                            від {product.price} UAH
                        </div>
                        <p style={{ fontSize: '1.1rem', color: 'var(--text-muted)', marginBottom: '30px' }}>
                            {product.description}
                        </p>

                        <div style={{ background: '#f9f9f9', padding: '30px', borderRadius: "3px", marginBottom: '30px' }}>
                            <h4 style={{ marginBottom: '15px' }}>Оберіть параметри:</h4>
                            <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
                                {['15x15', '20x20', '30x30'].map(f => (
                                    <button key={f} style={{ padding: '10px 20px', border: '1px solid var(--border)', borderRadius: "3px", background: f === '20x20' ? 'var(--primary)' : 'white', color: f === '20x20' ? 'white' : 'black' }}>{f}</button>
                                ))}
                            </div>
                            <p style={{ fontSize: '0.9rem' }}>Мінімум сторінок: {product.min_pages}</p>
                        </div>

                        {product.has_designer_option && (
                            <div style={{
                                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                padding: '25px',
                                borderRadius: "3px",
                                marginBottom: '20px',
                                color: 'white'
                            }}>
                                <label style={{ display: 'flex', alignItems: 'flex-start', cursor: 'pointer', gap: '15px' }}>
                                    <input
                                        type="checkbox"
                                        checked={withDesigner}
                                        onChange={(e) => setWithDesigner(e.target.checked)}
                                        style={{
                                            width: '24px',
                                            height: '24px',
                                            cursor: 'pointer',
                                            marginTop: '2px',
                                            accentColor: 'white'
                                        }}
                                    />
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontSize: '1.2rem', fontWeight: 'bold', marginBottom: '8px' }}>
                                            ✨ Послуга дизайнера "Зроби за мене"
                                        </div>
                                        <div style={{ fontSize: '0.95rem', opacity: 0.95, marginBottom: '12px' }}>
                                            Завантажте фото, заповніть короткий бриф — і наш AI + професійний дизайнер створять для вас ідеальний макет фотокниги. Ви отримаєте готовий дизайн на перегляд з можливістю 2 безкоштовних правок.
                                        </div>
                                        <div style={{ fontSize: '1.1rem', fontWeight: 'bold' }}>
                                            + {product.designer_service_price || 500} грн
                                        </div>
                                    </div>
                                </label>
                            </div>
                        )}

                        <button className="btn-shop" style={{ width: '100%', padding: '20px', fontSize: '1.2rem' }} onClick={handleAddToCart}>
                            {withDesigner
                                ? `Додати з послугою дизайнера (${product.price + (product.designer_service_price || 500)} грн)`
                                : `Додати у кошик (${product.price} грн)`
                            }
                        </button>
                    </div>
                </div>
            </main>

            <footer>
                <div className="container" style={{ textAlign: 'center' }}>
                    <p>&copy; 2026 TOUCH MEMORIES. Всі права захищені.</p>
                </div>
            </footer>
        </div>
    );
}
