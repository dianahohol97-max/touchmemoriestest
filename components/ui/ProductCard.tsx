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
            whileHover={{ y: -12 }}
            transition={{ duration: 0.6, ease: [0.23, 1, 0.32, 1] }}
            className="group flex flex-col h-full bg-white rounded-brand border border-primary/[0.05] shadow-[var(--shadow-premium)] hover:shadow-[var(--shadow-hover)] transition-all overflow-hidden"
        >
            <Link href={`/catalog/${product.slug}`} className="no-underline text-inherit flex flex-col h-full">
                <div className="relative w-full aspect-[4/5] overflow-hidden bg-gray-50 border-b border-primary/[0.03]">
                    <Image
                        src={product.images?.[0] || 'https://via.placeholder.com/400'}
                        alt={product.name}
                        fill
                        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                        className="object-cover transition-transform duration-1000 ease-[0.23,1,0.32,1] group-hover:scale-110 group-hover:rotate-1"
                    />
                    <div className="absolute top-5 right-5 z-10 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-2 group-hover:translate-y-0">
                        <WishlistButton productId={product.id} />
                    </div>
                    {product.is_personalized && (
                        <div className="absolute bottom-4 left-4 z-10">
                            <span className="bg-primary text-white text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full shadow-lg">
                                Створити свій
                            </span>
                        </div>
                    )}
                </div>

                <div className="pt-10 pb-8 px-8 flex flex-col flex-1 gap-3">
                    <div className="flex justify-between items-start">
                        <span className="text-[10px] text-primary font-black uppercase tracking-[0.3em] opacity-30">
                            {product.categories?.name || 'Товар'}
                        </span>
                    </div>

                    <h3 className="font-heading text-xl font-bold m-0 text-primary leading-tight tracking-tight group-hover:text-primary transition-colors">
                        {product.name}
                    </h3>

                    <p className="text-[14px] text-primary/40 leading-relaxed font-body line-clamp-2 mt-2 opacity-0 group-hover:opacity-100 transition-opacity duration-500">
                        {product.short_description || 'Відкрийте для себе преміальну якість друку та матеріалів.'}
                    </p>

                    <div className="text-[18px] font-black text-primary mt-auto pt-6 flex items-center justify-between">
                        <div className="flex flex-col">
                            {product.price_from && <span className="text-[10px] opacity-30 uppercase font-black tracking-widest mb-1">від</span>}
                            <span>{product.price} ₴</span>
                        </div>

                        <div className="w-12 h-12 rounded-full border border-primary/20 flex items-center justify-center group-hover:bg-primary group-hover:border-primary group-hover:text-white transition-all duration-500">
                            <span className="text-xl font-light">→</span>
                        </div>
                    </div>
                </div>
            </Link>
        </motion.div>
    );
}
