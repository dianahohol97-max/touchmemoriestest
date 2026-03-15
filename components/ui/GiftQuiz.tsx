'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from "@/components/ui/progress";
import { ChevronRight, ChevronLeft, RotateCcw, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';

interface QuizStep {
    question: string;
    key: string;
    options: { label: string; value: string }[];
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
        question: "Які інтереси у отримувача?",
        key: "interests",
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

// Mock recommendation logic
const getRecommendations = (answers: Record<string, string>) => {
    // This is a simplified logic. In a real app, this would query a DB or use a complex scoring system.
    if (answers.interests === 'travel') {
        return [
            { title: "Travelbook", desc: "Ідеально для збереження пригод", image: "/images/promo/travel_book_premium.png", link: "/travelbook" },
            { title: "Фотокнига 'Подорожі'", desc: "Тверда обкладинка, преміум якість", image: "/images/promo/photobook_video.png", link: "/catalog/photobook-travel" }
        ];
    }
    if (answers.occasion === 'wedding') {
        return [
            { title: "Весільна Фотокнига", desc: "Ваша історія кохання", image: "/images/promo/photobook_video.png", link: "/catalog/wedding-book" },
            { title: "Преміум Фотокнига", desc: "Найвищий стандарт друку", image: "/images/promo/design_service_premium.png", link: "/catalog/premium-book" }
        ];
    }
    if (answers.interests === 'family' || answers.occasion === 'baby') {
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
    const [answers, setAnswers] = useState<Record<string, string>>({});
    const [showResults, setShowResults] = useState(false);

    const handleOptionSelect = (value: string) => {
        const currentKey = quizSteps[step].key;
        setAnswers({ ...answers, [currentKey]: value });

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
    };

    const progress = ((step + (showResults ? 1 : 0)) / quizSteps.length) * 100;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl p-0 overflow-hidden bg-white border-none shadow-2xl rounded-[24px]">
                <div className="relative">
                    {/* Progress Bar */}
                    <div className="absolute top-0 left-0 w-full h-1.5 bg-gray-100 z-20">
                        <motion.div
                            className="h-full bg-primary"
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
                                        <div className="text-primary font-bold text-sm tracking-[0.2em] uppercase mb-4">
                                            Крок {step + 1} з {quizSteps.length}
                                        </div>
                                        <DialogTitle className="text-3xl font-black text-primary leading-tight">
                                            {quizSteps[step].question}
                                        </DialogTitle>
                                    </DialogHeader>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        {quizSteps[step].options.map((option) => (
                                            <button
                                                key={option.value}
                                                onClick={() => handleOptionSelect(option.value)}
                                                className="flex items-center justify-between p-5 rounded-[12px] border-2 border-gray-100 hover:border-primary/30 hover:bg-primary/5 transition-all text-left group"
                                            >
                                                <span className="font-bold text-primary text-lg">
                                                    {option.label}
                                                </span>
                                                <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-primary transition-colors" />
                                            </button>
                                        ))}
                                    </div>

                                    {step > 0 && (
                                        <Button
                                            variant="ghost"
                                            onClick={() => setStep(step - 1)}
                                            className="mt-8 text-gray-400 font-bold uppercase tracking-widest text-xs flex items-center gap-2 hover:text-primary"
                                        >
                                            <ChevronLeft size={16} /> Назад
                                        </Button>
                                    )}
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
                                        <DialogTitle className="text-3xl lg:text-4xl font-black text-primary mb-4">
                                            Наші рекомендації для вас
                                        </DialogTitle>
                                        <DialogDescription className="text-gray-500 text-lg">
                                            Ми підібрали найкращі ідеї на основі ваших відповідей
                                        </DialogDescription>
                                    </DialogHeader>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-10">
                                        {getRecommendations(answers).map((rec, i) => (
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
                                                <h3 className="text-xl font-black text-primary mb-1">{rec.title}</h3>
                                                <p className="text-gray-500 text-sm mb-4 leading-relaxed">{rec.desc}</p>
                                                <Link
                                                    href={rec.link}
                                                    className="inline-flex items-center gap-2 text-primary font-bold text-sm uppercase tracking-wider group/link"
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
                                            className="flex items-center gap-2 border-gray-200 rounded-full px-8 py-6 font-bold text-gray-500 hover:text-primary hover:border-primary"
                                        >
                                            <RotateCcw size={18} /> Спробувати знову
                                        </Button>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
