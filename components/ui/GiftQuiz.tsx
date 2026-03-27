'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ChevronRight, ChevronLeft, RotateCcw, CheckCircle2, Check } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface QuizStep {
    question: string;
    key: string;
    options: { label: string; value: string }[];
    multiSelect?: boolean;
    maxSelections?: number;
}

interface Product {
    id: string;
    name: string;
    slug: string;
    description: string;
    image_url?: string;
}

interface Recommendation {
    title: string;
    desc: string;
    image: string;
    link: string;
}

const quizSteps: QuizStep[] = [
    {
        question: "Для кого ви шукаєте подарунок? (Вік)",
        key: "age",
        options: [
            { label: "Дитина (0-12)", value: "child" },
            { label: "Підліток (13-18)", value: "teen" },
            { label: "Молодь (19-35)", value: "young" },
            { label: "Дорослі (36-60)", value: "adult" },
            { label: "60+", value: "senior" }
        ]
    },
    {
        question: "Які інтереси у отримувача? (оберіть до 2-х)",
        key: "interests",
        multiSelect: true,
        maxSelections: 2,
        options: [
            { label: "Подорожі та пригоди", value: "travel" },
            { label: "Сім'я та дім", value: "family" },
            { label: "Стиль та естетика", value: "style" },
            { label: "Спогади та історія", value: "memories" },
            { label: "Кар'єра та досягнення", value: "career" }
        ]
    },
    {
        question: "Яка подія?",
        key: "occasion",
        options: [
            { label: "День народження", value: "birthday" },
            { label: "Весілля / Річниця", value: "wedding" },
            { label: "Народження дитини", value: "baby" },
            { label: "Просто так", value: "just_because" },
            { label: "Свято (Новий рік, 8 березня тощо)", value: "holiday" }
        ]
    },
    {
        question: "Ваш бюджет?",
        key: "budget",
        options: [
            { label: "До 500 грн", value: "low" },
            { label: "500 - 1500 грн", value: "medium" },
            { label: "1500 - 3000 грн", value: "high" },
            { label: "Бюджет не обмежений", value: "unlimited" }
        ]
    },
    {
        question: "Бажаний стиль подарунка?",
        key: "style",
        options: [
            { label: "Класичний та надійний", value: "classic" },
            { label: "Сучасний та стильний", value: "modern" },
            { label: "Мінімалістичний", value: "minimal" },
            { label: "Яскравий та емоційний", value: "emotional" }
        ]
    }
];

// Fetch recommendations from Supabase with fallback logic
const getRecommendations = async (answers: Record<string, string | string[]>): Promise<Recommendation[]> => {
    const q1Answer = answers.age as string;
    const interests = Array.isArray(answers.interests) ? answers.interests : [answers.interests].filter(Boolean);

    try {
        // Try to find exact match with all selected interests
        let { data, error } = await supabase
            .from('quiz_recommendations')
            .select('product_ids')
            .eq('q1_answer', q1Answer)
            .contains('q2_answers', interests)
            .limit(1)
            .single();

        // If no exact match and user selected 2 interests, try with just the first interest
        if ((!data || error) && interests.length === 2) {
            const result = await supabase
                .from('quiz_recommendations')
                .select('product_ids')
                .eq('q1_answer', q1Answer)
                .contains('q2_answers', [interests[0]])
                .limit(1)
                .single();

            data = result.data;
            error = result.error;
        }

        // If no match with q1_answer, try matching just interests
        if (!data || error) {
            const result = await supabase
                .from('quiz_recommendations')
                .select('product_ids')
                .contains('q2_answers', interests)
                .limit(1)
                .single();

            data = result.data;
            error = result.error;
        }

        if (data && data.product_ids && data.product_ids.length > 0) {
            // Fetch product details
            const { data: products, error: productsError } = await supabase
                .from('products')
                .select('id, name, slug, description, image_url')
                .in('id', data.product_ids);

            if (products && !productsError) {
                return products.map((product: Product) => ({
                    title: product.name,
                    desc: product.description || 'Преміум якість та унікальний дизайн',
                    image: product.image_url || '/images/promo/photobook_video.png',
                    link: `/catalog/${product.slug}`
                }));
            }
        }
    } catch (err) {
        console.error('Error fetching recommendations:', err);
    }

    // Fallback to hardcoded recommendations if Supabase query fails
    return getFallbackRecommendations(answers);
};

