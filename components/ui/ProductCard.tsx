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
            className="flex flex-col h-full bg-white rounded-brand border border-transparent transition-all"
        >
            <Link href={`/catalog/${product.slug}`} className="no-underline text-inherit flex flex-col h-full">
                <div className="relative w-full aspect-square overflow-hidden bg-gray-50 rounded-brand">
                    <Image
                        src={product.images?.[0] || 'https://via.placeholder.com/400'}
                        alt={product.name}
                        fill
                        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                        className="object-cover transition-transform duration-500 hover:scale-105"
                    />
                    <div className="absolute top-3 right-3 z-10">
                        <WishlistButton productId={product.id} />
                    </div>
                </div>

                <div className="pt-6 pb-2 px-0 flex flex-col gap-1">
                    <span className="text-[11px] text-primary font-bold uppercase opacity-70 tracking-widest">
                        {typeof product.categories === 'object' ? product.categories?.name : 'Товар'}
                    </span>
                    <h3 className="font-heading text-lg font-bold m-0 text-textPrimary leading-tight">
                        {product.name}
                    </h3>

                    <div className="text-base font-extrabold text-primary mt-3">
                        {product.price_from ? 'від ' : ''}{product.price} ₴
                    </div>

                    <p className="font-body text-[15px] text-gray-600 mt-4 mb-6 line-clamp-2 leading-relaxed">
                        {product.short_description || 'Преміальна якість друку та матеріалів.'}
                    </p>

                    <div className="mt-auto">
                        <span className="text-sm font-bold text-primary flex items-center gap-2 uppercase tracking-wider group">
                            {product.is_personalized
                                ? 'Створити'
                                : product.is_partially_personalized
                                    ? 'Персоналізувати'
                                    : 'Замовити'}
                            <span className="text-lg transition-transform group-hover:translate-x-1">→</span>
                        </span>
                    </div>
                </div>
            </Link>
        </motion.div>
    );
}
