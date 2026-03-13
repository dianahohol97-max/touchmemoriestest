'use client';
import { motion } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import Link from 'next/link';
import { BookOpen, Sparkles } from 'lucide-react';
import { useTheme } from '@/components/providers/ThemeProvider';

export function CustomBookPromo() {
    const { content } = useTheme();
    const { ref, inView } = useInView({
        triggerOnce: true,
        threshold: 0.2,
    });

    return (
        <section ref={ref} style={{ padding: '80px 0', backgroundColor: '#fef2f2', position: 'relative', overflow: 'hidden' }}>
            <div className="container" style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={inView ? { opacity: 1, scale: 1 } : {}}
                    transition={{ duration: 0.7 }}
                    style={{
                        backgroundColor: '#1e293b',
                        borderRadius: '24px',
                        padding: '60px 40px',
                        width: '100%',
                        boxShadow: '0 20px 40px rgba(0,0,0,0.1)',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        textAlign: 'center',
                        position: 'relative',
                        overflow: 'hidden'
                    }}
                >
                    {/* Decorative elements */}
                    <div style={{ position: 'absolute', top: '20px', left: '20px', opacity: 0.2 }}>
                        <Sparkles size={60} color="#f87171" />
                    </div>
                    <div style={{ position: 'absolute', bottom: '20px', right: '20px', opacity: 0.2 }}>
                        <Sparkles size={80} color="#f87171" />
                    </div>

                    <div style={{
                        width: '80px',
                        height: '80px',
                        backgroundColor: 'rgba(255,255,255,0.1)',
                        borderRadius: '20px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginBottom: '24px'
                    }}>
                        <BookOpen size={40} color="#f87171" />
                    </div>

                    <h2 style={{
                        fontFamily: 'var(--font-heading)',
                        fontSize: '40px',
                        fontWeight: 900,
                        color: 'white',
                        marginBottom: '16px'
                    }}>
                        {content['custombook_title'] || 'Замовити книгу за бажанням'}
                    </h2>

                    <p style={{
                        fontSize: '18px',
                        color: '#cbd5e1',
                        maxWidth: '600px',
                        marginBottom: '40px',
                        lineHeight: 1.6
                    }}>
                        {content['custombook_subtitle'] || 'Втілюємо найсміливіші ідеї. Індивідуальний дизайн, унікальні формати та персональний підхід.'}
                    </p>

                    <Link
                        href={content['custombook_button_url'] || "/catalog"}
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '12px',
                            padding: '18px 40px',
                            backgroundColor: '#f87171',
                            color: 'white',
                            fontSize: '18px',
                            fontWeight: 700,
                            borderRadius: '16px',
                            textDecoration: 'none',
                            transition: 'transform 0.2s, box-shadow 0.2s, background-color 0.2s',
                            boxShadow: '0 8px 20px rgba(248,113,113,0.3)'
                        }}
                        className="hover-lift"
                        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#ef4444')}
                        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#f87171')}
                    >
                        {content['custombook_button_text'] || 'Замовити'}
                    </Link>
                </motion.div>
            </div>
        </section>
    );
}
