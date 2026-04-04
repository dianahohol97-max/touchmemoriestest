'use client';
import { useT } from '@/lib/i18n/context';
import { motion } from 'framer-motion';
import styles from './ProductStrip.module.css';
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

export function ProductStrip({
  const t = useT(); products = [] }: { products: Product[] }) {
    const { ref, inView } = useInView({
        triggerOnce: true,
        threshold: 0.1,
    });

    if (!products || products.length === 0) return null;

    return (
        <section style={{ overflow: 'hidden' }} ref={ref}>
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
                            className={styles.group}
                        >
                            <div style={{
                                position: 'relative',
                                aspectRatio: '3/4',
                                overflow: 'hidden',
                                borderRadius: "3px",
                                marginBottom: '16px',
                                background: 'var(--card-bg, #f0f0f0)',
                                border: '1px solid rgba(0,0,0,0.05)'
                            }}>
                                <img
                                    src={product.images?.[0] || 'https://images.unsplash.com/photo-1544365511-739343940306?auto=format&fit=crop&q=80&w=800'}
                                    alt={product.name}
                                    style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 0.5s cubic-bezier(0.2, 0, 0, 1)' }}
                                    className={styles.productImg}
                                />
                                <div style={{
                                    position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.5) 0%, transparent 60%)',
                                    opacity: 0.6, transition: 'opacity 0.3s'
                                }} className={styles.overlayGradient}></div>

                                <div style={{
                                    position: 'absolute', bottom: '20px', left: '20px', right: '20px',
                                    transition: 'all 0.3s cubic-bezier(0.2, 0, 0, 1)',
                                    zIndex: 10
                                }} className={styles.itemAction}>
                                    <div style={{
                                        height: '40px',
                                        backgroundColor: '#263A99',
                                        color: '#ffffff',
                                        borderRadius: "3px",
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontSize: '13px',
                                        fontWeight: 600,
                                        boxShadow: 'var(--button-shadow)'
                                    }}>
                                        Детальніше
                                    </div>
                                </div>
                            </div>
                            <div style={{ padding: '0 4px' }}>
                                <h3 style={{
                                    fontFamily: 'var(--font-heading)',
                                    fontWeight: 800,
                                    fontSize: '16px',
                                    marginBottom: '4px',
                                    color: 'var(--section-heading-color)'
                                }}>
                                    {product.name}
                                </h3>
                            </div>
                        </Link>
                    ))}
                </div>
            </motion.div>
        </section>
    );
}
