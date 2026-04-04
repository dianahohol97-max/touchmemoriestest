'use client';
import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import { Image as ImageIcon, ChevronLeft, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { useTheme } from '@/components/providers/ThemeProvider';
import { useT, useLocale } from '@/lib/i18n/context';
import { detectCurrency, formatPrice } from '@/lib/i18n/currency';

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
    const t = useT();
    const locale = useLocale();
    const currency = useMemo(() => detectCurrency(locale), [locale]);
    const block = blocks.find(b => b.block_name === 'featured_products');
    const style = block?.style_metadata || {};
    const [currentIndex, setCurrentIndex] = useState(0);

    if (!products || products.length === 0) return null;

    const { ref, inView } = useInView({
        triggerOnce: true,
        threshold: 0.1,
    });

    // Responsive visible count (4 on desktop, 2 on tablet, 1 on mobile with peek)
    const getVisibleCount = () => {
        if (typeof window !== 'undefined') {
            if (window.innerWidth >= 1024) return 4; // lg breakpoint
            if (window.innerWidth >= 768) return 2;  // md breakpoint
            return 1.5; // mobile with peek
        }
        return 4; // default for SSR
    };

    const [visibleCount, setVisibleCount] = useState(getVisibleCount());

    // Update visible count on resize
    if (typeof window !== 'undefined') {
        window.addEventListener('resize', () => setVisibleCount(getVisibleCount()));
    }

    const maxIndex = Math.max(0, products.length - Math.floor(visibleCount));

    const next = () => setCurrentIndex(i => Math.min(i + 1, maxIndex));
    const prev = () => setCurrentIndex(i => Math.max(i - 1, 0));

    // Calculate progress for dots
    const totalDots = maxIndex + 1;

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

                {/* Carousel Container */}
                <div className="relative">
                    {/* Left Arrow */}
                    <button
                        onClick={prev}
                        disabled={currentIndex === 0}
                        className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-4 z-10 bg-[#1e2d7d] text-white w-12 h-12 rounded-full flex items-center justify-center shadow-[0_4px_20px_rgba(38,58,153,0.35)] hover:bg-[#152158] hover:scale-105 transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100"
                        aria-label="Previous products"
                    >
                        <ChevronLeft size={24} />
                    </button>

                    {/* Right Arrow */}
                    <button
                        onClick={next}
                        disabled={currentIndex >= maxIndex}
                        className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-4 z-10 bg-[#1e2d7d] text-white w-12 h-12 rounded-full flex items-center justify-center shadow-[0_4px_20px_rgba(38,58,153,0.35)] hover:bg-[#152158] hover:scale-105 transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100"
                        aria-label="Next products"
                    >
                        <ChevronRight size={24} />
                    </button>

                    {/* Slider */}
                    <div className="overflow-hidden px-2">
                        <div
                            className="flex gap-6 transition-transform duration-500 ease-in-out"
                            style={{
                                transform: `translateX(-${currentIndex * (100 / visibleCount)}%)`
                            }}
                        >
                            {products?.map((product, idx) => (
                                <motion.div
                                    key={product.id}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={inView ? { opacity: 1, y: 0 } : {}}
                                    transition={{ duration: 0.5, delay: idx * 0.1 }}
                                    className="flex-shrink-0"
                                    style={{
                                        width: `calc(${100 / visibleCount}% - ${(visibleCount - 1) * 24 / visibleCount}px)`
                                    }}
                                >
                                    <Link
                                        href={`/catalog/${product.slug}`}
                                        className="group flex flex-col h-full bg-white rounded-2xl overflow-hidden shadow-sm border border-stone-100 hover:-translate-y-1 hover:shadow-[0_8px_32px_rgba(38,58,153,0.16)] transition-all duration-250 cursor-pointer"
                                    >
                                        <div className="aspect-[2/3] relative overflow-hidden bg-gray-50">
                                            {product.images?.[0] ? (
                                                <img
                                                    src={product.images[0]}
                                                    alt={product.name}
                                                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                                                />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center text-[#1e2d7d]/10">
                                                    <ImageIcon size={48} />
                                                </div>
                                            )}
                                        </div>
                                        <div className="p-4 md:p-5 flex flex-col items-center text-center flex-grow">
                                            <h3 className="text-base font-bold text-stone-900 mb-1 line-clamp-2">
                                                {product.name}
                                            </h3>
                                            <div className="mt-auto w-full pt-4">
                                                <div className="text-lg font-black text-[#1e2d7d]">
                                                    {product.price_from ? `${t('ui.from')} ` : ''}{formatPrice(typeof product.price === 'string' ? parseFloat(product.price) : product.price, currency)}
                                                </div>
                                            </div>
                                        </div>
                                    </Link>
                                </motion.div>
                            ))}
                        </div>
                    </div>

                    {/* Pagination Dots */}
                    {totalDots > 1 && (
                        <div className="flex justify-center gap-2 mt-8">
                            {Array.from({ length: totalDots }).map((_, idx) => (
                                <button
                                    key={idx}
                                    onClick={() => setCurrentIndex(idx)}
                                    className={`w-2 h-2 rounded-full transition-all duration-300 ${
                                        idx === currentIndex
                                            ? 'bg-stone-900 w-8'
                                            : 'bg-stone-300 hover:bg-stone-500'
                                    }`}
                                    aria-label={`Go to slide ${idx + 1}`}
                                />
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </section>
    );
}
