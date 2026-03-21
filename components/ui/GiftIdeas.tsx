'use client';
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import Link from 'next/link';
import { GiftQuiz } from './GiftQuiz';
import { Gift, Sparkles } from 'lucide-react';
import { createBrowserClient } from '@supabase/auth-helpers-nextjs';

type GiftCollection = {
    id: string;
    slug: string;
    label: string;
    label_uk: string;
    emoji: string | null;
    sort_order: number;
    is_active: boolean;
};

export function GiftIdeas() {
    const [quizOpen, setQuizOpen] = useState(false);
    const [collections, setCollections] = useState<GiftCollection[]>([]);
    const [loading, setLoading] = useState(true);
    const { ref, inView } = useInView({
        triggerOnce: true,
        threshold: 0.1,
    });

    const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    // Fetch active gift collections from database
    useEffect(() => {
        const fetchCollections = async () => {
            const { data, error } = await supabase
                .from('gift_collections')
                .select('*')
                .eq('is_active', true)
                .order('sort_order');

            if (error) {
                console.error('Error fetching gift collections:', error);
                // Fallback to hardcoded collections if database fetch fails
                setCollections([
                    { id: '1', slug: 'for-her', label: 'для неї', label_uk: 'для неї', emoji: '💐', sort_order: 1, is_active: true },
                    { id: '2', slug: 'for-him', label: 'для нього', label_uk: 'для нього', emoji: '🎁', sort_order: 2, is_active: true },
                    { id: '3', slug: 'for-mom', label: 'для мами', label_uk: 'для мами', emoji: '🌸', sort_order: 3, is_active: true },
                    { id: '4', slug: 'for-grandma', label: 'для бабусі', label_uk: 'для бабусі', emoji: '👵', sort_order: 4, is_active: true },
                    { id: '5', slug: 'for-dad', label: 'для тата', label_uk: 'для тата', emoji: '👔', sort_order: 5, is_active: true },
                    { id: '6', slug: 'for-grandpa', label: 'для дідуся', label_uk: 'для дідуся', emoji: '👴', sort_order: 6, is_active: true },
                    { id: '7', slug: 'for-friend', label: 'для подруги', label_uk: 'для подруги', emoji: '🤝', sort_order: 7, is_active: true },
                    { id: '8', slug: 'for-boss', label: 'для боса', label_uk: 'для боса', emoji: '💼', sort_order: 8, is_active: true },
                    { id: '9', slug: 'for-couple', label: 'для пари', label_uk: 'для пари', emoji: '💑', sort_order: 9, is_active: true },
                ]);
            } else {
                setCollections(data || []);
            }
            setLoading(false);
        };

        fetchCollections();
    }, []);

    return (
        <section
            ref={ref}
            className="relative w-full py-20 overflow-hidden"
            style={{ backgroundColor: '#f0f3ff' }}
        >
            {/* Decorative elements */}
            <div className="absolute top-10 right-10 text-[#263a99]/10">
                <Gift size={120} strokeWidth={1} />
            </div>
            <div className="absolute bottom-10 left-10 text-[#263a99]/10">
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
                        <div className="bg-gradient-to-br from-[#f0f3ff] to-white p-10 lg:p-12 rounded-3xl shadow-xl border-2 border-[#263a99]/20 relative overflow-hidden">
                            {/* Decorative ribbon effect */}
                            <div className="absolute -top-1 -right-1 w-24 h-24 bg-[#263a99]/10 rounded-full blur-3xl"></div>
                            <div className="absolute -bottom-1 -left-1 w-32 h-32 bg-[#263a99]/10 rounded-full blur-3xl"></div>

                            <div className="relative z-10">
                                <div className="w-20 h-20 bg-gradient-to-br from-[#263a99] to-[#1a2966] rounded-2xl flex items-center justify-center mb-6 shadow-lg rotate-3">
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
                                    className="w-full py-4 px-6 bg-[#263a99] text-white font-bold text-lg rounded-md transition-colors duration-200 hover:bg-[#1a2966] group"
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
                            <p className="text-xs text-[#263a99] tracking-widest uppercase mb-3 font-semibold">
                                Обери категорію
                            </p>
                            <h2 className="text-4xl lg:text-5xl font-bold text-stone-900 leading-tight mb-3">
                                Ідеї для подарунків
                            </h2>
                            <p className="text-stone-600 text-lg">
                                Підібрані колекції для ваших найважливіших людей
                            </p>
                        </motion.div>

                        {loading ? (
                            <div className="text-center py-8 text-stone-400">
                                Завантаження...
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 lg:gap-4">
                                {collections.map((collection, idx) => (
                                    <motion.div
                                        key={collection.id}
                                        initial={{ opacity: 0, scale: 0.9 }}
                                        animate={inView ? { opacity: 1, scale: 1 } : {}}
                                        transition={{ duration: 0.5, delay: idx * 0.05 + 0.4 }}
                                    >
                                        <Link
                                            href={`/catalog?collection=${collection.slug}`}
                                            className="group relative flex items-center justify-center gap-2 p-4 lg:p-6 bg-[#263a99] rounded-md text-white font-bold text-sm lg:text-base uppercase tracking-wide transition-colors duration-200 hover:bg-[#1a2966] text-center"
                                        >
                                            {collection.emoji && (
                                                <span className="text-lg">{collection.emoji}</span>
                                            )}
                                            {collection.label_uk}
                                        </Link>
                                    </motion.div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <GiftQuiz open={quizOpen} onOpenChange={setQuizOpen} />
        </section>
    );
}
