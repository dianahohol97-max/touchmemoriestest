'use client';
import { motion } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import { Play } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { goToConstructor, ProductType } from '@/lib/constructorRouting';

export function ConstructorSelection() {
    const router = useRouter();
    const { ref, inView } = useInView({ triggerOnce: true, threshold: 0.1 });

    return (
        <section ref={ref} className="py-20 bg-white">
            <div className="container px-4">

                {/* ─── Photobooks Section ─── */}
                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    animate={inView ? { opacity: 1, y: 0 } : {}}
                    transition={{ duration: 0.8, ease: [0.23, 1, 0.32, 1] }}
                    className="mb-24"
                >
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">

                        {/* LEFT: Vertical video + order button */}
                        <div className="space-y-4">
                            <div className="aspect-[9/16] bg-gradient-to-br from-stone-100 to-amber-50 rounded-xl overflow-hidden shadow-lg border border-stone-200 flex items-center justify-center relative">
                                <div className="text-center">
                                    <Play size={48} className="mx-auto mb-2 text-stone-400" />
                                    <span className="text-stone-500 text-sm font-medium">Відео буде додано</span>
                                </div>
                                {/* <video autoPlay muted loop playsInline className="w-full h-full object-cover">
                                    <source src="/videos/photobook-preview.mp4" type="video/mp4" />
                                </video> */}
                            </div>
                            <Link
                                href="/catalog?category=photobooks"
                                className="block w-full text-center bg-[#263a99] text-white px-8 py-4 rounded-full font-bold hover:bg-[#1a2966] shadow-[0_4px_20px_rgba(38,58,153,0.35)] hover:-translate-y-1 transition-all duration-200"
                            >
                                Замовити фотокнигу
                            </Link>
                        </div>

                        {/* RIGHT: Title + description + constructor card */}
                        <div className="space-y-8">
                            <div>
                                <h2 className="text-4xl lg:text-5xl font-black text-stone-900 mb-4 tracking-tight">
                                    Фотокниги
                                </h2>
                                <p className="text-lg text-stone-600 leading-relaxed">
                                    Створіть унікальну фотокнигу з ваших найкращих спогадів. Преміальні матеріали, професійний друк та безліч варіантів дизайну.
                                </p>
                            </div>

                            {/* Constructor card — no icon */}
                            <div className="bg-gradient-to-br from-[#eef0fb] to-white rounded-2xl p-6 border border-[#263a99]/10 shadow-sm hover:shadow-[0_8px_32px_rgba(38,58,153,0.16)] transition-all duration-200">
                                <div className="mb-4">
                                    <h3 className="text-xl font-bold text-stone-900 mb-1">
                                        Спробуй конструктор
                                    </h3>
                                    <p className="text-sm text-stone-600">
                                        Створи фотокнигу онлайн за 5 хвилин
                                    </p>
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

                {/* ─── Glossy Magazines Section ─── */}
                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    animate={inView ? { opacity: 1, y: 0 } : {}}
                    transition={{ duration: 0.8, delay: 0.2, ease: [0.23, 1, 0.32, 1] }}
                >
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">

                        {/* LEFT: Title + description + constructor card */}
                        <div className="space-y-8 order-2 lg:order-1">
                            <div>
                                <h2 className="text-4xl lg:text-5xl font-black text-stone-900 mb-4 tracking-tight">
                                    Глянцеві журнали
                                </h2>
                                <p className="text-lg text-stone-600 leading-relaxed">
                                    Створіть професійний глянцевий журнал формату A4. Ідеально для портфоліо, travel-буків та преміальних видань.
                                </p>
                            </div>

                            {/* Constructor card — no icon */}
                            <div className="bg-gradient-to-br from-[#eef0fb] to-white rounded-2xl p-6 border border-[#263a99]/10 shadow-sm hover:shadow-[0_8px_32px_rgba(38,58,153,0.16)] transition-all duration-200">
                                <div className="mb-4">
                                    <h3 className="text-xl font-bold text-stone-900 mb-1">
                                        Спробуй конструктор
                                    </h3>
                                    <p className="text-sm text-stone-600">
                                        Створи глянцевий журнал онлайн
                                    </p>
                                </div>
                                <Link
                                    href="/constructor/magazine"
                                    className="block w-full bg-[#263a99] text-white text-center px-6 py-3 rounded-full font-bold hover:bg-[#1a2966] shadow-[0_4px_16px_rgba(38,58,153,0.35)] hover:-translate-y-0.5 transition-all duration-200"
                                >
                                    Відкрити конструктор
                                </Link>
                            </div>
                        </div>

                        {/* RIGHT: Vertical video + order button */}
                        <div className="space-y-4 order-1 lg:order-2">
                            <div className="aspect-[9/16] bg-gradient-to-br from-purple-100 to-pink-50 rounded-xl overflow-hidden shadow-lg border border-purple-200 flex items-center justify-center relative">
                                <div className="text-center">
                                    <Play size={48} className="mx-auto mb-2 text-purple-400" />
                                    <span className="text-purple-600 text-sm font-medium">Відео буде додано</span>
                                </div>
                                {/* <video autoPlay muted loop playsInline className="w-full h-full object-cover">
                                    <source src="/videos/magazine-preview.mp4" type="video/mp4" />
                                </video> */}
                            </div>
                            <Link
                                href="/catalog?category=hlyantsevi-zhurnaly"
                                className="block w-full text-center bg-[#263a99] text-white px-8 py-4 rounded-full font-bold hover:bg-[#1a2966] shadow-[0_4px_20px_rgba(38,58,153,0.35)] hover:-translate-y-1 transition-all duration-200"
                            >
                                Замовити журнал
                            </Link>
                        </div>

                    </div>
                </motion.div>

            </div>
        </section>
    );
}
