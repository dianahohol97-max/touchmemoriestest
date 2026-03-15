'use client';
import { motion } from 'framer-motion';
import styles from './FinalCTA.module.css';
import { useInView } from 'react-intersection-observer';
import Link from 'next/link';
import { useTheme } from '@/components/providers/ThemeProvider';

export function FinalCTA() {
    const { ref, inView } = useInView({ triggerOnce: true, threshold: 0.1 });
    const { content, blocks } = useTheme();
    const block = blocks.find(b => b.block_name === 'final_cta');
    const style = block?.style_metadata || {};

    const embed = content['final_cta_embed'];

    return (
        <section ref={ref} style={{
            padding: '40px 20px',
            backgroundColor: style.bg_color || 'var(--color-primary)',
            color: style.text_color || 'white',
            overflow: 'hidden',
            position: 'relative',
            borderRadius: style.border_radius || '0px'
        }}>
            <div style={{ maxWidth: '800px', margin: '0 auto', textAlign: 'center', position: 'relative', zIndex: 10 }}>
                {embed && (
                    <div
                        dangerouslySetInnerHTML={{ __html: embed }}
                        style={{ width: '100%', marginBottom: '32px', display: 'flex', justifyContent: 'center' }}
                        className={styles.embedContainer}
                    />
                )}

                <motion.h2
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={inView ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.8, ease: [0.25, 0.46, 0.45, 0.94] }}
                    style={{
                        fontFamily: 'var(--font-heading)',
                        fontSize: 'clamp(32px, 6vw, 56px)',
                        fontWeight: 900,
                        marginBottom: '24px',
                        lineHeight: 1.1,
                        color: 'var(--section-heading-color)'
                    }}
                >
                    {content['final_cta_title'] || content['cta_title'] || 'Save Memories'}
                </motion.h2>

                <motion.p
                    initial={{ opacity: 0, y: 20 }}
                    animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
                    transition={{ duration: 0.6, delay: 0.2 }}
                    style={{
                        fontSize: '20px',
                        opacity: 0.8,
                        marginBottom: '48px',
                        maxWidth: '600px',
                        margin: '0 auto 48px',
                        color: 'inherit'
                    }}
                >
                    {content['final_cta_subtitle'] || content['cta_subtitle'] || 'Почніть створювати свою першу фотокнигу вже сьогодні.'}
                </motion.p>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
                    transition={{ duration: 0.6, delay: 0.4 }}
                    style={{ display: 'flex', flexWrap: 'wrap', gap: '20px', justifyContent: 'center' }}
                >
                    <Link href={content['final_cta_url'] || "/book-constructor"} style={{
                        height: '60px',
                        padding: '0 40px',
                        backgroundColor: 'var(--section-button-bg)',
                        color: 'var(--section-button-text)',
                        fontWeight: 700,
                        fontSize: '18px',
                        borderRadius: '3px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        textDecoration: 'none',
                        boxShadow: 'var(--button-shadow)'
                    }} className="hover-lift">
                        {content['final_cta_button'] || content['cta_button_text'] || 'Створити зараз'}
                    </Link>
                    <Link href="/catalog" style={{
                        height: '60px',
                        padding: '0 40px',
                        backgroundColor: 'transparent',
                        color: 'inherit',
                        fontWeight: 700,
                        fontSize: '18px',
                        borderRadius: '3px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        textDecoration: 'none',
                        border: '2px solid currentColor',
                        opacity: 0.7
                    }} className="hover-lift">
                        Каталог
                    </Link>
                </motion.div>
            </div>
        </section>
    );
}
