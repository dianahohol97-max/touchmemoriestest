'use client';
import { motion } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import Link from 'next/link';
import { useTheme } from '@/components/providers/ThemeProvider';

export function FinalCTA() {
    const { ref, inView } = useInView({ triggerOnce: true, threshold: 0.1 });
    const { content, blocks } = useTheme();
    const block = blocks.find(b => b.block_name === 'final_cta');
    const style = block?.style_metadata || {};

    return (
        <section ref={ref} style={{
            padding: '60px 20px',
            backgroundColor: style.bg_color || 'var(--primary)',
            color: style.text_color || 'white',
            overflow: 'hidden',
            position: 'relative',
            borderRadius: style.border_radius || '0px'
        }}>
            <div style={{ position: 'absolute', inset: 0, opacity: 0.1 }}>
                <div style={{ position: 'absolute', top: '-10%', right: '-10%', width: '40%', height: '80%', borderRadius: '50%', border: '2px solid white' }}></div>
                <div style={{ position: 'absolute', bottom: '-20%', left: '-5%', width: '30%', height: '60%', borderRadius: '50%', border: '2px solid white' }}></div>
            </div>

            <div style={{ maxWidth: '800px', margin: '0 auto', textAlign: 'center', position: 'relative', zIndex: 10 }}>
                <motion.h2
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={inView ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.8, ease: [0.25, 0.46, 0.45, 0.94] }}
                    style={{ fontFamily: 'var(--font-heading)', fontSize: 'clamp(36px, 6vw, 56px)', fontWeight: 900, marginBottom: '24px', lineHeight: 1.1, color: style.text_color || 'white' }}
                >
                    {content['final_cta_title'] || content['cta_title'] || 'Готові зберегти свої спогади?'}
                </motion.h2>
                <motion.p
                    initial={{ opacity: 0, y: 20 }}
                    animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
                    transition={{ duration: 0.6, delay: 0.2 }}
                    style={{ fontSize: '20px', opacity: style.text_color ? 1 : 0.9, marginBottom: '48px', maxWidth: '600px', margin: '0 auto 48px', color: style.text_color || 'white' }}
                >
                    {content['final_cta_subtitle'] || content['cta_subtitle'] || 'Почніть створювати свою першу фотокнигу вже сьогодні. Це простіше, ніж здається.'}
                </motion.p>
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
                    transition={{ duration: 0.6, delay: 0.4 }}
                    style={{ display: 'flex', flexWrap: 'wrap', gap: '20px', justifyContent: 'center' }}
                >
                    <Link href={content['final_cta_url'] || "/constructor"} style={{
                        height: '64px',
                        padding: '0 40px',
                        backgroundColor: 'white',
                        color: 'var(--primary)',
                        fontWeight: 700,
                        fontSize: '18px',
                        borderRadius: '16px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        textDecoration: 'none',
                        boxShadow: '0 10px 30px rgba(0,0,0,0.1)'
                    }} className="hover-lift">
                        {content['final_cta_button'] || content['cta_button_text'] || 'Створити зараз'}
                    </Link>
                    <Link href="/catalog" style={{
                        height: '64px',
                        padding: '0 40px',
                        backgroundColor: 'transparent',
                        color: 'white',
                        fontWeight: 700,
                        fontSize: '18px',
                        borderRadius: '16px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        textDecoration: 'none',
                        border: '2px solid rgba(255,255,255,0.4)'
                    }} className="hover-glow">
                        Переглянути каталог
                    </Link>
                </motion.div>
            </div>
        </section>
    );
}
