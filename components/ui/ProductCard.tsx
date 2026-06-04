'use client';
import { useT, useLocale } from '@/lib/i18n/context';
import { detectCurrency } from '@/lib/i18n/currency';
import { formatDisplayPrice } from '@/lib/payment/pricing-region';
import { getLocalized } from '@/lib/i18n/localize';
import { useMemo } from 'react';
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
    const t = useT();
    const locale = useLocale();
    const currency = useMemo(() => detectCurrency(locale), [locale]);
    const categorySlug = typeof product.categories === 'object' ? product.categories?.slug || 'all' : 'all';
    const rawPrice = typeof product.price === 'string' ? parseFloat(product.price) : product.price;
    const priceDisplay = rawPrice ? formatDisplayPrice(rawPrice, locale, currency) : null;

    return (
        <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0 }}
            whileHover={{ y: -6 }}
            transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
            className="group flex flex-col h-full bg-white rounded-[3px] shadow-[var(--card-shadow)] hover:shadow-[var(--card-shadow-hover)] transition-all duration-500 overflow-hidden border border-gray-100"
        >
            <Link href={`/catalog/${product.slug}`} className="no-underline text-inherit flex flex-col h-full">
                <div className="relative w-full aspect-[2/3] overflow-hidden bg-gray-50 border-b border-gray-100">
                    {product.images?.[0] ? (
                        <Image
                            src={product.images[0]}
                            alt={getLocalized(product, locale, "name")}
                            fill
                            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                            className="object-cover object-center transition-transform duration-700 ease-[0.23,1,0.32,1] group-hover:scale-110"
                        />
                    ) : (
                        // No image in the DB for this product yet. The old code
                        // fell back to https://via.placeholder.com/400, but that
                        // external service is flaky (502 Bad Gateway) and Next.js
                        // tries to proxy/optimise it through /_next/image, which
                        // then also fails. Render a local on-brand gradient with
                        // the product name instead — zero network requests, no
                        // broken-image icon. When a real photo is added to
                        // product.images it takes over automatically.
                        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-[#1e2d7d] via-[#3a4db0] to-[#6b7cc9] p-6">
                            <span className="text-white text-center font-semibold text-lg leading-snug">
                                {getLocalized(product, locale, "name")}
                            </span>
                        </div>
                    )}
                    <div className="absolute top-3 right-3 z-10">
                        {/* Always visible (no opacity-0 / group-hover gate).
                            The previous hover-only reveal meant mobile users
                            could never see or tap the wishlist button — they
                            have no hover state — so the feature looked
                            broken from a phone. On desktop the button
                            stayed invisible until the cursor entered the
                            card, which made it easy to miss entirely.
                            Keeping it always visible matches what every
                            e-commerce site does for save-for-later. */}
                        <WishlistButton productId={product.id} />
                    </div>
                </div>

                <div className="p-3 sm:p-6 flex flex-col flex-1 text-center justify-between">
                    <div>
                        <h3 className="font-heading text-[14px] sm:text-[20px] font-bold m-0 text-primary leading-tight tracking-tight mb-1 sm:mb-2">
                            {getLocalized(product, locale, "name")}
                        </h3>
                        {priceDisplay && (
                            <p className="text-[13px] text-primary/60 font-medium mt-1">
                                {product.price_from ? `${t('ui.from')} ` : ''}{priceDisplay}
                            </p>
                        )}
                    </div>

                    <div className="mt-2 sm:mt-6 flex justify-center w-full">
                        <div className="w-full bg-[#1e2d7d] text-white font-bold text-[11px] sm:text-sm py-2 sm:py-3 px-2 sm:px-6 rounded-lg hover:bg-[#152158] transition-colors duration-200 cursor-pointer text-center">
                            {t('ui.details')}
                        </div>
                    </div>
                </div>
            </Link>
        </motion.div>
    );
}
