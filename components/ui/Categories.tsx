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
        <section ref={ref} className={`section-padding ${style.bg_color ? '' : 'bg-premium-subtle'} overflow-hidden`}>
            <div className="container relative">
                <div className={`grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-24 items-center ${isAlt ? 'lg:flex-row-reverse' : ''}`}>

                    {/* Content Column */}
                    <motion.div
                        initial={{ opacity: 0, x: isAlt ? 40 : -40 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.8, ease: [0.25, 0.46, 0.45, 0.94] }}
                        className={`flex flex-col justify-center ${isAlt ? 'lg:order-2' : 'lg:order-1'}`}
                    >
                        <div className="inline-block px-4 py-2 bg-primary/5 rounded-full mb-8 self-start">
                            <span className="text-[11px] font-black uppercase tracking-[0.4em] text-primary/50">Формат</span>
                        </div>

                        <h2 className="text-[40px] lg:text-[56px] font-black leading-[1.05] tracking-tight mb-8 text-primary">
                            {title}
                        </h2>

                        <p className="text-[18px] opacity-70 mb-12 font-body leading-relaxed max-w-md">
                            {subtitle}
                        </p>

                        <a href={`/catalog?category=${slug}`} className="btn-secondary w-fit group">
                            Обрати формат
                            <span className="transition-transform duration-300 group-hover:translate-x-1 ml-2">→</span>
                        </a>
                    </motion.div>

                    {/* Media Column */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        whileInView={{ opacity: 1, scale: 1 }}
                        viewport={{ once: true }}
                        transition={{ duration: 1, ease: [0.25, 0.46, 0.45, 0.94] }}
                        className={`relative w-full aspect-[4/5] rounded-[3px] overflow-hidden shadow-[var(--shadow-premium)] ${isAlt ? 'lg:order-1' : 'lg:order-2'}`}
                    >
                        {embed ? (
                            <div
                                dangerouslySetInnerHTML={{ __html: embed }}
                                className="w-full h-full"
                            />
                        ) : image ? (
                            <img
                                src={image}
                                alt={title}
                                className="w-full h-full object-cover transition-transform duration-700 hover:scale-105"
                            />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center bg-gray-100 text-gray-400">
                                <span className="text-sm font-medium tracking-widest uppercase">Placeholder Image</span>
                            </div>
                        )}
                    </motion.div>
                </div>
            </div>
        </section>
    );
}
