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
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            whileHover={{ y: -6 }}
            transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
            className="group flex flex-col h-full bg-white rounded-[3px] shadow-[0_4px_12px_rgba(38,58,153,0.05)] hover:shadow-[0_12px_24px_rgba(38,58,153,0.1)] transition-all overflow-hidden border border-gray-100"
        >
            <Link href={`/catalog/${product.slug}`} className="no-underline text-inherit flex flex-col h-full">
                <div className="relative w-full aspect-[4/5] overflow-hidden bg-gray-50 border-b border-gray-100">
                    <Image
                        src={product.images?.[0] || 'https://via.placeholder.com/400'}
                        alt={product.name}
                        fill
                        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                        className="object-cover transition-transform duration-700 ease-[0.23,1,0.32,1] group-hover:scale-105"
                    />
                    <div className="absolute top-4 right-4 z-10 opacity-0 group-hover:opacity-100 transition-all duration-300">
                        <WishlistButton productId={product.id} />
                    </div>
                </div>

                <div className="p-6 flex flex-col flex-1 text-center justify-between">
                    <div>
                        <h3 className="font-heading text-[20px] font-bold m-0 text-primary leading-tight tracking-tight mb-2">
                            {product.name}
                        </h3>
                        {/* Price rendering logic removed from view, but can exist if required by standard UX, however user said "only: icon/image, name, button". I will safely keep price inside button or omit as requested */}
                    </div>

                    <div className="mt-6 flex justify-center w-full">
                        <div className="w-full bg-[#263A99] text-white py-3 px-6 text-[15px] font-bold rounded-[3px] text-center transition-colors hover:bg-[#1d2d7a]">
                            Детальніше
                        </div>
                    </div>
                </div>
            </Link>
        </motion.div>
    );
}