// Fallback recommendations (original hardcoded logic)
const getFallbackRecommendations = (answers: Record<string, string | string[]>): Recommendation[] => {
    const interests = Array.isArray(answers.interests) ? answers.interests : [answers.interests].filter(Boolean);

    // Multi-interest combinations
    if (interests.includes('travel') && interests.includes('family')) {
        return [
            { title: "Travelbook", desc: "Ідеально для збереження сімейних пригод", image: "/images/promo/travel_book_premium.png", link: "/catalog/travelbook" },
            { title: "Фотокнига 'Сім'я'", desc: "Найтепліші спогади разом", image: "/images/promo/photobook_video.png", link: "/catalog/family-book" }
        ];
    }

    if (interests.includes('travel') && interests.includes('memories')) {
        return [
            { title: "Travelbook", desc: "Збережіть кожну подорож назавжди", image: "/images/promo/travel_book_premium.png", link: "/catalog/travelbook" },
            { title: "Фотокнига 'Подорожі'", desc: "Преміум якість для ваших пригод", image: "/images/promo/photobook_video.png", link: "/catalog/photobook-travel" }
        ];
    }

    // Single interest recommendations
    if (interests.includes('travel')) {
        return [
            { title: "Travelbook", desc: "Ідеально для збереження пригод", image: "/images/promo/travel_book_premium.png", link: "/catalog/travelbook" },
            { title: "Фотокнига 'Подорожі'", desc: "Тверда обкладинка, преміум якість", image: "/images/promo/photobook_video.png", link: "/catalog/photobook-travel" }
        ];
    }

    if (answers.occasion === 'wedding') {
        return [
            { title: "Весільна Фотокнига", desc: "Ваша історія кохання", image: "/images/promo/photobook_video.png", link: "/catalog/wedding-book" },
            { title: "Преміум Фотокнига", desc: "Найвищий стандарт друку", image: "/images/promo/design_service_premium.png", link: "/catalog/premium-book" }
        ];
    }

    if (interests.includes('family') || answers.occasion === 'baby') {
        return [
            { title: "Фотокнига 'Сім'я'", desc: "Найтепліші спогади разом", image: "/images/promo/photobook_video.png", link: "/catalog/family-book" },
            { title: "Дитяча Фотокнига", desc: "Перші кроки вашого малюка", image: "/images/promo/photobook_video.png", link: "/catalog/baby-book" }
        ];
    }

    return [
        { title: "Глянцевий Журнал", desc: "Стильний та легкий формат", image: "/images/promo/magazine_video.png", link: "/catalog/magazine" },
        { title: "Фотокнига Класик", desc: "Універсальний подарунок", image: "/images/promo/photobook_video.png", link: "/catalog/classic-book" }
    ];
};

