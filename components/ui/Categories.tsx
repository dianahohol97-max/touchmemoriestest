'use client';
import { motion } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import { useTheme } from '@/components/providers/ThemeProvider';

export function Categories() {
    const { content, blocks } = useTheme();
    const block = blocks.find(b => b.block_name === 'categories');
    const style = block?.style_metadata || {};

    const { ref, inView } = useInView({
        triggerOnce: true,
        threshold: 0.1,
    });

    return (
        <section ref={ref} style={{
            width: '100%',
            display: 'flex',
            flexDirection: 'row',
            flexWrap: 'wrap',
            marginBottom: '40px',
            borderRadius: style.border_radius || '0px',
            overflow: 'hidden'
        }}>
            {/* Left Column */}
            <motion.div
                initial={{ opacity: 0, y: 40 }}
                animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 40 }}
                transition={{ duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }}
                style={{
                    width: '100%',
                    maxWidth: '50%',
                    backgroundColor: style.bg_color || 'var(--primary)',
                    color: style.text_color || 'white',
                    display: 'flex',
                    flexDirection: 'column'
                }}
                className="category-col"
            >
                <div style={{ padding: '80px', display: 'flex', flexDirection: 'column', justifyContent: 'center', flexGrow: 1 }}>
                    <h2 style={{
                        fontFamily: 'var(--font-heading)',
                        fontWeight: 900,
                        fontSize: 'clamp(40px, 6vw, 64px)',
                        lineHeight: 1.1,
                        marginBottom: '24px',
                        margin: 0,
                        color: style.text_color || 'white'
                    }}>
                        {content['categories_title'] || 'Фотокниги'}
                    </h2>
                    <p style={{ fontSize: '16px', opacity: style.text_color ? 1 : 0.8, maxWidth: '400px', marginBottom: '40px', minHeight: '48px', display: 'flex', alignItems: 'flex-start', color: style.text_color || 'white' }}>
                        {content['categories_subtitle'] || 'Класний формат для найважливіших подій'}
                    </p>
                    <a href={`/catalog?category=${content['categories_left_slug'] || 'photobooks'}`} style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: '15px', color: style.text_color || 'white', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        Обрати формат →
                    </a>
                </div>
                <div style={{ width: '100%', height: '50vh', position: 'relative', background: '#1e2e7a', padding: content['categories_left_image'] ? 0 : '32px', paddingBottom: 0, display: 'flex', alignItems: 'end', justifyContent: 'center', overflow: 'hidden' }}>
                    {content['categories_left_image'] ? (
                        <img
                            src={content['categories_left_image']}
                            alt={content['categories_title']}
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                    ) : (
                        /* Editor Preview Sketch */
                        <div style={{ width: '90%', height: '90%', background: '#0f1740', borderRadius: '8px 8px 0 0', display: 'flex', flexDirection: 'column', border: '1px solid rgba(255,255,255,0.1)', overflow: 'hidden' }}>
                            <div style={{ height: '40px', borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', paddingInline: '16px', justifyContent: 'space-between', background: '#151f52', padding: '0 15px' }}>
                                <div style={{ display: 'flex', gap: '6px' }}>
                                    <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#ff5f56' }}></div>
                                    <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#ffbd2e' }}></div>
                                    <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#27c93f' }}></div>
                                </div>
                            </div>
                            <div style={{ flex: 1, display: 'flex' }}>
                                <div style={{ width: '80px', borderRight: '1px solid rgba(255,255,255,0.1)', padding: '12px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                    <div style={{ width: '100%', aspectRatio: '1/1', background: 'rgba(255,255,255,0.05)', borderRadius: '2px' }}></div>
                                    <div style={{ width: '100%', aspectRatio: '1/1', background: 'rgba(255,255,255,0.05)', borderRadius: '2px' }}></div>
                                </div>
                                <div style={{ flex: 1, background: '#0a102e', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
                                    <div style={{ display: 'flex', boxShadow: '0 20px 50px rgba(0,0,0,0.5)' }}>
                                        <div style={{ width: '120px', height: '120px', background: 'white', padding: '8px' }}>
                                            <div style={{ width: '100%', height: '100%', border: '1px dashed #ccc' }}></div>
                                        </div>
                                        <div style={{ width: '120px', height: '120px', background: 'white', padding: '8px', borderLeft: '1px solid #eee' }}>
                                            <div style={{ width: '100%', height: '100%', background: '#f5f5f5' }}></div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </motion.div>

            {/* Right Column */}
            <motion.div
                initial={{ opacity: 0, y: 40 }}
                animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 40 }}
                transition={{ duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94], delay: 0.1 }}
                style={{
                    width: '100%',
                    maxWidth: '50%',
                    backgroundColor: style.bg_color_alt || '#f9fafb',
                    color: style.text_color_alt || 'var(--primary)',
                    display: 'flex',
                    flexDirection: 'column'
                }}
                className="category-col"
            >
                <div style={{ padding: '80px', display: 'flex', flexDirection: 'column', justifyContent: 'center', flexGrow: 1 }}>
                    <h2 style={{
                        fontFamily: 'var(--font-heading)',
                        fontWeight: 900,
                        fontSize: 'clamp(32px, 5vw, 52px)',
                        lineHeight: 1.1,
                        marginBottom: '24px',
                        margin: 0,
                        color: style.text_color_alt || 'var(--primary)'
                    }}>
                        {content['categories_alt_title'] || 'Глянцеві журнали'}
                    </h2>
                    <p style={{ fontSize: '16px', opacity: style.text_color_alt ? 1 : 0.8, maxWidth: '400px', marginBottom: '40px', minHeight: '48px', display: 'flex', alignItems: 'flex-start', color: style.text_color_alt || 'inherit' }}>
                        {content['categories_alt_subtitle'] || 'Стильний формат для ваших подорожей'}
                    </p>
                    <a href={`/catalog?category=${content['categories_right_slug'] || 'magazines'}`} style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: '15px', color: style.text_color_alt || 'var(--primary)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        Дізнатись більше →
                    </a>
                </div>
                <div style={{ width: '100%', height: '50vh', position: 'relative', background: '#eee', padding: content['categories_right_image'] ? 0 : '32px', paddingBottom: 0, display: 'flex', alignItems: 'end', justifyContent: 'center', overflow: 'hidden' }}>
                    {content['categories_right_image'] ? (
                        <img
                            src={content['categories_right_image']}
                            alt={content['categories_alt_title']}
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                    ) : (
                        <div style={{ width: '90%', height: '90%', background: 'white', borderRadius: '8px 8px 0 0', display: 'flex', flexDirection: 'column', border: '1px solid #ddd', overflow: 'hidden' }}>
                            <div style={{ height: '40px', borderBottom: '1px solid #eee', display: 'flex', alignItems: 'center', paddingInline: '16px', justifyContent: 'space-between', background: '#f9f9f9', padding: '0 15px' }}>
                                <div style={{ display: 'flex', gap: '6px' }}>
                                    <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#ff5f56' }}></div>
                                    <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#ffbd2e' }}></div>
                                    <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#27c93f' }}></div>
                                </div>
                            </div>
                            <div style={{ flex: 1, display: 'flex' }}>
                                <div style={{ width: '80px', borderRight: '1px solid #eee', padding: '12px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                    <div style={{ width: '100%', aspectRatio: '1/1', background: '#f5f5f5', borderRadius: '2px' }}></div>
                                    <div style={{ width: '100%', aspectRatio: '1/1', background: '#f5f5f5', borderRadius: '2px' }}></div>
                                </div>
                                <div style={{ flex: 1, background: '#f9f9f9', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
                                    <div style={{ display: 'flex', boxShadow: '0 10px 30px rgba(0,0,0,0.1)' }}>
                                        <div style={{ width: '90px', height: '126px', background: 'white', padding: '8px' }}>
                                            <div style={{ width: '100%', height: '60%', background: '#eee', marginBottom: '8px' }}></div>
                                            <div style={{ width: '80%', height: '4px', background: '#eee', marginBottom: '4px' }}></div>
                                            <div style={{ width: '60%', height: '4px', background: '#eee' }}></div>
                                        </div>
                                        <div style={{ width: '90px', height: '126px', background: 'white', padding: '8px', borderLeft: '1px solid #eee' }}>
                                            <div style={{ width: '100%', height: '100%', border: '1px dashed #ccc' }}></div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </motion.div>
            <style jsx>{`
        .categories-section {
            flex-direction: row; /* Default for desktop */
        }
        @media (max-width: 768px) {
          .categories-section {
            flex-direction: column; /* Stack vertically on mobile */
          }
          .category-col { max-width: 100% !important; }
        }
      `}</style>
        </section>
    );
}
