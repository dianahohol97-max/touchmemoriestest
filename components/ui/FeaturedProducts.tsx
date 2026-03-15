'use client';
import { motion } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
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
            className="pt-4 pb-4 bg-gray-50/30"
            style={{
                borderRadius: style.border_radius || '0px'
            }}
        >
            <div className="container text-center">
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={inView ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.6, ease: [0.23, 1, 0.32, 1] }}
                >
                    <h2 className="font-heading text-[40px] font-black leading-[1.1] text-primary mb-12">
                        Найпопулярніші товари
                    </h2>
                </motion.div>
            </div>
            <div className="container">
                <ProductStrip products={products} />
            </div>
        </section>
    );
}
