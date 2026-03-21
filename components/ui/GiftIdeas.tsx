'use client';
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import Link from 'next/link';
import { GiftQuiz } from './GiftQuiz';
import { Gift, Sparkles } from 'lucide-react';

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
        <section
            ref={ref}
            className="relative w-full py-20 overflow-hidden"
            style={{ backgroundColor: '#fef7ed' }}
        >
            {/* Decorative elements */}
            <div className="absolute top-10 right-10 text-amber-200/30">
                <Gift size={120} strokeWidth={1} />
            </div>
            <div className="absolute bottom-10 left-10 text-amber-200/30">
                <Sparkles size={80} strokeWidth={1} />
            </div>

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
                <div className="flex flex-col lg:flex-row items-center gap-12 lg:gap-16">

                    {/* Left Column: Quiz Card */}
                    <motion.div
                        initial={{ opacity: 0, x: -40 }}
                        animate={inView ? { opacity: 1, x: 0 } : {}}
                        transition={{ duration: 0.8, ease: [0.23, 1, 0.32, 1] }}
                        className="w-full lg:w-2/5"
                    >
                        <div className="bg-gradient-to-br from-amber-100 to-orange-50 p-10 lg:p-12 rounded-3xl shadow-xl border-2 border-amber-200/50 relative overflow-hidden">
                            {/* Decorative ribbon effect */}
                            <div className="absolute -top-1 -right-1 w-24 h-24 bg-amber-400/20 rounded-full blur-3xl"></div>
                            <div className="absolute -bottom-1 -left-1 w-32 h-32 bg-orange-300/20 rounded-full blur-3xl"></div>

                            <div className="relative z-10">
                                <div className="w-20 h-20 bg-gradient-to-br from-amber-400 to-orange-400 rounded-2xl flex items-center justify-center mb-6 shadow-lg rotate-3">
                                    <Gift size={40} className="text-white" strokeWidth={2.5} />
                                </div>
                                <h2 className="text-4xl lg:text-5xl font-bold text-stone-900 leading-tight mb-4">
                                    Не знаєш що обрати на подарунок?
                                </h2>
                                <p className="text-stone-700 text-lg mb-8 leading-relaxed">
                                    Пройди швидкий тест і отримай персональні рекомендації
                                </p>
                                <button
                                    onClick={() => setQuizOpen(true)}
                                    className="w-full py-4 px-6 bg-[#263a99] text-white font-bold text-lg rounded-full transition-all duration-200 shadow-[0_4px_20px_rgba(38,58,153,0.35)] hover:bg-[#1a2966] hover:scale-105 hover:-translate-y-1 group"
                                >
                                    <span className="flex items-center justify-center gap-2">
                                        Пройти тест
                                        <Sparkles size={20} className="transition-transform duration-300 group-hover:rotate-12" />
                                    </span>
                                </button>
                            </div>
                        </div>
                    </motion.div>

                    {/* Right Column: Grid */}
                    <div className="w-full lg:w-3/5">
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={inView ? { opacity: 1, y: 0 } : {}}
                            transition={{ duration: 0.8, delay: 0.2 }}
                            className="mb-10"
                        >
                            <p className="text-xs text-amber-600 tracking-widest uppercase mb-3 font-semibold">
                                Обери категорію
                            </p>
                            <h2 className="text-4xl lg:text-5xl font-bold text-stone-900 leading-tight mb-3">
                                Ідеї для подарунків
                            </h2>
                            <p className="text-stone-600 text-lg">
                                Підібрані колекції для ваших найважливіших людей
                            </p>
                        </motion.div>

                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 lg:gap-4">
                            {buttons.map((btn, idx) => (
                                <motion.div
                                    key={idx}
                                    initial={{ opacity: 0, scale: 0.9 }}
                                    animate={inView ? { opacity: 1, scale: 1 } : {}}
                                    transition={{ duration: 0.5, delay: idx * 0.05 + 0.4 }}
                                >
                                    <Link
                                        href={`/catalog?collection=${btn.slug}`}
                                        className="group relative flex items-center justify-center p-4 lg:p-6 bg-[#263a99] rounded-md text-white font-bold text-sm lg:text-base uppercase tracking-wide transition-colors duration-200 hover:bg-[#1a2966] text-center"
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