export function GiftQuiz({ open, onOpenChange }: { open: boolean, onOpenChange: (open: boolean) => void }) {
    const [step, setStep] = useState(0);
    const [answers, setAnswers] = useState<Record<string, string | string[]>>({});
    const [showResults, setShowResults] = useState(false);
    const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
    const [loadingRecs, setLoadingRecs] = useState(false);

    const currentStep = quizSteps[step];
    const isMultiSelect = currentStep?.multiSelect || false;
    const maxSelections = currentStep?.maxSelections || 1;
    const currentAnswers = isMultiSelect ? ((answers[currentStep.key] as string[]) || []) : [];

    // Fetch recommendations when quiz is completed
    useEffect(() => {
        if (showResults && recommendations.length === 0) {
            setLoadingRecs(true);
            getRecommendations(answers).then((recs) => {
                setRecommendations(recs);
                setLoadingRecs(false);
            });
        }
    }, [showResults, answers, recommendations.length]);

    const handleOptionSelect = (value: string) => {
        const currentKey = quizSteps[step].key;

        if (isMultiSelect) {
            // Multi-select logic: toggle selection
            const current = (answers[currentKey] as string[]) || [];
            let updated: string[];

            if (current.includes(value)) {
                // Deselect
                updated = current.filter(v => v !== value);
            } else if (current.length < maxSelections) {
                // Select (if under max)
                updated = [...current, value];
            } else {
                // Max reached, do nothing
                return;
            }

            setAnswers({ ...answers, [currentKey]: updated });
        } else {
            // Single select logic: auto-advance
            setAnswers({ ...answers, [currentKey]: value });

            if (step < quizSteps.length - 1) {
                setStep(step + 1);
            } else {
                setShowResults(true);
            }
        }
    };

    const handleContinue = () => {
        if (step < quizSteps.length - 1) {
            setStep(step + 1);
        } else {
            setShowResults(true);
        }
    };

    const resetQuiz = () => {
        setStep(0);
        setAnswers({});
        setShowResults(false);
        setRecommendations([]);
    };

    const canContinue = isMultiSelect ? currentAnswers.length > 0 : true;
    const progress = ((step + (showResults ? 1 : 0)) / quizSteps.length) * 100;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl p-0 overflow-hidden bg-white border-none shadow-2xl rounded-[24px]">
                <div className="relative">
                    {/* Progress Bar */}
                    <div className="absolute top-0 left-0 w-full h-1.5 bg-gray-100 z-20">
                        <motion.div
                            className="h-full bg-gradient-to-r from-[#1e2d7d] to-[#152158]"
                            initial={{ width: 0 }}
                            animate={{ width: `${progress}%` }}
                            transition={{ duration: 0.5 }}
                        />
                    </div>

                    <div className="p-8 lg:p-12">
                        <AnimatePresence mode="wait">
                            {!showResults ? (
                                <motion.div
                                    key={`step-${step}`}
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -20 }}
                                    transition={{ duration: 0.3 }}
                                >
                                    <DialogHeader className="mb-8 items-center text-center">
                                        <div className="text-[#1e2d7d] font-bold text-sm tracking-[0.2em] uppercase mb-4">
                                            Крок {step + 1} з {quizSteps.length}
                                        </div>
                                        <DialogTitle className="text-3xl font-black text-stone-900 leading-tight mb-2">
                                            {quizSteps[step].question}
                                        </DialogTitle>
                                        {isMultiSelect && (
                                            <p className="text-sm text-[#1e2d7d] font-semibold">
                                                Обрано: {currentAnswers.length}/{maxSelections}
                                            </p>
                                        )}
                                    </DialogHeader>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                                        {quizSteps[step].options.map((option) => {
                                            const isSelected = isMultiSelect && currentAnswers.includes(option.value);
                                            return (
                                                <button
                                                    key={option.value}
                                                    onClick={() => handleOptionSelect(option.value)}
                                                    className={`flex items-center justify-between p-5 rounded-[12px] border-2 transition-all text-left group ${
                                                        isSelected
                                                            ? 'border-[#4a5cc7] bg-[#f0f3ff]'
                                                            : 'border-gray-100 hover:border-[#4a5cc7]/50 hover:bg-[#f0f3ff]/50'
                                                    }`}
                                                >
                                                    <span className={`font-bold text-lg ${isSelected ? 'text-[#152158]' : 'text-stone-800'}`}>
                                                        {option.label}
                                                    </span>
                                                    {isSelected ? (
                                                        <Check className="w-6 h-6 text-[#1e2d7d]" strokeWidth={3} />
                                                    ) : (
                                                        <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-[#4a5cc7] transition-colors" />
                                                    )}
                                                </button>
                                            );
                                        })}
                                    </div>

                                    <div className="flex justify-between items-center">
                                        {step > 0 && (
                                            <Button
                                                variant="ghost"
                                                onClick={() => setStep(step - 1)}
                                                className="text-gray-400 font-bold uppercase tracking-widest text-xs flex items-center gap-2 hover:text-[#1e2d7d]"
                                            >
                                                <ChevronLeft size={16} /> Назад
                                            </Button>
                                        )}
                                        {isMultiSelect && (
                                            <Button
                                                onClick={handleContinue}
                                                disabled={!canContinue}
                                                className="ml-auto bg-gradient-to-r from-[#1e2d7d] to-[#152158] hover:from-[#152158] hover:to-[#0f1a45] text-white font-bold uppercase tracking-wider px-8 disabled:opacity-50 disabled:cursor-not-allowed rounded-2xl"
                                            >
                                                Продовжити <ChevronRight size={16} className="ml-2" />
                                            </Button>
                                        )}
                                    </div>
                                </motion.div>
                            ) : (
                                <motion.div
                                    key="results"
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
                                >
                                    <DialogHeader className="mb-10 items-center text-center">
                                        <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mb-6">
                                            <CheckCircle2 size={32} className="text-green-500" />
                                        </div>
                                        <DialogTitle className="text-3xl lg:text-4xl font-black text-stone-900 mb-4">
                                            Наші рекомендації для вас
                                        </DialogTitle>
                                        <DialogDescription className="text-gray-500 text-lg">
                                            Ми підібрали найкращі ідеї на основі ваших відповідей
                                        </DialogDescription>
                                    </DialogHeader>

                                    {loadingRecs ? (
                                        <div className="flex justify-center items-center py-20">
                                            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#4a5cc7]"></div>
                                        </div>
                                    ) : (
                                        <>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-10">
                                                {recommendations.map((rec, i) => (
                                                    <motion.div
                                                        key={i}
                                                        initial={{ opacity: 0, y: 20 }}
                                                        animate={{ opacity: 1, y: 0 }}
                                                        transition={{ delay: i * 0.1 + 0.3 }}
                                                        className="group"
                                                    >
                                                        <div className="relative aspect-[4/3] rounded-[16px] overflow-hidden mb-4 shadow-md group-hover:shadow-xl transition-all duration-500">
                                                            <Image
                                                                src={rec.image}
                                                                alt={rec.title}
                                                                fill
                                                                className="object-cover group-hover:scale-105 transition-transform duration-700"
                                                            />
                                                        </div>
                                                        <h3 className="text-xl font-black text-stone-900 mb-1">{rec.title}</h3>
                                                        <p className="text-gray-500 text-sm mb-4 leading-relaxed">{rec.desc}</p>
                                                        <Link
                                                            href={rec.link}
                                                            className="inline-flex items-center gap-2 text-[#1e2d7d] font-bold text-sm uppercase tracking-wider group/link"
                                                        >
                                                            Детальніше
                                                            <ChevronRight size={16} className="transition-transform group-hover/link:translate-x-1" />
                                                        </Link>
                                                    </motion.div>
                                                ))}
                                            </div>

                                            <div className="flex justify-center border-t border-gray-100 pt-10">
                                                <Button
                                                    variant="outline"
                                                    onClick={resetQuiz}
                                                    className="flex items-center gap-2 border-gray-200 rounded-full px-8 py-6 font-bold text-gray-500 hover:text-[#1e2d7d] hover:border-[#4a5cc7]"
                                                >
                                                    <RotateCcw size={18} /> Спробувати знову
                                                </Button>
                                            </div>
                                        </>
                                    )}
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
