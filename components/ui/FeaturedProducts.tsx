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
            className="section-padding bg-gray-50/30"
            style={{
                borderRadius: style.border_radius || '0px'
            }}
        >
            <div className="container text-center">
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={inView ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.95 }}
                    transition={{ duration: 1, ease: [0.23, 1, 0.32, 1] }}
                >
                    <div className="inline-block px-4 py-2 bg-primary/5 rounded-full mb-10">
                        <span className="text-[11px] font-black uppercase tracking-[0.4em] text-primary/50">Вибране для вас</span>
                    </div>

                    <h2 className="section-title text-center max-w-3xl mx-auto mb-10">
                        <DynamicText contentKey="featured_title" fallback="Найпопулярніші товари, що зберігають ваші спогади" />
                    </h2>

                    <p className="section-subtitle text-center mb-24 px-4">
                        <DynamicText contentKey="featured_subtitle" fallback="Відкрийте для себе наші найкращі пропозиції, що стали улюбленими серед сотень клієнтів за якість та емоційність." />
                    </p>
                </motion.div>
            </div>
            <div className="container">
                <ProductStrip products={products} />
            </div>
        </section>
    );
}
