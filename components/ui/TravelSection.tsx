'use client';
import { motion } from 'framer-motion';
import styles from './TravelSection.module.css';
import { useInView } from 'react-intersection-observer';
import Link from 'next/link';
import Image from 'next/image';
import { MapPin, ArrowRight } from 'lucide-react';
import { useTheme } from '@/components/providers/ThemeProvider';

interface BlogPost {
    id: string;
    title: string;
    slug: string;
    excerpt: string;
    cover_image: string;
    cover_image_alt: string;
    reading_time: number;
    published_at: string;
    category?: {
        name: string;
        slug: string;
    };
}

interface TravelSectionProps {
    travelPost?: BlogPost | null;
}

export function TravelSection({ travelPost }: TravelSectionProps) {
    const { content, blocks } = useTheme();
    const block = blocks.find(b => b.block_name === 'travel');
    const style = block?.style_metadata || {};

    const { ref, inView } = useInView({
        triggerOnce: true,
        threshold: 0.1,
    });

    const embed = content['travel_embed'];

    return (
        <section ref={ref} className="section-padding bg-premium-gradient">
            <div className="container">
                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    animate={inView ? { opacity: 1, y: 0 } : {}}
                    transition={{ duration: 1, ease: [0.23, 1, 0.32, 1] }}
                    className="text-center mb-24"
                >
                    <h2 className="section-title text-center">
                        {content['travel_title'] || 'Travel Book'}
                    </h2>
                    <p className="section-subtitle text-center">
                        {content['travel_subtitle'] || 'Збережіть ваші подорожі у преміальному Travel Book — витворі мистецтва, який приємно тримати в руках'}
                    </p>
                </motion.div>

                <div className={styles.travelGrid} style={{ gap: '32px' }}>
                    {/* Left Column - Featured Travel Article & Locations */}
                    <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        animate={inView ? { opacity: 1, x: 0 } : {}}
                        transition={{ duration: 0.6, delay: 0.2 }}
                        className={`${styles.travelColumn} ${styles.travelLeft}`}
                        style={{ gap: '32px' }}
                    >
                        {/* Top Locations Block */}
                        <div className={`${styles.travelCard} ${styles.locationsCard}`} style={{ padding: '32px' }}>
                            <MapPin size={40} opacity={0.3} style={{ marginBottom: '16px' }} />
                            <h3 style={{
                                fontFamily: 'var(--font-heading)',
                                fontSize: '22px',
                                fontWeight: 700,
                                marginBottom: '12px'
                            }}>
                                {content['travel_locations_title'] || 'Top Locations'}
                            </h3>
                            <p style={{ opacity: 0.7, maxWidth: '300px', margin: '0 auto', lineHeight: 1.5, fontSize: '15px' }}>
                                {content['travel_locations_desc'] || 'Найкращі локації для ваших подорожей та фотосесій'}
                            </p>
                        </div>

                        {/* Travel Article Block */}
                        {travelPost ? (
                            <Link
                                href={`/blog/${travelPost.slug}`}
                                className={`${styles.travelCard} ${styles.articleCard} hover-lift`}
                                style={{ borderRadius: "3px" }}
                            >
                                {/* Cover Image */}
                                <div style={{
                                    position: 'relative',
                                    width: '100%',
                                    height: '240px',
                                    backgroundColor: '#e0e0e0'
                                }}>
                                    {travelPost.cover_image ? (
                                        <Image
                                            src={travelPost.cover_image}
                                            alt={travelPost.cover_image_alt || travelPost.title}
                                            fill
                                            style={{ objectFit: 'cover' }}
                                        />
                                    ) : (
                                        <div style={{
                                            width: '100%',
                                            height: '100%',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            backgroundColor: '#e0e0e0'
                                        }}>
                                            <MapPin size={40} color="#999" />
                                        </div>
                                    )}
                                    <div style={{
                                        position: 'absolute',
                                        top: '16px',
                                        left: '16px',
                                        backgroundColor: 'var(--color-primary)',
                                        color: 'white',
                                        padding: '6px 12px',
                                        borderRadius: "3px",
                                        fontSize: '11px',
                                        fontWeight: 700,
                                        textTransform: 'uppercase'
                                    }}>
                                        {travelPost.category?.name || 'Travel'}
                                    </div>
                                </div>

                                {/* Content */}
                                <div style={{ padding: '24px' }}>
                                    <h3 style={{
                                        fontFamily: 'var(--font-heading)',
                                        fontSize: '22px',
                                        fontWeight: 700,
                                        marginBottom: '10px',
                                        lineHeight: 1.3
                                    }}>
                                        {travelPost.title}
                                    </h3>
                                    <p style={{
                                        opacity: 0.7,
                                        lineHeight: 1.5,
                                        marginBottom: '20px',
                                        fontSize: '15px'
                                    }}>
                                        {travelPost.excerpt}
                                    </p>
                                    <div style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        fontSize: '13px'
                                    }}>
                                        <span style={{ opacity: 0.5 }}>{travelPost.reading_time} хв читання</span>
                                        <span style={{
                                            color: 'var(--color-primary)',
                                            fontWeight: 700,
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '4px'
                                        }}>
                                            Читати <ArrowRight size={14} />
                                        </span>
                                    </div>
                                </div>
                            </Link>
                        ) : (
                            <div className={`${styles.travelCard} ${styles.articleCard} ${styles.placeholder}`} style={{ padding: '32px' }}>
                                <MapPin size={40} opacity={0.2} style={{ marginBottom: '16px' }} />
                                <h3 style={{
                                    fontFamily: 'var(--font-heading)',
                                    fontSize: '20px',
                                    fontWeight: 700,
                                    marginBottom: '8px',
                                    opacity: 0.5
                                }}>
                                    Travel Articles
                                </h3>
                                <p style={{ opacity: 0.5, fontSize: '14px' }}>
                                    Скоро тут з'являться цікаві статті про подорожі
                                </p>
                            </div>
                        )}
                    </motion.div>

                    {/* Right Column - Travel Book CTA */}
                    <motion.div
                        initial={{ opacity: 0, x: 20 }}
                        animate={inView ? { opacity: 1, x: 0 } : {}}
                        transition={{ duration: 0.6, delay: 0.4 }}
                        className={`${styles.travelColumn} ${styles.travelRight} ${styles.ctaCard}`}
                        style={{ padding: '40px', borderRadius: "3px" }}
                    >
                        <h3 style={{
                            fontFamily: 'var(--font-heading)',
                            fontSize: '28px',
                            fontWeight: 900,
                            marginBottom: '24px',
                            color: 'var(--section-heading-color)'
                        }}>
                            Замовити Travel Book
                        </h3>

                        {/* Media Display */}
                        <div style={{
                            position: 'relative',
                            width: '100%',
                            height: '300px',
                            marginBottom: '32px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            overflow: 'hidden'
                        }}>
                            {embed ? (
                                <div
                                    dangerouslySetInnerHTML={{ __html: embed }}
                                    style={{ width: '100%', height: '100%', display: 'flex' }}
                                    className={styles.embedContainer}
                                />
                            ) : (
                                <div style={{
                                    width: '70%',
                                    height: '85%',
                                    backgroundColor: 'white',
                                    borderRadius: "3px",
                                    boxShadow: '0 15px 40px rgba(0,0,0,0.1)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    flexDirection: 'column',
                                    gap: '16px',
                                    padding: '32px',
                                    border: '1px solid rgba(0,0,0,0.05)'
                                }}>
                                    <MapPin size={48} color="var(--color-primary)" opacity={0.5} />
                                    <div style={{ width: '100%', height: '8px', background: '#f1f5f9', borderRadius: "3px" }} />
                                    <div style={{ width: '70%', height: '8px', background: '#f1f5f9', borderRadius: "3px" }} />
                                </div>
                            )}
                        </div>

                        <p style={{
                            fontSize: '16px',
                            opacity: 0.7,
                            marginBottom: '32px',
                            lineHeight: 1.6
                        }}>
                            {content['travel_text'] || 'Створіть унікальну книгу ваших подорожей з фотографіями, нотатками та спогадами'}
                        </p>

                        <Link
                            href="/book-constructor?type=travel"
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '8px',
                                padding: '16px 32px',
                                backgroundColor: 'var(--section-button-bg)',
                                color: 'var(--section-button-text)',
                                fontSize: '18px',
                                fontWeight: 700,
                                borderRadius: "3px",
                                textDecoration: 'none',
                                transition: 'transform 0.2s',
                                boxShadow: 'var(--button-shadow)'
                            }}
                            className="hover-lift"
                        >
                            {content['travel_button_text'] || 'Створити Travel Book'}
                            <ArrowRight size={20} />
                        </Link>
                    </motion.div>
                </div>
            </div>

        </section>
    );
}
