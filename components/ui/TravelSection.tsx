'use client';
import { motion } from 'framer-motion';
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
    const { content } = useTheme();
    const { ref, inView } = useInView({
        triggerOnce: true,
        threshold: 0.1,
    });

    return (
        <section ref={ref} style={{ padding: '60px 0', backgroundColor: '#f8f9fa' }}>
            <div className="container">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={inView ? { opacity: 1, y: 0 } : {}}
                    transition={{ duration: 0.6 }}
                    style={{ textAlign: 'center', marginBottom: '60px' }}
                >
                    <h2 className="travel-title" style={{
                        fontFamily: 'var(--font-heading)',
                        fontSize: '48px',
                        fontWeight: 900,
                        marginBottom: '16px'
                    }}>
                        {content['travel_title'] || 'Travel Book'}
                    </h2>
                    <p className="travel-subtitle" style={{ fontSize: '18px', color: '#666', maxWidth: '600px', margin: '0 auto' }}>
                        {content['travel_subtitle'] || 'Збережіть ваші подорожі у преміальному Travel Book'}
                    </p>
                </motion.div>

                <div className="travel-grid">
                    {/* Left Column - Featured Travel Article & Locations */}
                    <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        animate={inView ? { opacity: 1, x: 0 } : {}}
                        transition={{ duration: 0.6, delay: 0.2 }}
                        className="travel-column travel-left"
                    >
                        {/* Top Locations Block */}
                        <div className="travel-card locations-card">
                            <MapPin size={48} color="#ccc" style={{ marginBottom: '16px' }} />
                            <h3 style={{
                                fontFamily: 'var(--font-heading)',
                                fontSize: '24px',
                                fontWeight: 700,
                                marginBottom: '12px',
                                color: '#333'
                            }}>
                                {content['travel_locations_title'] || 'Top Locations'}
                            </h3>
                            <p style={{ color: '#666', maxWidth: '300px', margin: '0 auto', lineHeight: 1.5 }}>
                                {content['travel_locations_desc'] || 'Найкращі локації для ваших подорожей та фотосесій'}
                            </p>
                        </div>

                        {/* Travel Article Block */}
                        {travelPost ? (
                            <Link
                                href={`/blog/${travelPost.slug}`}
                                className="travel-card article-card hover-lift"
                            >
                                {/* Cover Image */}
                                <div style={{
                                    position: 'relative',
                                    width: '100%',
                                    height: '300px',
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
                                            <MapPin size={48} color="#999" />
                                        </div>
                                    )}
                                    <div style={{
                                        position: 'absolute',
                                        top: '16px',
                                        left: '16px',
                                        backgroundColor: 'var(--primary)',
                                        color: 'white',
                                        padding: '6px 12px',
                                        borderRadius: '6px',
                                        fontSize: '12px',
                                        fontWeight: 600,
                                        textTransform: 'uppercase'
                                    }}>
                                        {travelPost.category?.name || 'Travel'}
                                    </div>
                                </div>

                                {/* Content */}
                                <div style={{ padding: '24px' }}>
                                    <h3 style={{
                                        fontFamily: 'var(--font-heading)',
                                        fontSize: '24px',
                                        fontWeight: 700,
                                        marginBottom: '12px',
                                        lineHeight: 1.3
                                    }}>
                                        {travelPost.title}
                                    </h3>
                                    <p style={{
                                        color: '#666',
                                        lineHeight: 1.6,
                                        marginBottom: '16px'
                                    }}>
                                        {travelPost.excerpt}
                                    </p>
                                    <div style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '16px',
                                        fontSize: '14px',
                                        color: '#999'
                                    }}>
                                        <span>{travelPost.reading_time} хв читання</span>
                                        <span style={{
                                            color: 'var(--primary)',
                                            fontWeight: 600,
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '4px'
                                        }}>
                                            Читати далі <ArrowRight size={16} />
                                        </span>
                                    </div>
                                </div>
                            </Link>
                        ) : (
                            <div className="travel-card article-card placeholder">
                                <MapPin size={48} color="#ccc" style={{ marginBottom: '16px' }} />
                                <h3 style={{
                                    fontFamily: 'var(--font-heading)',
                                    fontSize: '20px',
                                    fontWeight: 700,
                                    marginBottom: '8px',
                                    color: '#999'
                                }}>
                                    Travel Articles
                                </h3>
                                <p style={{ color: '#999' }}>
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
                        className="travel-column travel-right cta-card"
                    >
                        <h3 style={{
                            fontFamily: 'var(--font-heading)',
                            fontSize: '32px',
                            fontWeight: 900,
                            marginBottom: '24px'
                        }}>
                            Замовити Travel Book
                        </h3>

                        {/* Visual Mockup */}
                        <div style={{
                            position: 'relative',
                            width: '100%',
                            maxWidth: '400px',
                            height: '300px',
                            marginBottom: '32px',
                            backgroundColor: '#f0f0f0',
                            borderRadius: '12px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            overflow: 'hidden'
                        }}>
                            {/* Placeholder mockup - you can replace with actual image */}
                            <div style={{
                                width: '70%',
                                height: '85%',
                                backgroundColor: 'white',
                                borderRadius: '8px',
                                boxShadow: '0 8px 30px rgba(0,0,0,0.2)',
                                transform: 'perspective(600px) rotateY(-15deg)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexDirection: 'column',
                                gap: '12px',
                                padding: '20px'
                            }}>
                                <MapPin size={48} color="var(--primary)" />
                                <div style={{
                                    width: '80%',
                                    height: '8px',
                                    backgroundColor: '#e0e0e0',
                                    borderRadius: '4px'
                                }}></div>
                                <div style={{
                                    width: '60%',
                                    height: '8px',
                                    backgroundColor: '#e0e0e0',
                                    borderRadius: '4px'
                                }}></div>
                            </div>
                        </div>

                        <p style={{
                            fontSize: '16px',
                            color: '#666',
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
                                backgroundColor: 'var(--primary)',
                                color: 'white',
                                fontSize: '18px',
                                fontWeight: 700,
                                borderRadius: '12px',
                                textDecoration: 'none',
                                transition: 'transform 0.2s, box-shadow 0.2s',
                            }}
                            className="hover-lift"
                        >
                            {content['travel_button_text'] || 'Створити Travel Book'}
                            <ArrowRight size={20} />
                        </Link>
                    </motion.div>
                </div>
            </div>

            <style jsx>{`
                .travel-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
                    gap: 40px;
                    align-items: start;
                }
                .travel-column {
                    display: flex;
                    flex-direction: column;
                    gap: 40px;
                    height: 100%;
                }
                .travel-card {
                    background-color: white;
                    border-radius: 16px;
                    padding: 40px;
                    box-shadow: 0 4px 20px rgba(0,0,0,0.08);
                    text-align: center;
                }
                .article-card {
                    padding: 0;
                    overflow: hidden;
                    text-align: left;
                    text-decoration: none;
                    color: inherit;
                }
                .cta-card {
                    background-color: white;
                    border-radius: 16px;
                    padding: 40px;
                    box-shadow: 0 4px 20px rgba(0,0,0,0.08);
                    align-items: center;
                    text-align: center;
                }
                @media (max-width: 768px) {
                    .travel-grid {
                        grid-template-columns: 1fr;
                        gap: 24px;
                        display: flex;
                        flex-direction: column;
                    }
                    .travel-left {
                        order: 2;
                        gap: 24px;
                    }
                    .travel-right {
                        order: 1;
                        padding: 32px 20px;
                    }
                    .locations-card {
                        order: 1;
                        padding: 32px 20px !important;
                    }
                    .article-card {
                        order: 2;
                    }
                    .travel-title {
                        font-size: 32px !important;
                        margin-bottom: 8px !important;
                    }
                    .travel-subtitle {
                        font-size: 16px !important;
                    }
                }
            `}</style>
        </section>
    );
}
