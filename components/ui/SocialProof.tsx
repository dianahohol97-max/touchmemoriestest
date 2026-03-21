'use client';
import { motion } from 'framer-motion';
import styles from './SocialProof.module.css';
import { useInView } from 'react-intersection-observer';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useRef, useState, useEffect } from 'react';
import { useTheme } from '@/components/providers/ThemeProvider';
import { DynamicText } from './DynamicText';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface Review {
    id: string;
    image_url: string;
    author: string | null;
    category: string | null;
}

const fallbackReviews = [
    {
        id: '1',
        author: '@maybe_natasha',
        image_url: "https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=600",
        category: 'Весільна книга'
    },
    {
        id: '2',
        author: '@nasstya.ss',
        image_url: "https://images.unsplash.com/photo-1506869640319-fe1a24fd76dc?w=600",
        category: 'Travel Book'
    },
    {
        id: '3',
        author: '@ann_surovtseva',
        image_url: "https://images.unsplash.com/photo-1511285560929-80b456fea0bc?w=600",
        category: 'Family Album'
    },
    {
        id: '4',
        author: '@shcherbakova_mladshaya',
        image_url: "https://images.unsplash.com/photo-1589829085413-56de8ae18c73?w=600",
        category: 'Design Service'
    },
    {
        id: '5',
        author: '@nataplushcheva',
        image_url: "https://images.unsplash.com/photo-1516627145497-ae6968895b74?w=600",
        category: 'Photo Print'
    }
];

export function SocialProof() {
    const { ref, inView } = useInView({
        triggerOnce: true,
        threshold: 0.1,
    });
    const { content, blocks } = useTheme();
    const block = blocks.find(b => b.block_name === 'social_proof');
    const style = block?.style_metadata || {};

    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const [reviews, setReviews] = useState<Review[]>(fallbackReviews);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchReviews() {
            try {
                const { data, error } = await supabase
                    .from('reviews')
                    .select('id, image_url, author, category')
                    .eq('is_active', true)
                    .order('sort_order', { ascending: true });

                if (data && data.length > 0) {
                    setReviews(data);
                } else if (error) {
                    console.error('Error fetching reviews:', error);
                }
            } catch (err) {
                console.error('Error:', err);
            } finally {
                setLoading(false);
            }
        }

        fetchReviews();
    }, []);

    const scroll = (direction: 'left' | 'right') => {
        if (scrollContainerRef.current) {
            const scrollAmount = direction === 'left' ? -300 : 300;
            scrollContainerRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
        }
    };

    return (
        <section ref={ref} className="section-padding bg-white overflow-hidden relative">
            {/* Decorative Background Pattern */}
            <div className="absolute top-0 right-0 w-1/2 h-full bg-slate-50 -z-10 rounded-bl-[100px]" />
            <div className="absolute top-1/2 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-gray-200 to-transparent -z-10" />

            <div className="container text-center">
                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
                    transition={{ duration: 1, ease: [0.23, 1, 0.32, 1] }}
                    className="mb-8"
                >
                    <h2 className="text-[40px] lg:text-[48px] font-black leading-[1.05] tracking-tight mb-4 text-[#1e2d7d]">
                        Ваші відгуки
                    </h2>

                    <p className="text-[18px] opacity-70 mb-16 font-body leading-relaxed max-w-2xl mx-auto">
                        Ми щасливі бути частиною ваших найтепліших спогадів. Погляньте, як наші клієнти зберігають свої моменти.
                    </p>
                </motion.div>
            </div>

            <div className="container relative">
                <div className="relative max-w-[1400px] mx-auto px-5 lg:px-12">
                    {/* Left Arrow */}
                    <button
                        onClick={() => scroll('left')}
                        className={`absolute left-0 top-1/2 -translate-y-1/2 z-10 w-12 h-12 bg-white rounded-[3px] shadow-[var(--shadow-premium)] flex items-center justify-center text-primary border border-gray-100 hover:bg-gray-50 transition-colors ${styles.desktopOnly}`}
                        aria-label="Previous"
                    >
                        <ChevronLeft size={24} />
                    </button>

                    {/* Scrollable Container */}
                    <motion.div
                        initial={{ opacity: 0, y: 40 }}
                        animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 40 }}
                        transition={{ duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94], delay: 0.2 }}
                        ref={scrollContainerRef}
                        className={`flex gap-6 overflow-x-auto pb-12 snap-x snap-mandatory ${styles.noScrollbar}`}
                    >
                        {reviews.map((review) => (
                            <div
                                key={review.id}
                                className="flex-none w-[min(65vw,280px)] aspect-[9/16] snap-center overflow-hidden rounded-[3px] cursor-pointer relative group bg-gray-100 shadow-[var(--shadow-premium)] border border-white/20"
                            >
                                <img
                                    src={review.image_url}
                                    alt={`Customer photo by ${review.author || 'customer'}`}
                                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                                />
                                {/* Gradient Overlay */}
                                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-80 group-hover:opacity-90 transition-opacity duration-300" />

                                {/* Username */}
                                <div className="absolute bottom-8 left-0 right-0 text-center px-4 transform transition-transform duration-300 group-hover:translate-y-[-8px]">
                                    <span className="text-[15px] text-[#E5D5C5] font-sans font-bold tracking-wide">
                                        {review.author || '@customer'}
                                    </span>
                                </div>
                                {/* Instagram Style Overlay */}
                                <div className="absolute top-4 right-4 bg-white/20 backdrop-blur-md px-3 py-1 rounded-[3px] text-white text-[10px] font-bold uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                                    Instagram
                                </div>
                            </div>
                        ))}
                    </motion.div>

                    {/* Right Arrow */}
                    <button
                        onClick={() => scroll('right')}
                        className={`absolute right-0 top-1/2 -translate-y-1/2 z-10 w-12 h-12 bg-white rounded-[3px] shadow-[var(--shadow-premium)] flex items-center justify-center text-primary border border-gray-100 hover:bg-gray-50 transition-colors ${styles.desktopOnly}`}
                        aria-label="Next"
                    >
                        <ChevronRight size={24} />
                    </button>
                </div>
            </div>
        </section>
    );
}
