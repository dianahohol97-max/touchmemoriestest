'use client';
import { motion } from 'framer-motion';
import styles from './CustomBookPromo.module.css';
import { useInView } from 'react-intersection-observer';
import Link from 'next/link';
import { BookOpen, Sparkles } from 'lucide-react';
import { useTheme } from '@/components/providers/ThemeProvider';

export function CustomBookPromo() {
    const { content, blocks } = useTheme();
    const block = blocks.find(b => b.block_name === 'custom_book');
    const style = block?.style_metadata || {};

    const { ref, inView } = useInView({
        triggerOnce: true,
        threshold: 0.2,
    });

    const embed = content['custombook_embed'];

    return (
        <section ref={ref} style={{ padding: '40px 0', position: 'relative', overflow: 'hidden' }}>
            <div className="container" style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={inView ? { opacity: 1, scale: 1 } : {}}
                    transition={{ duration: 0.7 }}
                    style={{
                        backgroundColor: style.card_bg || '#263A99',
                        borderRadius: style.border_radius || '32px',
                        padding: '60px 40px',
                        width: '100%',
                        boxShadow: '0 20px 40px rgba(0,0,0,0.1)',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        textAlign: 'center',
                        color: style.text_color || 'white'
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
                            backgroundColor: 'rgba(255,255,255,0.1)',
                            borderRadius: "3px",
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            marginBottom: '24px'
                        }}>
                            <BookOpen size={40} opacity={0.5} />
                        </div>
                    )}

                    <h2 style={{
                        fontFamily: 'var(--font-heading)',
                        fontSize: 'min(40px, 10vw)',
                        fontWeight: 900,
                        color: 'var(--section-heading-color)',
                        marginBottom: '16px'
                    }}>
                        {content['custombook_title'] || 'Order Wishbook'}
                    </h2>

                    <p style={{
                        fontSize: '18px',
                        opacity: 0.8,
                        maxWidth: '600px',
                        marginBottom: '40px',
                        lineHeight: 1.6
                    }}>
                        {content['custombook_subtitle'] || 'Втілюємо найсміливіші ідеї. Індивідуальний дизайн та персональний підхід.'}
                    </p>

                    <Link
                        href={content['custombook_button_url'] || "/catalog"}
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '12px',
                            padding: '18px 40px',
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
                        {content['custombook_button_text'] || 'Замовити'}
                    </Link>
                </motion.div>
            </div>
        </section>
    );
}
