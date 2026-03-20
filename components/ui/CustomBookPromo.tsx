'use client';
import { motion } from 'framer-motion';
import styles from './CustomBookPromo.module.css';
import { useInView } from 'react-intersection-observer';
import Link from 'next/link';
import Image from 'next/image';
import { BookOpen, Sparkles, ArrowRight } from 'lucide-react';
import { useTheme } from '@/components/providers/ThemeProvider';
import { PRODUCT_IMAGES } from '@/lib/productImages';

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
                    className="relative overflow-hidden rounded-[3px] shadow-[var(--shadow-premium)] bg-white text-primary border border-gray-100"
                >
                    {/* Decorative Background Elements */}
                    <div className="absolute top-0 right-0 w-2/3 h-full bg-gradient-to-l from-primary/5 to-transparent pointer-events-none" />
                    <div className="absolute -bottom-32 -left-32 w-96 h-96 bg-primary/5 rounded-full blur-3xl pointer-events-none" />

                    <div className="grid grid-cols-1 lg:grid-cols-2 relative z-10">
                        {/* Content Side */}
                        <div className="p-12 lg:p-20 flex flex-col justify-center">
                            <h2 className="text-[40px] lg:text-[56px] font-black leading-[1.05] tracking-tight mb-8">
                                Створимо книгу за вас
                            </h2>

                            <p className="text-[18px] opacity-80 mb-12 font-body leading-relaxed max-w-md">
                                {content['custombook_subtitle'] || 'Втілюємо найсміливіші ідеї. Персональний дизайн від професіоналів без зайвих зусиль з вашого боку.'}
                            </p>

                            <Link
                                href={content['custombook_button_url'] || "/catalog"}
                                className="btn-primary w-fit group"
                            >
                                {content['custombook_button_text'] || 'Детальніше'}
                                <ArrowRight size={20} className="ml-2 transition-transform duration-300 group-hover:translate-x-1" />
                            </Link>
                        </div>

                        {/* Visual Side */}
                        <div className="relative h-full min-h-[400px] lg:min-h-[600px] bg-gray-50 overflow-hidden">
                            <Image
                                src={PRODUCT_IMAGES.studio}
                                alt="Дизайн сервіс"
                                fill
                                className="object-cover transition-transform duration-700 hover:scale-105"
                            />
                        </div>
                    </div>
                </motion.div>
            </div>
        </section>
    );
}
