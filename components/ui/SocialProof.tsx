'use client';
import { motion } from 'framer-motion';
import styles from './SocialProof.module.css';
import { useInView } from 'react-intersection-observer';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useRef, useState, useEffect } from 'react';
import { useTheme } from '@/components/providers/ThemeProvider';
import { DynamicText } from './DynamicText';
import { useT } from '@/lib/i18n/context';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface Review {
    id: string;
    image_url: string;
    video_url?: string | null;
    media_type?: string | null;
    author: string | null;
    category: string | null;
    rating?: number | null;
}

// There is no placeholder review set any more.
//
// What used to sit here: five objects pairing a REAL Instagram handle
// (@maybe_natasha, @nasstya.ss, …) with a stock Unsplash photograph, used as
// the initial useState value. Because it was the initial state and not an
// error path, every single visitor was served those five stock images in the
// HTML and saw them until the fetch resolved — a stranger's stock photo
// published under a real customer's name, in the block titled «Ваші відгуки».
//
// The DB has had eight genuine reviews in our own storage since well before
// this was noticed, so the placeholders were never needed; they were simply
// never removed. Starting from an empty list means the block renders nothing
// until real rows arrive, and hides itself entirely if there are none.

export function SocialProof() {
    const { ref, inView } = useInView({
        triggerOnce: true,
        threshold: 0.1,
    });
    const { content, blocks } = useTheme();
    const t = useT();
    const block = blocks.find(b => b.block_name === 'social_proof');
    const style = block?.style_metadata || {};

    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const [reviews, setReviews] = useState<Review[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchReviews() {
            try {
                const { data, error } = await supabase
                    .from('reviews')
                    .select('id, image_url, video_url, media_type, author, category, rating')
                    .eq('is_active', true)
                    .or('image_url.not.is.null,video_url.not.is.null')
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

    // Nothing to show → render nothing. A heading reading «Ваші відгуки» above
    // an empty rail is worse than no section, and it is also the state a
    // crawler would index if the fetch ever failed. `loading` keeps the block
    // out of the first paint rather than flashing an empty rail on the way in.
    if (loading || reviews.length === 0) return null;

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
                        {t('social_proof.your_reviews')}
                    </h2>

                    <p className="text-[18px] opacity-70 mb-8 md:mb-16 font-body leading-relaxed max-w-2xl mx-auto">
                        {t('social_proof.reviews_subtitle')}
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
                                {review.media_type === 'video' && review.video_url ? (
                                    <video
                                        src={review.video_url}
                                        muted
                                        loop
                                        playsInline
                                        autoPlay
                                        preload="metadata"
                                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                                    />
                                ) : (
                                    <img
                                        src={review.image_url}
                                        alt={review.author ? `Фото клієнта touch.memories, ${review.author}` : 'Фото клієнта touch.memories'}
                                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                                    />
                                )}
                                {/* Gradient Overlay */}
                                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-80 group-hover:opacity-90 transition-opacity duration-300" />

                                {/* Username */}
                                <div className="absolute bottom-8 left-0 right-0 text-center px-4 transform transition-transform duration-300 group-hover:translate-y-[-8px]">
                                    {review.rating ? (
                                        <div className="text-[#FFD37E] text-[13px] mb-1 tracking-widest" aria-label={`${review.rating} of 5`}>
                                            {'★'.repeat(Math.round(review.rating))}{'☆'.repeat(Math.max(0, 5 - Math.round(review.rating)))}
                                        </div>
                                    ) : null}
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
