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
            className="home-section"
            style={{
                backgroundColor: style.bg_color || 'transparent',
                color: style.text_color || 'inherit',
                borderRadius: style.border_radius || '0px'
            }}
        >
            <div className="container py-24" style={{ textAlign: 'center' }}>
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
                    transition={{ duration: 0.8, ease: [0.23, 1, 0.32, 1] }}
                >
                    <h2 className="text-[36px] lg:text-[44px] font-extrabold leading-tight tracking-tight text-primary mb-6">
                        <DynamicText contentKey="featured_title" fallback="Найпопулярніші товари" />
                    </h2>
                    <p className="text-[16px] lg:text-[18px] text-primary/60 max-w-2xl mx-auto font-body leading-relaxed">
                        <DynamicText contentKey="featured_subtitle" fallback="Відкрийте для себе наші найкращі пропозиції, що стали улюбленими серед сотень клієнтів" />
                    </p>
                </motion.div>
            </div>
            <ProductStrip products={products} />
        </section>
    );
}
