'use client';
import { motion } from 'framer-motion';
import styles from './SocialProof.module.css';
import { useInView } from 'react-intersection-observer';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useRef } from 'react';
import { useTheme } from '@/components/providers/ThemeProvider';
import { DynamicText } from './DynamicText';

const photos = [
    { id: 1, username: '@maybe_natasha', image: 'https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=600' },
    { id: 2, username: '@nasstya.ss', image: 'https://images.unsplash.com/photo-1506869640319-fe1a24fd76dc?w=600' },
    { id: 3, username: '@ann_surovtseva', image: 'https://images.unsplash.com/photo-1511285560929-80b456fea0bc?w=600' },
    { id: 4, username: '@shcherbakova_mladshaya', image: 'https://images.unsplash.com/photo-1589829085413-56de8ae18c73?w=600' },
    { id: 5, username: '@nataplushcheva', image: 'https://images.unsplash.com/photo-1516627145497-ae6968895b74?w=600' },
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

    const scroll = (direction: 'left' | 'right') => {
        if (scrollContainerRef.current) {
            const scrollAmount = direction === 'left' ? -300 : 300;
            scrollContainerRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
        }
    };

    return (
        <section
            ref={ref}
            className="section-padding bg-white"
            style={{
                borderRadius: style.border_radius || '0px'
            }}
        >
            <div className="container text-center">
                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
                    transition={{ duration: 1, ease: [0.23, 1, 0.32, 1] }}
                >
                    <div className="inline-block px-4 py-2 bg-primary/5 rounded-full mb-10">
                        <span className="text-[11px] font-black uppercase tracking-[0.4em] text-primary/50">Відгуки клієнтів</span>
                    </div>

                    <h2 className="section-title text-center max-w-3xl mx-auto mb-10">
                        <DynamicText contentKey="social_proof_title" fallback="Ваші історії в наших книгах" />
                    </h2>

                    <p className="section-subtitle text-center mb-24 px-4">
                        <DynamicText contentKey="social_proof_subtitle" fallback="Ми щасливі бути частиною ваших найтепліших спогадів. Погляньте, як наші клієнти зберігають свої моменти." />
                    </p>
                </motion.div>
            </div>

            <div className="container relative">
                <div className="absolute top-1/2 left-0 w-full h-1/2 bg-gray-50/50 -z-10 translate-y-24" />
                <div style={{ position: 'relative', maxWidth: '1400px', margin: '0 auto', padding: '0 20px' }}>
                    {/* Left Arrow */}
                    <button
                        onClick={() => scroll('left')}
                        style={{
                            position: 'absolute',
                            left: '20px',
                            top: '50%',
                            transform: 'translateY(-50%)',
                            zIndex: 10,
                            width: '48px',
                            height: '48px',
                            backgroundColor: 'white',
                            borderRadius: "3px",
                            boxShadow: '0 10px 30px rgba(0,0,0,0.1)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'var(--primary)',
                            border: 'none',
                            cursor: 'pointer',
                            transition: 'transform 0.2s'
                        }}
                        className={`${styles.navBtn} ${styles.desktopOnly}`}
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
                        className={styles.noScrollbar}
                        style={{
                            display: 'flex',
                            gap: '24px',
                            overflowX: 'auto',
                            WebkitOverflowScrolling: 'touch',
                            scrollSnapType: 'x mandatory',
                            paddingBottom: '32px'
                        }}
                    >
                        {photos.map((photo) => (
                            <div
                                key={photo.id}
                                style={{
                                    flexShrink: 0,
                                    width: 'min(75vw, 320px)',
                                    aspectRatio: '3/4',
                                    scrollSnapAlign: 'center',
                                    overflow: 'hidden',
                                    borderRadius: "3px",
                                    cursor: 'pointer',
                                    position: 'relative'
                                }}
                                className="group"
                            >
                                <img
                                    src={photo.image}
                                    alt={`Customer photo by ${photo.username}`}
                                    style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 0.5s' }}
                                    className={styles.photoImg}
                                />
                                {/* Gradient Overlay */}
                                <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0.2) 50%, transparent 100%)', opacity: 0.8 }} />

                                {/* Username */}
                                <div style={{ position: 'absolute', bottom: '32px', left: 0, right: 0, textAlign: 'center' }}>
                                    <span style={{ fontSize: '15px', color: '#E5D5C5', fontFamily: 'var(--font-sans)' }}>
                                        {photo.username}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </motion.div>

                    {/* Right Arrow */}
                    <button
                        onClick={() => scroll('right')}
                        style={{
                            position: 'absolute',
                            right: '20px',
                            top: '50%',
                            transform: 'translateY(-50%)',
                            zIndex: 10,
                            width: '48px',
                            height: '48px',
                            backgroundColor: 'white',
                            borderRadius: "3px",
                            boxShadow: '0 10px 30px rgba(0,0,0,0.1)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'var(--primary)',
                            border: 'none',
                            cursor: 'pointer',
                            transition: 'transform 0.2s'
                        }}
                        className={`${styles.navBtn} ${styles.desktopOnly}`}
                        aria-label="Next"
                    >
                        <ChevronRight size={24} />
                    </button>
                </div>
            </div>
        </section>
    );
}
