'use client';
import { motion } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import Link from 'next/link';

interface Product {
    id: string;
    name: string;
    price: string | number;
    price_from?: boolean;
    images: string[];
    slug: string;
}

export function ProductStrip({ products = [] }: { products: Product[] }) {
    const { ref, inView } = useInView({
        triggerOnce: true,
        threshold: 0.1,
    });

    if (!products || products.length === 0) return null;

    return (
        <section style={{ padding: '80px 0', overflow: 'hidden' }} ref={ref}>
            <motion.div
                initial={{ opacity: 0, y: 40 }}
                animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 40 }}
                transition={{ duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }}
                className="no-scrollbar"
                style={{ width: '100%', overflowX: 'auto', WebkitOverflowScrolling: 'touch', scrollSnapType: 'x mandatory' }}
            >
                <div style={{ display: 'flex', gap: '24px', padding: '0 20px', width: 'max-content' }}>
                    {products.map((product) => (
                        <Link
                            key={product.id}
                            href={`/catalog/${product.slug}`}
                            style={{ width: '280px', flexShrink: 0, scrollSnapAlign: 'center', cursor: 'pointer', textDecoration: 'none', color: 'inherit' }}
                            className="group"
                        >
                            <div style={{
                                position: 'relative',
                                aspectRatio: 'var(--card-aspect-product, 1/1)',
                                overflow: 'hidden',
                                borderRadius: 'var(--card-radius, 12px)',
                                marginBottom: '16px',
                                background: 'var(--card-bg, #f0f0f0)'
                            }}>
                                <img
                                    src={product.images?.[0] || 'https://images.unsplash.com/photo-1544365511-739343940306?auto=format&fit=crop&q=80&w=800'}
                                    alt={product.name}
                                    style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 0.3s' }}
                                    className="product-img"
                                />
                                <div style={{
                                    position: 'absolute', inset: 0, background: 'rgba(38, 58, 153, 0.2)',
                                    opacity: 0, transition: 'opacity 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center'
                                }} className="overlay">
                                    <span style={{ color: 'white', fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: '14px' }}>
                                        Переглянути →
                                    </span>
                                </div>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', color: 'var(--card-text, inherit)' }}>
                                <h3 style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: '14px', margin: 0 }}>
                                    {product.name}
                                </h3>
                                <span style={{ fontSize: '14px', opacity: 0.7 }}>
                                    {product.price_from ? 'від ' : ''}{product.price} ₴
                                </span>
                            </div>
                        </Link>
                    ))}
                </div>
            </motion.div>
            <style jsx>{`
        .product-img:hover { transform: scale(1.05); }
        .group:hover .overlay { opacity: 1 !important; }
      `}</style>
        </section>
    );
}
