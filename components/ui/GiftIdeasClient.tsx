'use client';
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import Link from 'next/link';
import { GiftQuiz } from './GiftQuiz';
import { Gift, Sparkles } from 'lucide-react';

type GiftCollection = {
    id: string;
    slug: string;
    label: string;
    label_uk: string;
    emoji: string | null;
    sort_order: number;
    is_active: boolean;
};

interface SectionContent {
    heading: string | null;
    subheading: string | null;
    body_text: string | null;
    cta_text: string | null;
    cta_url: string | null;
    metadata: any;
}

interface GiftIdeasClientProps {
    collections: GiftCollection[];
    sectionContent?: SectionContent;
}

export function GiftIdeasClient({ collections, sectionContent }: GiftIdeasClientProps) {
    const [quizOpen, setQuizOpen] = useState(false);
    const { ref, inView } = useInView({
        triggerOnce: true,
        threshold: 0.1,
    });

    // Use section content or fallback to defaults
    const heading = sectionContent?.heading || 'Не знаєш що обрати на подарунок?';
    const subheading = sectionContent?.subheading || 'Пройди швидкий тест і отримай персональні рекомендації';
    const ctaText = sectionContent?.cta_text || 'Пройти тест';
    const quizEnabled = sectionContent?.metadata?.quiz_enabled !== false;

    return (
        <section
            ref={ref}
            className="relative w-full py-20 overflow-hidden bg-gradient-to-br from-[#f0f2f8] to-[#e8ebf8]"
        >
            {/* Semi-transparent overlay for better readability */}
            <div className="absolute inset-0 bg-white/40"></div>

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
                <div className="flex flex-col lg:flex-row items-center gap-12 lg:gap-16">

                    {/* Left Column: Quiz Card */}
                    <motion.div
                        initial={{ opacity: 0, x: -40 }}
                        animate={inView ? { opacity: 1, x: 0 } : {}}
                        transition={{ duration: 0.8, ease: [0.23, 1, 0.32, 1] }}
                        className="w-full lg:w-2/5"
                    >
                        <div className="bg-gradient-to-br from-[#f0f3ff] to-white p-10 lg:p-12 rounded-3xl shadow-xl border-2 border-[#263a99]/20 relative overflow-hidden">
                            {/* Decorative ribbon effect */}
                            <div className="absolute -top-1 -right-1 w-24 h-24 bg-[#1e2d7d]/10 rounded-full blur-3xl"></div>
                            <div className="absolute -bottom-1 -left-1 w-32 h-32 bg-[#1e2d7d]/10 rounded-full blur-3xl"></div>

                            <div className="relative z-10">
                                <div className="w-20 h-20 bg-gradient-to-br from-[#263a99] to-[#1a2966] rounded-2xl flex items-center justify-center mb-6 shadow-lg rotate-3">
                                    <Gift size={40} className="text-white" strokeWidth={2.5} />
                                </div>
                                <h2 className="text-4xl lg:text-5xl font-bold text-[#1e2d7d] leading-tight mb-4">
                                    {heading}
                                </h2>
                                <p className="text-stone-700 text-lg mb-8 leading-relaxed">
                                    {subheading}
                                </p>
                                {quizEnabled && (
                                    <button
                                        onClick={() => setQuizOpen(true)}
                                        className="w-full bg-gradient-to-r from-[#263a99] to-[#1a2966] text-white font-bold py-5 px-6 rounded-xl shadow-lg hover:shadow-2xl transform hover:scale-105 transition-all duration-300 flex items-center justify-center gap-3 group"
                                    >
                                        <Sparkles size={24} className="animate-pulse" />
                                        <span className="text-lg">{ctaText}</span>
                                        <Sparkles size={24} className="animate-pulse" />
                                    </button>
                                )}
                            </div>
                        </div>
                    </motion.div>

                    {/* Right Column: Gift Collections Grid */}
                    <motion.div
                        initial={{ opacity: 0, x: 40 }}
                        animate={inView ? { opacity: 1, x: 0 } : {}}
                        transition={{ duration: 0.8, ease: [0.23, 1, 0.32, 1], delay: 0.2 }}
                        className="w-full lg:w-3/5"
                    >
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 lg:gap-5">
                            {collections.map((collection, index) => (
                                <Link
                                    key={collection.id}
                                    href={`/gifts/${collection.slug}`}
                                    className="group"
                                >
                                    <motion.div
                                        initial={{ opacity: 0, y: 20, scale: 0.9 }}
                                        animate={inView ? { opacity: 1, y: 0, scale: 1 } : {}}
                                        transition={{ duration: 0.5, delay: 0.1 * index }}
                                        className="bg-white p-6 lg:p-8 rounded-2xl shadow-md hover:shadow-2xl transform hover:-translate-y-2 transition-all duration-300 border-2 border-transparent hover:border-[#263a99]/20"
                                    >
                                        <div className="w-14 h-14 lg:w-16 lg:h-16 bg-gradient-to-br from-[#263a99]/5 to-[#1a2966]/10 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                                            <Gift size={28} className="text-[#263a99]" strokeWidth={2} />
                                        </div>
                                        <h3 className="font-bold text-lg lg:text-xl text-stone-900 group-hover:text-[#1e2d7d] transition-colors">
                                            {collection.label_uk}
                                        </h3>
                                    </motion.div>
                                </Link>
                            ))}
                        </div>
                    </motion.div>

                </div>
            </div>

            {/* Gift Quiz Modal */}
            {quizEnabled && (
                <GiftQuiz open={quizOpen} onOpenChange={setQuizOpen} />
            )}
        </section>
    );
}
