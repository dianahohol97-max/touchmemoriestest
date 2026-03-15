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
            transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
            className="flex flex-col h-full bg-white rounded-brand border border-transparent transition-all hover:shadow-[0_20px_40px_rgba(0,0,0,0.06)]"
        >
            <Link href={`/catalog/${product.slug}`} className="no-underline text-inherit flex flex-col h-full">
                <div className="relative w-full aspect-[4/5] overflow-hidden bg-gray-50 rounded-brand">
                    <Image
                        src={product.images?.[0] || 'https://via.placeholder.com/400'}
                        alt={product.name}
                        fill
                        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                        className="object-cover transition-transform duration-700 ease-out hover:scale-110"
                    />
                    <div className="absolute top-4 right-4 z-10">
                        <WishlistButton productId={product.id} />
                    </div>
                </div>

                <div className="pt-8 pb-4 px-2 flex flex-col gap-1.5">
                    <span className="text-[10px] text-primary font-bold uppercase opacity-50 tracking-[0.2em]">
                        {typeof product.categories === 'object' ? product.categories?.name : 'Товар'}
                    </span>
                    <h3 className="font-heading text-xl font-bold m-0 text-primary leading-tight tracking-tight">
                        {product.name}
                    </h3>

                    <div className="text-[17px] font-bold text-primary mt-4">
                        {product.price_from ? <span className="text-sm opacity-60 font-normal mr-1">від</span> : ''}{product.price} ₴
                    </div>

                    <p className="font-body text-[14px] text-gray-500 mt-4 mb-8 line-clamp-2 leading-relaxed opacity-80">
                        {product.short_description || 'Преміальна якість друку та матеріалів для ваших найкращих спогадів.'}
                    </p>

                    <div className="mt-auto">
                        <span className="text-[11px] font-extrabold text-primary flex items-center gap-2 uppercase tracking-[0.15em] group-hover:gap-3 transition-all">
                            {product.is_personalized
                                ? 'Створити'
                                : product.is_partially_personalized
                                    ? 'Персоналізувати'
                                    : 'Замовити'}
                            <span className="text-lg">→</span>
                        </span>
                    </div>
                </div>
            </Link>
        </motion.div>
    );
}
