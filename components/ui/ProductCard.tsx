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
    const categoryName = typeof product.categories === 'object' ? product.categories?.name : 'Товар';

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            whileHover={{ y: -10 }}
            transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
            className="group flex flex-col h-full bg-white rounded-brand border border-black/[0.03] transition-all hover:shadow-[0_30px_60px_-15px_rgba(0,0,0,0.1)] overflow-hidden"
        >
            <Link href={`/catalog/${product.slug}`} className="no-underline text-inherit flex flex-col h-full">
                {/* Image Container */}
                <div className="relative w-full aspect-[4/5] overflow-hidden bg-[#F9F9FB]">
                    <Image
                        src={product.images?.[0] || 'https://via.placeholder.com/400'}
                        alt={product.name}
                        fill
                        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                        className="object-cover transition-transform duration-1000 ease-[0.22, 1, 0.36, 1] group-hover:scale-105"
                    />

                    {/* Premium Badges */}
                    <div className="absolute top-4 left-4 z-20 flex flex-col gap-2">
                        {(product as any).is_popular && (
                            <div className="bg-white/90 backdrop-blur-md text-primary px-3 py-1 rounded-brand text-[10px] font-bold uppercase tracking-wider border border-primary/10 shadow-sm">
                                Хіт сезону
                            </div>
                        )}
                        {Number(product.price) > 2000 && (
                            <div className="bg-white/90 backdrop-blur-md text-primary px-3 py-1 rounded-brand text-[10px] font-bold uppercase tracking-wider border border-primary/10 shadow-sm">
                                ✨ Luxury Gift
                            </div>
                        )}
                    </div>

                    <div className="absolute top-4 right-4 z-30 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                        <WishlistButton productId={product.id} />
                    </div>

                    {/* Hover Overlay */}
                    <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                </div>

                {/* Info */}
                <div className="pt-8 pb-8 px-6 flex flex-col items-center text-center gap-2">
                    <span className="text-[11px] text-primary/40 font-bold uppercase tracking-[0.25em]">
                        {categoryName}
                    </span>
                    <h3 className="font-heading text-[22px] font-extrabold m-0 text-primary leading-tight tracking-tight group-hover:text-primary transition-colors">
                        {product.name}
                    </h3>

                    <div className="text-[18px] font-bold text-primary opacity-80 mt-4">
                        {product.price_from ? <span className="text-[13px] opacity-40 font-bold uppercase mr-1 tracking-wider">від</span> : ''}{product.price} ₴
                    </div>

                    <div className="mt-8">
                        <span className="text-[12px] font-extrabold text-primary flex items-center justify-center gap-2 uppercase tracking-[0.2em] opacity-0 group-hover:opacity-100 transform translate-y-4 group-hover:translate-y-0 transition-all duration-500">
                            {product.is_personalized
                                ? 'Створити'
                                : product.is_partially_personalized
                                    ? 'Персоналізувати'
                                    : 'Замовити'}
                            <span className="text-lg leading-none">→</span>
                        </span>
                    </div>
                </div>
            </Link>
        </motion.div>
    );
}
