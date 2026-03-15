'use client';
import { motion } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import { Image as ImageIcon } from 'lucide-react';
import Link from 'next/link';
import { useTheme } from '@/components/providers/ThemeProvider';
import { DynamicText } from './DynamicText';
import { ProductStrip } from './ProductStrip';

interface Product {
    id: string;
    name: string;
    price: string | number;
    price_from?: boolean;
    images: string[];
    slug: string;
}

export function FeaturedProducts({ products = [] }: { products: Product[] }) {
    const { blocks } = useTheme();
    const block = blocks.find(b => b.block_name === 'featured_products');
    const style = block?.style_metadata || {};

    const { ref, inView } = useInView({
        triggerOnce: true,
        threshold: 0.1,
    });

    return (
        <section
            ref={ref}
            className="py-12 bg-white"
            style={{
                borderRadius: style.border_radius || '0px'
            }}
        >
            <div className="container px-4">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
                    transition={{ duration: 0.6, ease: [0.23, 1, 0.32, 1] }}
                    className="text-center mb-16"
                >
                    <h2 className="text-[32px] lg:text-[40px] font-black leading-tight text-primary">
                        Найпопулярніші товари
                    </h2>
                </motion.div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 justify-center">
                    {products?.map((product, idx) => (
                        <motion.div
                            key={product.id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={inView ? { opacity: 1, y: 0 } : {}}
                            transition={{ duration: 0.5, delay: idx * 0.1 }}
                            className="flex justify-center"
                        >
                            <Link
                                href={`/product/${product.slug}`}
                                className="group flex flex-col w-full max-w-[320px] bg-white rounded-[12px] overflow-hidden transition-all duration-500 hover:-translate-y-2 hover:shadow-[0_20px_40px_rgba(0,0,0,0.08)] border border-gray-100/50"
                            >
                                <div className="aspect-[4/5] relative overflow-hidden bg-gray-50">
                                    {product.images?.[0] ? (
                                        <img
                                            src={product.images[0]}
                                            alt={product.name}
                                            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                                        />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-primary/10">
                                            <ImageIcon size={48} />
                                        </div>
                                    )}
                                </div>
                                <div className="p-6 flex flex-col items-center text-center flex-grow">
                                    <h3 className="font-heading font-extrabold text-[16px] text-primary mb-6 transition-colors group-hover:text-primary/80 h-10 line-clamp-2">
                                        {product.name}
                                    </h3>
                                    <div className="mt-auto w-full">
                                        <div className="btn-primary w-full text-[13px] py-3 rounded-[6px] transition-all group-hover:bg-primary-hover">
                                            Детальніше
                                        </div>
                                    </div>
                                </div>
                            </Link>
                        </motion.div>
                    ))}
                </div>
            </div>
        </section>
    );
}
