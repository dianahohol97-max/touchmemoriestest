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
        <section ref={ref} className={`section-padding ${style.bg_color ? '' : 'bg-primary'} text-white overflow-hidden relative rounded-[3px]`}>
            {/* Decorative Background Patterns */}
            <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:40px_40px] opacity-20 pointer-events-none" />
            <div className="absolute -top-64 -right-64 w-[800px] h-[800px] bg-white/5 rounded-full blur-[100px] pointer-events-none" />

            <div className="container relative z-10 text-center max-w-4xl mx-auto py-12 lg:py-24">
                {embed && (
                    <div
                        dangerouslySetInnerHTML={{ __html: embed }}
                        className="w-full mb-12 flex justify-center"
                    />
                )}

                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.8, ease: [0.25, 0.46, 0.45, 0.94] }}
                >
                    <div className="inline-block px-4 py-2 bg-white/10 rounded-full mb-10 w-fit backdrop-blur-md border border-white/10 mx-auto">
                        <span className="text-[11px] font-black uppercase tracking-[0.4em] text-white/80">Почніть зараз</span>
                    </div>

                    <h2 className="text-[48px] lg:text-[72px] font-black leading-[1.0] tracking-tight mb-8">
                        {content['final_cta_title'] || content['cta_title'] || 'Save Memories'}
                    </h2>

                    <p className="text-[20px] lg:text-[24px] opacity-80 mb-16 font-body leading-relaxed max-w-2xl mx-auto">
                        {content['final_cta_subtitle'] || content['cta_subtitle'] || 'Почніть створювати свою першу фотокнигу вже сьогодні. Це займає лише кілька хвилин.'}
                    </p>

                    <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
                        <Link
                            href={content['final_cta_url'] || "/book-constructor"}
                            className="bg-white text-primary px-10 py-5 rounded-[3px] font-bold text-lg hover:-translate-y-1 transition-transform duration-300 shadow-xl w-full sm:w-auto text-center"
                        >
                            {content['final_cta_button'] || content['cta_button_text'] || 'Створити зараз'}
                        </Link>
                        <Link
                            href="/catalog"
                            className="bg-transparent border-2 border-white/30 text-white px-10 py-5 rounded-[3px] font-bold text-lg hover:border-white hover:bg-white/5 transition-all duration-300 w-full sm:w-auto text-center"
                        >
                            Каталог товарів
                        </Link>
                    </div>
                </motion.div>
            </div>
        </section>
    );
}
