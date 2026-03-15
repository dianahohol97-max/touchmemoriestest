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
        <section ref={ref} className="section-padding bg-white overflow-hidden">
            <div className="container relative">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">

                    {/* Content Column */}
                    <motion.div
                        initial={{ opacity: 0, x: -40 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.8, ease: [0.25, 0.46, 0.45, 0.94] }}
                        className="lg:col-span-5 flex flex-col justify-center"
                    >
                        <div className="inline-block px-4 py-2 bg-primary/5 rounded-full mb-8 self-start">
                            <span className="text-[11px] font-black uppercase tracking-[0.4em] text-primary/50">Фотодрук</span>
                        </div>

                        <h2 className="text-[40px] lg:text-[56px] font-black leading-[1.05] tracking-tight mb-8 text-primary">
                            {content['photoprint_title'] || 'Оживіть свої фотографії'}
                        </h2>

                        <p className="text-[18px] opacity-70 mb-12 font-body leading-relaxed max-w-md">
                            {content['photoprint_subtitle'] || 'Збережіть улюблені моменти не лише в пам’яті, а й на якісному фотопапері.'}
                        </p>

                        <Link
                            href={content['photoprint_button_url'] || "/catalog?category=photo-print"}
                            className="btn-primary w-fit group"
                        >
                            {content['photoprint_button_text'] || 'Замовити друк'}
                            <ArrowRight size={20} className="ml-2 transition-transform duration-300 group-hover:translate-x-1" />
                        </Link>
                    </motion.div>

                    {/* Media Column */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        whileInView={{ opacity: 1, scale: 1 }}
                        viewport={{ once: true }}
                        transition={{ duration: 1, ease: [0.25, 0.46, 0.45, 0.94] }}
                        className="lg:col-span-7 relative w-full aspect-[4/3] lg:aspect-[16/10] rounded-[3px] overflow-hidden shadow-[var(--shadow-premium)]"
                    >
                        {embed ? (
                            <div
                                dangerouslySetInnerHTML={{ __html: embed }}
                                className="w-full h-full object-cover"
                            />
                        ) : (
                            <img
                                src="https://images.unsplash.com/photo-1541996271295-8eaf5d8f61ce?w=1200"
                                alt="Photo Print"
                                className="w-full h-full object-cover transition-transform duration-700 hover:scale-105"
                            />
                        )}
                        {/* Decorative Gradient Overlay */}
                        <div className="absolute inset-0 bg-gradient-to-tr from-black/10 to-transparent mix-blend-overlay pointer-events-none" />
                    </motion.div>

                </div>
            </div>
        </section>
    );
}
