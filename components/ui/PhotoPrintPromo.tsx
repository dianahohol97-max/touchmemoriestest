'use client';
import { motion } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import Link from 'next/link';
import { ArrowRight, Image as ImageIcon } from 'lucide-react';
import { useTheme } from '@/components/providers/ThemeProvider';

export function PhotoPrintPromo() {
    const { content } = useTheme();
    const { ref, inView } = useInView({
        triggerOnce: true,
        threshold: 0.2,
    });

    return (
        <section ref={ref} style={{ padding: '80px 0', backgroundColor: '#fdf8f5', position: 'relative', overflow: 'hidden' }}>
            {/* Background elements */}
            <div style={{
                position: 'absolute',
                top: '-10%',
                right: '-5%',
                width: '400px',
                height: '400px',
                borderRadius: '50%',
                background: 'radial-gradient(circle, rgba(251,146,60,0.1) 0%, rgba(255,255,255,0) 70%)',
                zIndex: 0
            }} />

            <div className="container" style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    animate={inView ? { opacity: 1, y: 0 } : {}}
                    transition={{ duration: 0.6 }}
                    style={{
                        backgroundColor: 'white',
                        borderRadius: '24px',
                        padding: '60px 40px',
                        width: '100%',
                        boxShadow: '0 20px 40px rgba(0,0,0,0.05)',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        textAlign: 'center'
                    }}
                >
                    <div style={{
                        width: '80px',
                        height: '80px',
                        backgroundColor: '#fff7ed',
                        borderRadius: '20px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginBottom: '24px'
                    }}>
                        <ImageIcon size={40} color="#fb923c" />
                    </div>

                    <h2 style={{
                        fontFamily: 'var(--font-heading)',
                        fontSize: '40px',
                        fontWeight: 900,
                        color: '#1e293b',
                        marginBottom: '16px'
                    }}>
                        {content['photoprint_title'] || 'Замовити фотодрук'}
                    </h2>

                    <p style={{
                        fontSize: '18px',
                        color: '#475569',
                        maxWidth: '600px',
                        marginBottom: '40px',
                        lineHeight: 1.6
                    }}>
                        {content['photoprint_subtitle'] || 'Збережіть улюблені моменти не лише в пам’яті, а й на папері. Високоякісний друк ваших найкращих фотографій.'}
                    </p>

                    <Link
                        href={content['photoprint_button_url'] || "/catalog?category=photo-print"}
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '12px',
                            padding: '18px 40px',
                            backgroundColor: '#fb923c',
                            color: 'white',
                            fontSize: '18px',
                            fontWeight: 700,
                            borderRadius: '16px',
                            textDecoration: 'none',
                            transition: 'transform 0.2s, box-shadow 0.2s, background-color 0.2s',
                            boxShadow: '0 8px 20px rgba(251,146,60,0.3)'
                        }}
                        className="hover-lift"
                        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f97316')}
                        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#fb923c')}
                    >
                        {content['photoprint_button_text'] || 'Замовити'}
                        <ArrowRight size={20} />
                    </Link>
                </motion.div>
            </div>
        </section>
    );
}
