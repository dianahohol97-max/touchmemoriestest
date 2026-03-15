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
                <h2 className="text-[32px] lg:text-[44px] font-extrabold leading-[1.1] tracking-tight mb-8 text-primary">
                    {title}
                </h2>
                <p className="text-[16px] lg:text-[18px] opacity-70 max-w-sm mb-12 font-body leading-relaxed">
                    {subtitle}
                </p>
                <a href={`/catalog?category=${slug}`} className="font-heading font-black text-xs uppercase tracking-[0.25em] text-primary flex items-center gap-3 no-underline group">
                    Обрати формат
                    <span className="transition-transform duration-300 group-hover:translate-x-2">→</span>
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
