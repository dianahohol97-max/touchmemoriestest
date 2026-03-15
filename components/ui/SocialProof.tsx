'use client';
import { motion } from 'framer-motion';
import styles from './SocialProof.module.css';
import { useInView } from 'react-intersection-observer';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useRef } from 'react';
import { useTheme } from '@/components/providers/ThemeProvider';

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
        <section ref={ref} style={{
            padding: '60px 0',
            overflow: 'hidden',
            position: 'relative',
            backgroundColor: style.bg_color || 'transparent',
            borderRadius: style.border_radius || '0px'
        }}>
            <motion.div
                initial={{ opacity: 0, y: 40 }}
                animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 40 }}
                transition={{ duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }}
                style={{ marginBottom: '48px', textAlign: 'center', padding: '0 20px' }}
            >
                <h2 style={{
                    fontFamily: 'var(--font-heading)',
                    fontWeight: 600,
                    fontSize: 'clamp(28px, 5vw, 40px)',
                    color: style.text_color || 'var(--primary)',
                    margin: 0
                }}>
                    {content['social_proof_title'] || content['social_title'] || 'Наші клієнти діляться своїми відгуками'}
                </h2>
                <p style={{ color: style.text_color || '#666', fontSize: '18px', marginTop: '16px', opacity: style.text_color ? 1 : 0.8 }}>
                    {content['social_proof_subtitle'] || content['social_subtitle'] || content['social_handle'] || ''}
                </p>
                {content['social_proof_handle'] && (
                    <div style={{ marginTop: '12px', fontWeight: 700, color: 'var(--primary)' }}>
                        {content['social_proof_handle']}
                    </div>
                )}
            </motion.div>

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
        </section>
    );
}
