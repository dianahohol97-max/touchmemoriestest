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
            <div className="container" style={{ textAlign: 'center', marginBottom: '40px' }}>
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
                    transition={{ duration: 0.6 }}
                >
                    <h2 style={{
                        fontFamily: 'var(--font-heading)',
                        fontSize: 'min(36px, 8vw)',
                        fontWeight: 900,
                        color: 'var(--section-heading-color)',
                        marginBottom: '12px'
                    }}>
                        <DynamicText contentKey="featured_title" fallback="Найпопулярніші товари" />
                    </h2>
                    <p style={{
                        color: 'inherit',
                        opacity: 0.8,
                        maxWidth: '600px',
                        margin: '0 auto'
                    }}>
                        <DynamicText contentKey="featured_subtitle" fallback="Відкрийте для себе наші найкращі пропозиції" />
                    </p>
                </motion.div>
            </div>
            <ProductStrip products={products} />
        </section>
    );
}
