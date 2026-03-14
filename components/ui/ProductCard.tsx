'use client';
import { motion } from 'framer-motion';
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
    };
}

export function ProductCard({ product }: ProductCardProps) {
    const categorySlug = typeof product.categories === 'object' ? product.categories?.slug || 'all' : 'all';

    return (
        <motion.div
            whileHover={{ y: -8 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            className="product-card-root"
        >
            <Link href={`/catalog/${product.slug}`} style={{ textDecoration: 'none', color: 'inherit', display: 'flex', flexDirection: 'column', height: '100%' }}>
                <div style={{ position: 'relative', width: '100%', aspectRatio: '1/1', overflow: 'hidden', backgroundColor: '#f9f9f9' }}>
                    <Image
                        src={product.images?.[0] || 'https://via.placeholder.com/400'}
                        alt={product.name}
                        fill
                        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                        style={{ objectFit: 'cover', transition: 'transform 0.5s ease' }}
                        className="product-image"
                    />
                    <div style={{ position: 'absolute', top: '16px', right: '16px', zIndex: 10 }}>
                        <WishlistButton productId={product.id} />
                    </div>
                </div>

                <div className="product-info">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px', gap: '8px', flexWrap: 'wrap' }}>
                        <h3 className="product-title">{product.name}</h3>
                        <div className="product-price">
                            {product.price_from ? 'від ' : ''}{product.price} ₴
                        </div>
                    </div>

                    <p className="short-desc" style={{ fontSize: '14px', color: '#666', marginBottom: '24px', lineClamp: 2, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                        {product.short_description || 'Преміальна якість друку та матеріалів.'}
                    </p>

                    <div className="card-footer" style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span className="cat-tag" style={{ fontSize: '12px', color: '#888', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            {typeof product.categories === 'object' ? product.categories?.name : 'Товар'}
                        </span>
                        <span className="more-link" style={{ fontSize: '14px', fontWeight: 700, color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            Детальніше <span style={{ fontSize: '18px' }}>→</span>
                        </span>
                    </div>
                </div>
            </Link>

            <style jsx>{`
                .product-image:hover {
                    transform: scale(1.05);
                }
                .product-card-root {
                    background-color: white;
                    border-radius: 24px;
                    overflow: hidden;
                    box-shadow: 0 4px 20px rgba(0,0,0,0.03);
                    border: 1px solid #f0f0f0;
                    height: 100%;
                    display: flex;
                    flex-direction: column;
                }
                .product-info {
                    padding: 24px;
                    display: flex;
                    flex-direction: column;
                    flex: 1;
                }
                .product-title {
                    font-size: 18px;
                    font-weight: 800;
                    margin: 0;
                    line-height: 1.2;
                }
                .product-price {
                    font-weight: 900;
                    font-size: 16px;
                    color: var(--primary);
                    white-space: nowrap;
                }
                @media (max-width: 768px) {
                    .product-card-root {
                        border-radius: 16px;
                    }
                    .product-info {
                        padding: 12px;
                    }
                    .product-title {
                        font-size: 14px;
                    }
                    .product-price {
                        font-size: 14px;
                    }
                    .short-desc {
                        margin-bottom: 12px !important;
                        font-size: 12px !important;
                    }
                    .card-footer {
                        gap: 2px;
                    }
                    .cat-tag {
                        display: none !important;
                    }
                    .more-link {
                        font-size: 12px !important;
                    }
                }
            `}</style>
        </motion.div>
    );
}
