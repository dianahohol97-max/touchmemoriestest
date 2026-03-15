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
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            whileHover={{ y: -8 }}
            transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
            className="group flex flex-col h-full bg-white rounded-brand border border-black/[0.03] transition-all hover:shadow-[0_30px_60px_-15px_rgba(0,0,0,0.1)] overflow-hidden"
        >
            <Link href={`/catalog/${product.slug}`} className="no-underline text-inherit flex flex-col h-full">
                <div className="relative w-full aspect-[4/5] overflow-hidden bg-gray-50">
                    <Image
                        src={product.images?.[0] || 'https://via.placeholder.com/400'}
                        alt={product.name}
                        fill
                        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                        className="object-cover transition-transform duration-1000 ease-[0.23,1,0.32,1] group-hover:scale-110"
                    />
                    <div className="absolute top-4 right-4 z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                        <WishlistButton productId={product.id} />
                    </div>
                </div>

                <div className="pt-8 pb-6 px-6 flex flex-col flex-1 gap-2">
                    <div className="flex justify-between items-start">
                        <span className="text-[10px] text-primary font-bold uppercase tracking-[0.2em] opacity-40">
                            {product.categories?.name || 'Товар'}
                        </span>
                    </div>

                    <h3 className="font-heading text-lg font-bold m-0 text-primary leading-tight tracking-tight group-hover:text-primary/80 transition-colors">
                        {product.name}
                    </h3>

                    <div className="text-[16px] font-bold text-primary mt-auto pt-4 flex items-center justify-between">
                        <span>
                            {product.price_from ? <span className="text-xs opacity-40 font-normal mr-1 lowercase tracking-normal">від</span> : ''}
                            {product.price} ₴
                        </span>

                        <span className="text-[10px] font-black text-primary opacity-0 group-hover:opacity-100 translate-x-[-10px] group-hover:translate-x-0 transition-all duration-500 uppercase tracking-widest flex items-center gap-2">
                            {product.is_personalized ? 'Створити' : 'Замовити'}
                            <span className="text-sm font-normal">→</span>
                        </span>
                    </div>
                </div>
            </Link>
        </motion.div>
    );
}
