'use client';
import { motion } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import { Play, ArrowRight, Sparkles } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { goToConstructor, ProductType } from '@/lib/constructorRouting';

export function ConstructorSelection() {
    const router = useRouter();
    const { ref, inView } = useInView({
        triggerOnce: true,
        threshold: 0.1,
    });

    const handleCreateClick = (productType: ProductType) => {
        const url = goToConstructor({ productType });
        router.push(url);
    };

    return (
        <section ref={ref} className="py-20 bg-white">
            <div className="container px-4">
                {/* Photobooks Section */}
                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    animate={inView ? { opacity: 1, y: 0 } : {}}
                    transition={{ duration: 0.8, ease: [0.23, 1, 0.32, 1] }}
                    className="mb-24"
                >
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
                        {/* LEFT: Video */}
                        <div className="space-y-6">
                            {/* Video Placeholder */}
                            <div className="aspect-video bg-gradient-to-br from-stone-100 to-amber-50 rounded-xl overflow-hidden shadow-lg border border-stone-200 flex items-center justify-center relative group">
                                <div className="text-center">
                                    <Play size={48} className="mx-auto mb-2 text-stone-400" />
                                    <span className="text-stone-500 text-sm font-medium">Відео буде додано</span>
                                </div>
                                {/* Future video element:
                                <video autoPlay muted loop playsInline className="w-full h-full object-cover">
                                    <source src="/videos/photobook-preview.mp4" type="video/mp4" />
                                </video>
                                */}
                            </div>

                            {/* Preview Constructor Button */}
                            <Link
                                href="/constructor/photobook"
                                className="flex items-center justify-center gap-2 text-[#263a99] hover:text-[#1a2966] font-bold transition-colors duration-200"
                            >
                                Переглянути конструктор
                                <ArrowRight size={18} />
                            </Link>
                        </div>

                        {/* RIGHT: Content + Constructor Card */}
                        <div className="space-y-8">
                            {/* Text Content */}
                            <div>
                                <h2 className="text-4xl lg:text-5xl font-black text-stone-900 mb-4 tracking-tight">
                                    Фотокниги
                                </h2>
                                <p className="text-lg text-stone-600 leading-relaxed mb-6">
                                    Створіть унікальну фотокнигу з ваших найкращих спогадів. Преміальні матеріали,
                                    професійний друк та безліч варіантів дизайну.
                                </p>
                                <button
                                    onClick={() => handleCreateClick('photobook')}
                                    className="bg-[#263a99] text-white px-8 py-4 rounded-full font-bold hover:bg-[#1a2966] shadow-[0_4px_20px_rgba(38,58,153,0.35)] hover:-translate-y-1 transition-all duration-200"
                                >
                                    Створити фотокнигу
                                </button>
                            </div>

                            {/* Constructor Preview Card */}
                            <div className="bg-gradient-to-br from-[#eef0fb] to-white rounded-2xl p-6 border border-[#263a99]/10 shadow-sm hover:shadow-[0_8px_32px_rgba(38,58,153,0.16)] transition-all duration-200">
                                <div className="flex items-start gap-4 mb-4">
                                    <div className="w-12 h-12 bg-[#263a99] rounded-xl flex items-center justify-center flex-shrink-0 shadow-[0_4px_16px_rgba(38,58,153,0.25)]">
                                        <Sparkles size={24} className="text-white" />
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-bold text-stone-900 mb-1">
                                            Спробуй конструктор
                                        </h3>
                                        <p className="text-sm text-stone-600">
                                            Створи фотокнигу онлайн за 5 хвилин
                                        </p>
                                    </div>
                                </div>

                                {/* Constructor Mockup Preview */}
                                <div className="aspect-video bg-white rounded-xl mb-4 overflow-hidden border border-stone-100 flex items-center justify-center">
                                    <div className="text-center text-stone-400">
                                        <Sparkles size={32} className="mx-auto mb-2 opacity-30" />
                                        <span className="text-xs">Попередній перегляд конструктора</span>
                                    </div>
                                </div>

                                <Link
                                    href="/constructor/photobook"
                                    className="block w-full bg-[#263a99] text-white text-center px-6 py-3 rounded-full font-bold hover:bg-[#1a2966] shadow-[0_4px_16px_rgba(38,58,153,0.35)] hover:-translate-y-0.5 transition-all duration-200"
                                >
                                    Відкрити конструктор
                                </Link>
                            </div>
                        </div>
                    </div>
                </motion.div>

                {/* Glossy Magazines Section */}
                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    animate={inView ? { opacity: 1, y: 0 } : {}}
                    transition={{ duration: 0.8, delay: 0.2, ease: [0.23, 1, 0.32, 1] }}
                >
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
                        {/* LEFT: Content + Constructor Card */}
                        <div className="space-y-8 order-2 lg:order-1">
                            {/* Text Content */}
                            <div>
                                <h2 className="text-4xl lg:text-5xl font-black text-stone-900 mb-4 tracking-tight">
                                    Глянцеві журнали
                                </h2>
                                <p className="text-lg text-stone-600 leading-relaxed mb-6">
                                    Створіть професійний глянцевий журнал формату A4. Ідеально для портфоліо,
                                    travel-буків та преміальних видань.
                                </p>
                                <button
                                    onClick={() => handleCreateClick('magazine')}
                                    className="bg-[#263a99] text-white px-8 py-4 rounded-full font-bold hover:bg-[#1a2966] shadow-[0_4px_20px_rgba(38,58,153,0.35)] hover:-translate-y-1 transition-all duration-200"
                                >
                                    Створити журнал
                                </button>
                            </div>

                            {/* Constructor Preview Card */}
                            <div className="bg-gradient-to-br from-[#eef0fb] to-white rounded-2xl p-6 border border-[#263a99]/10 shadow-sm hover:shadow-[0_8px_32px_rgba(38,58,153,0.16)] transition-all duration-200">
                                <div className="flex items-start gap-4 mb-4">
                                    <div className="w-12 h-12 bg-[#263a99] rounded-xl flex items-center justify-center flex-shrink-0 shadow-[0_4px_16px_rgba(38,58,153,0.25)]">
                                        <Sparkles size={24} className="text-white" />
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-bold text-stone-900 mb-1">
                                            Спробуй конструктор
                                        </h3>
                                        <p className="text-sm text-stone-600">
                                            Створи глянцевий журнал онлайн
                                        </p>
                                    </div>
                                </div>

                                {/* Constructor Mockup Preview */}
                                <div className="aspect-video bg-white rounded-xl mb-4 overflow-hidden border border-stone-100 flex items-center justify-center">
                                    <div className="text-center text-stone-400">
                                        <Sparkles size={32} className="mx-auto mb-2 opacity-30" />
                                        <span className="text-xs">Попередній перегляд конструктора</span>
                                    </div>
                                </div>

                                <Link
                                    href="/constructor/magazine"
                                    className="block w-full bg-[#263a99] text-white text-center px-6 py-3 rounded-full font-bold hover:bg-[#1a2966] shadow-[0_4px_16px_rgba(38,58,153,0.35)] hover:-translate-y-0.5 transition-all duration-200"
                                >
                                    Відкрити конструктор
                                </Link>
                            </div>
                        </div>

                        {/* RIGHT: Video */}
                        <div className="space-y-6 order-1 lg:order-2">
                            {/* Video Placeholder */}
                            <div className="aspect-video bg-gradient-to-br from-purple-100 to-pink-50 rounded-xl overflow-hidden shadow-lg border border-purple-200 flex items-center justify-center relative group">
                                <div className="text-center">
                                    <Play size={48} className="mx-auto mb-2 text-purple-400" />
                                    <span className="text-purple-600 text-sm font-medium">Відео буде додано</span>
                                </div>
                                {/* Future video element:
                                <video autoPlay muted loop playsInline className="w-full h-full object-cover">
                                    <source src="/videos/magazine-preview.mp4" type="video/mp4" />
                                </video>
                                */}
                            </div>

                            {/* Preview Constructor Button */}
                            <Link
                                href="/constructor/magazine"
                                className="flex items-center justify-center gap-2 text-[#263a99] hover:text-[#1a2966] font-bold transition-colors duration-200"
                            >
                                Переглянути конструктор
                                <ArrowRight size={18} />
                            </Link>
                        </div>
                    </div>
                </motion.div>
            </div>
        </section>
    );
}
