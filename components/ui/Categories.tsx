'use client';
import { motion } from 'framer-motion';
import styles from './Categories.module.css';
import { useInView } from 'react-intersection-observer';
import { useTheme } from '@/components/providers/ThemeProvider';

export function Categories({ blockName = 'categories' }: { blockName?: string }) {
    const { content, blocks } = useTheme();
    const block = blocks.find(b => b.block_name === blockName);
    const style = block?.style_metadata || {};

    const { ref, inView } = useInView({
        triggerOnce: true,
        threshold: 0.1,
    });

    const isAlt = blockName.includes('magazines') || blockName.includes('alt');

    // Content mapping based on block name suffix or default
    const titleKey = `${blockName}_title`;
    const subtitleKey = `${blockName}_subtitle`;
    const slugKey = `${blockName}_slug`;
    const imageKey = `${blockName}_image`;
    const embedKey = `${blockName}_embed`;

    const title = content[titleKey] || (isAlt ? 'Глянцеві журнали' : 'Фотокниги');
    const subtitle = content[subtitleKey] || (isAlt ? 'Стильний формат для ваших подорожей' : 'Класний формат для найважливіших подій');
    const slug = content[slugKey] || (isAlt ? 'magazines' : 'photobooks');
    const image = content[imageKey];
    const embed = content[embedKey];

    return (
        <section ref={ref} style={{
            width: '100%',
            display: 'flex',
            flexDirection: isAlt ? 'row-reverse' : 'row',
            borderRadius: style.border_radius || '0px',
            overflow: 'hidden',
            minHeight: '600px'
        }} className={styles.categorySection}>
            {/* Content Column */}
            <motion.div
                initial={{ opacity: 0, x: isAlt ? 40 : -40 }}
                animate={inView ? { opacity: 1, x: 0 } : { opacity: 0, x: isAlt ? 40 : -40 }}
                transition={{ duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }}
                style={{
                    flex: 1,
                    padding: '80px min(10vw, 100px)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    backgroundColor: style.bg_color || 'transparent',
                    color: style.text_color || 'inherit'
                }}
            >
                <h2 style={{
                    fontFamily: 'var(--font-heading)',
                    fontWeight: 900,
                    fontSize: 'clamp(32px, 5vw, 56px)',
                    lineHeight: 1.1,
                    marginBottom: '24px',
                    color: 'var(--section-heading-color)'
                }}>
                    {title}
                </h2>
                <p style={{
                    fontSize: '18px',
                    opacity: 0.8,
                    maxWidth: '480px',
                    marginBottom: '40px',
                    lineHeight: 1.6
                }}>
                    {subtitle}
                </p>
                <a href={`/catalog?category=${slug}`} style={{
                    fontFamily: 'var(--font-heading)',
                    fontWeight: 700,
                    fontSize: '16px',
                    color: 'inherit',
                    textDecoration: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px'
                }}>
                    Обрати формат
                    <span style={{ transition: 'transform 0.2s' }} className={styles.arrow}>→</span>
                </a>
            </motion.div>

            {/* Media Column */}
            <motion.div
                initial={{ opacity: 0 }}
                animate={inView ? { opacity: 1 } : { opacity: 0 }}
                transition={{ duration: 0.8 }}
                style={{
                    flex: 1,
                    position: 'relative',
                    overflow: 'hidden',
                    background: '#f1f5f9',
                    minHeight: '400px'
                }}
            >
                {embed ? (
                    <div
                        dangerouslySetInnerHTML={{ __html: embed }}
                        style={{ width: '100%', height: '100%', display: 'flex' }}
                        className={styles.embedContainer}
                    />
                ) : image ? (
                    <img
                        src={image}
                        alt={title}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                ) : (
                    /* Placeholder fallback */
                    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#e2e8f0', color: '#94a3b8' }}>
                        No image or embed content
                    </div>
                )}
            </motion.div>

        </section>
    );
}
