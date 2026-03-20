'use client';
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import Image from 'next/image';
import Link from 'next/link';
import { GiftQuiz } from './GiftQuiz';
import { HelpCircle } from 'lucide-react';
import { PRODUCT_IMAGES } from '@/lib/productImages';

export function GiftIdeas() {
    const [quizOpen, setQuizOpen] = useState(false);
    const { ref, inView } = useInView({
        triggerOnce: true,
        threshold: 0.1,
    });

    const buttons = [
        { label: 'для неї', slug: 'for-her' },
        { label: 'для нього', slug: 'for-him' },
        { label: 'для мами', slug: 'for-mom' },
        { label: 'для бабусі', slug: 'for-grandma' },
        { label: 'для тата', slug: 'for-dad' },
        { label: 'для дідуся', slug: 'for-grandpa' },
        { label: 'для подруги', slug: 'for-friend' },
        { label: 'для боса', slug: 'for-boss' },
        { label: 'для пари', slug: 'for-couple' },
    ];

    return (
        <section ref={ref} className="relative w-full min-h-[700px] flex items-center justify-center overflow-hidden section-padding">
            {/* Background Image */}
            <Image
                src={PRODUCT_IMAGES.hero}
                alt="Ідеї для подарунків"
                fill
                className="object-cover"
                priority
            />
            {/* Dark Overlay for better contrast */}
            <div className="absolute inset-0 bg-black/30 backdrop-blur-[1px]" />

            <div className="container relative z-10">
                <div className="flex flex-col lg:flex-row items-center gap-16 lg:gap-24">

                    {/* Left Column: Side Card */}
                    <motion.div
                        initial={{ opacity: 0, x: -40 }}
                        animate={inView ? { opacity: 1, x: 0 } : {}}
                        transition={{ duration: 0.8, ease: [0.23, 1, 0.32, 1] }}
                        className="w-full lg:w-1/3"
                    >
                        <div className="bg-white/10 backdrop-blur-xl border border-white/20 p-8 lg:p-12 rounded-[3px] shadow-[var(--card-shadow)]">
                            <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mb-8">
                                <HelpCircle size={32} className="text-white" />
                            </div>
                            <h2 className="text-3xl lg:text-4xl font-black text-white leading-tight mb-8">
                                Не знаєш що обрати на подарунок?
                            </h2>
                            <button
                                onClick={() => setQuizOpen(true)}
                                className="w-full h-[60px] bg-white text-primary font-bold text-lg lg:text-xl uppercase tracking-widest rounded-[3px] transition-all duration-300 hover:bg-primary hover:text-white hover:shadow-[var(--card-shadow-hover)] group"
                            >
                                Пройти тест
                                <span className="inline-block transition-transform duration-300 group-hover:translate-x-1 ml-2">→</span>
                            </button>
                        </div>
                    </motion.div>

                    {/* Right Column: Grid */}
                    <div className="w-full lg:w-2/3">
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={inView ? { opacity: 1, y: 0 } : {}}
                            transition={{ duration: 0.8, delay: 0.2 }}
                            className="mb-12"
                        >
                            <h2 className="text-[32px] lg:text-[48px] font-black leading-none tracking-tight text-white drop-shadow-lg mb-4">
                                Ідеї для подарунків
                            </h2>
                            <p className="text-white/80 text-lg font-medium drop-shadow-md">
                                Підібрані колекції для ваших найважливіших людей
                            </p>
                        </motion.div>

                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 lg:gap-6">
                            {buttons.map((btn, idx) => (
                                <motion.div
                                    key={idx}
                                    initial={{ opacity: 0, scale: 0.9 }}
                                    animate={inView ? { opacity: 1, scale: 1 } : {}}
                                    transition={{ duration: 0.5, delay: idx * 0.05 + 0.4 }}
                                >
                                    <Link
                                        href={`/catalog?collection=${btn.slug}`}
                                        className="group relative flex items-center justify-center p-5 lg:p-7 bg-white/10 backdrop-blur-md border border-white/10 rounded-[3px] text-white font-bold text-base lg:text-lg uppercase tracking-widest transition-all duration-500 hover:bg-white/25 hover:border-white/40 hover:shadow-[var(--card-shadow-hover)] hover:-translate-y-1 text-center"
                                    >
                                        {btn.label}
                                    </Link>
                                </motion.div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            <GiftQuiz open={quizOpen} onOpenChange={setQuizOpen} />
        </section>
    );
}
