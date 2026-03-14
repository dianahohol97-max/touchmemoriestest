'use client';
import { motion } from 'framer-motion';
import styles from './PhotoPrintPromo.module.css';
import { useInView } from 'react-intersection-observer';
import Link from 'next/link';
import { ArrowRight, Image as ImageIcon } from 'lucide-react';
import { useTheme } from '@/components/providers/ThemeProvider';

export function PhotoPrintPromo() {
    const { content, blocks } = useTheme();
    const block = blocks.find(b => b.block_name === 'photo_print');
    const style = block?.style_metadata || {};

    const { ref, inView } = useInView({
        triggerOnce: true,
        threshold: 0.2,
    });

    const embed = content['photoprint_embed'];

    return (
        <section ref={ref} style={{ padding: '40px 0', position: 'relative', overflow: 'hidden' }}>
            <div className="container" style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    animate={inView ? { opacity: 1, y: 0 } : {}}
                    transition={{ duration: 0.6 }}
                    style={{
                        backgroundColor: style.card_bg || 'white',
                        borderRadius: style.border_radius || '32px',
                        padding: '60px 40px',
                        width: '100%',
                        boxShadow: '0 20px 40px rgba(0,0,0,0.05)',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        textAlign: 'center',
                        color: style.text_color || 'inherit'
                    }}
                >
                    {embed ? (
                        <div
                            dangerouslySetInnerHTML={{ __html: embed }}
                            style={{ width: '100%', marginBottom: '32px', display: 'flex', justifyContent: 'center' }}
                            className={styles.embedContainer}
                        />
                    ) : (
                        <div style={{
                            width: '80px',
                            height: '80px',
                            backgroundColor: 'rgba(0,0,0,0.03)',
                            borderRadius: '20px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            marginBottom: '24px'
                        }}>
                            <ImageIcon size={40} opacity={0.5} />
                        </div>
                    )}

                    <h2 style={{
                        fontFamily: 'var(--font-heading)',
                        fontSize: 'min(40px, 10vw)',
                        fontWeight: 900,
                        color: 'var(--section-heading-color)',
                        marginBottom: '16px'
                    }}>
                        {content['photoprint_title'] || 'Замовити фотодрук'}
                    </h2>

                    <p style={{
                        fontSize: '18px',
                        opacity: 0.8,
                        maxWidth: '600px',
                        marginBottom: '40px',
                        lineHeight: 1.6
                    }}>
                        {content['photoprint_subtitle'] || 'Збережіть улюблені моменти не лише в пам’яті, а й на папері.'}
                    </p>

                    <Link
                        href={content['photoprint_button_url'] || "/catalog?category=photo-print"}
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '12px',
                            padding: '18px 40px',
                            backgroundColor: 'var(--section-button-bg)',
                            color: 'var(--section-button-text)',
                            fontSize: '18px',
                            fontWeight: 700,
                            borderRadius: 'var(--button-radius)',
                            textDecoration: 'none',
                            transition: 'transform 0.2s',
                            boxShadow: 'var(--button-shadow)'
                        }}
                        className="hover-lift"
                    >
                        {content['photoprint_button_text'] || 'Замовити'}
                        <ArrowRight size={20} />
                    </Link>
                </motion.div>
            </div>
        </section>
    );
}
