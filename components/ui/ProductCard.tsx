'use client';
import { motion } from 'framer-motion';
import styles from './ProductCard.module.css';
import Link from 'next/link';
import Image from 'next/image';
import WishlistButton from '@/components/WishlistButton';

interface ProductCardProps {
    product: {
        id: string;
        name: string;
        price: number | string;
        price_from?: boolean;
        images: string[];
        slug: string;
        categories?: { name: string; slug: string } | any;
        short_description?: string;
        is_personalized?: boolean;
        is_partially_personalized?: boolean;
    };
}

export function ProductCard({ product }: ProductCardProps) {
    const categorySlug = typeof product.categories === 'object' ? product.categories?.slug || 'all' : 'all';

    return (
        <motion.div
            whileHover={{ y: -8 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            className={styles.productCardRoot}
        >
            <Link href={`/catalog/${product.slug}`} style={{ textDecoration: 'none', color: 'inherit', display: 'flex', flexDirection: 'column', height: '100%' }}>
                <div style={{ position: 'relative', width: '100%', aspectRatio: '1/1', overflow: 'hidden', backgroundColor: '#f9f9f9' }}>
                    <Image
                        src={product.images?.[0] || 'https://via.placeholder.com/400'}
                        alt={product.name}
                        fill
                        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                        style={{ objectFit: 'cover', transition: 'transform 0.5s ease' }}
                        className={styles.productImage}
                    />
                    <div style={{ position: 'absolute', top: '16px', right: '16px', zIndex: 10 }}>
                        <WishlistButton productId={product.id} />
                    </div>
                </div>

                <div className={styles.productInfo}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px', gap: '8px', flexWrap: 'wrap' }}>
                        <h3 className={styles.productTitle}>{product.name}</h3>
                        <div className={styles.productPrice}>
                            {product.price_from ? 'від ' : ''}{product.price} ₴
                        </div>
                    </div>

                    <p className={styles.shortDesc} style={{ fontSize: '14px', color: '#666', marginBottom: '24px', lineClamp: 2, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                        {product.short_description || 'Преміальна якість друку та матеріалів.'}
                    </p>

                    <div className={styles.cardFooter} style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span className={styles.catTag} style={{ fontSize: '12px', color: '#888', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            {typeof product.categories === 'object' ? product.categories?.name : 'Товар'}
                        </span>
                        <span className={styles.moreLink} style={{ fontSize: '14px', fontWeight: 700, color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            {product.is_personalized
                                ? 'Створити'
                                : product.is_partially_personalized
                                    ? 'Замовити / Персоналізувати'
                                    : 'Замовити'}
                            <span style={{ fontSize: '18px' }}>→</span>
                        </span>
                    </div>
                </div>
            </Link>

        </motion.div>
    );
}
