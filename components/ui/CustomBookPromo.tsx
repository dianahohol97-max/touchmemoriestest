'use client';
import { motion } from 'framer-motion';
import styles from './CustomBookPromo.module.css';
import { useInView } from 'react-intersection-observer';
import Link from 'next/link';
import { BookOpen, Sparkles, ArrowRight } from 'lucide-react';
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
        <section ref={ref} className="section-padding bg-white pb-32">
            <div className="container relative">
                <motion.div
                    initial={{ opacity: 0, y: 40 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.8, ease: [0.25, 0.46, 0.45, 0.94] }}
                    className="relative overflow-hidden rounded-[3px] shadow-[var(--shadow-premium)] bg-slate-900 text-white"
                >
                    {/* Decorative Background Elements */}
                    <div className="absolute top-0 right-0 w-2/3 h-full bg-gradient-to-l from-white/10 to-transparent pointer-events-none" />
                    <div className="absolute -bottom-32 -left-32 w-96 h-96 bg-primary/20 rounded-full blur-3xl pointer-events-none" />

                    <div className="grid grid-cols-1 lg:grid-cols-2 relative z-10">
                        {/* Content Side */}
                        <div className="p-12 lg:p-20 flex flex-col justify-center">
                            <div className="inline-block px-4 py-2 bg-white/10 rounded-full mb-10 w-fit backdrop-blur-md border border-white/10">
                                <span className="text-[11px] font-black uppercase tracking-[0.4em] text-white/80">Індивідуальний дизайн</span>
                            </div>

                            <h2 className="text-[40px] lg:text-[56px] font-black leading-[1.05] tracking-tight mb-8">
                                {content['custombook_title'] || 'Створимо книгу за вас'}
                            </h2>

                            <p className="text-[18px] opacity-80 mb-12 font-body leading-relaxed max-w-md">
                                {content['custombook_subtitle'] || 'Втілюємо найсміливіші ідеї. Персональний дизайн від професіоналів без зайвих зусиль з вашого боку.'}
                            </p>

                            <Link
                                href={content['custombook_button_url'] || "/catalog"}
                                className="bg-white text-slate-900 font-bold px-8 py-4 rounded-[3px] w-fit flex items-center gap-3 transition-transform duration-300 hover:-translate-y-1 shadow-xl"
                            >
                                {content['custombook_button_text'] || 'Детальніше'}
                                <ArrowRight size={20} />
                            </Link>
                        </div>

                        {/* Visual Side */}
                        <div className="relative min-h-[400px] lg:min-h-full flex items-center justify-center bg-black/20 p-12">
                            {embed ? (
                                <div
                                    dangerouslySetInnerHTML={{ __html: embed }}
                                    className="w-full h-full flex items-center justify-center"
                                />
                            ) : (
                                <div className="text-center">
                                    <Sparkles size={64} className="mx-auto mb-6 opacity-30 text-white" />
                                    <p className="font-heading text-xl font-bold opacity-50 uppercase tracking-widest">Premium Service</p>
                                </div>
                            )}
                        </div>
                    </div>
                </motion.div>
            </div>
        </section>
    );
}
