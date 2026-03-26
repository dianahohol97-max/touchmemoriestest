'use client';
import { motion } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import { Play } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { goToConstructor, ProductType } from '@/lib/constructorRouting';
import { useState } from 'react';
import DesignerConfigModal from '../DesignerConfigModal';

export function ConstructorSelection() {
    const router = useRouter();
    const { ref, inView } = useInView({ triggerOnce: true, threshold: 0.1 });
    const [photobookModalOpen, setPhotobookModalOpen] = useState(false);
    const [magazineModalOpen, setMagazineModalOpen] = useState(false);

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

                        {/* LEFT: Video */}
                        <div>
                            <div className="aspect-[4/5] bg-gradient-to-br from-stone-100 to-[#f0f3ff] rounded-xl overflow-hidden shadow-lg border border-stone-200 flex items-center justify-center relative">
                                <div className="text-center">
                                    <Play size={48} className="mx-auto mb-2 text-stone-400" />
                                    <span className="text-stone-500 text-sm font-medium">Відео буде додано</span>
                                </div>
                                {/* <video autoPlay muted loop playsInline className="w-full h-full object-cover">
                                    <source src="/videos/photobook-preview.mp4" type="video/mp4" />
                                </video> */}
                            </div>
                        </div>

                        {/* RIGHT: Content */}
                        <div className="space-y-6">
                            <div>
                                <h2 className="text-4xl lg:text-5xl font-black text-[#1e2d7d] mb-4 tracking-tight">
                                    Фотокниги
                                </h2>
                                <p className="text-lg text-stone-600 leading-relaxed">
                                    Зберіть найкращі моменти у красиву фотокнигу — подарунок, який залишиться на все життя. Обирайте формат, обкладинку та кількість сторінок під свій стиль. Ідеально для весіль, подорожей, сімейних архівів та особливих дат.
                                </p>
                            </div>

                            {/* Constructor visualization */}
                            <div className="bg-[#f0f3ff] rounded-md border border-[#263a99]/10 aspect-[4/3] flex items-center justify-center">
                                <span className="text-[#1e2d7d]/60 text-lg font-semibold">Конструктор</span>
                            </div>

                            {/* Buttons */}
                            <div className="flex gap-3 flex-wrap">
                                <Link
                                    href="/editor/new?product=photobook&format=20x20&pages=20"
                                    className="flex-1 bg-[#1e2d7d] text-white text-center px-6 py-3 rounded-lg font-semibold hover:bg-[#263a99] transition-colors duration-200"
                                >
                                    Відкрити конструктор
                                </Link>
                                <button
                                    onClick={() => setPhotobookModalOpen(true)}
                                    className="flex-1 border-2 border-[#1e2d7d] text-[#1e2d7d] bg-white hover:bg-[#f0f2f8] font-semibold px-6 py-3 rounded-lg transition-colors text-center"
                                >
                                    Оформити з дизайнером
                                </button>
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

                        {/* LEFT: Content */}
                        <div className="space-y-6 order-2 lg:order-1">
                            <div>
                                <h2 className="text-4xl lg:text-5xl font-black text-[#1e2d7d] mb-4 tracking-tight">
                                    Глянцеві журнали
                                </h2>
                                <p className="text-lg text-stone-600 leading-relaxed">
                                    Створіть глянцевий журнал зі своїми фото — стильний і сучасний формат для збереження спогадів. Ідеально для модних зйомок, тематичних подій, подорожей та корпоративних проєктів.
                                </p>
                            </div>

                            {/* Constructor visualization */}
                            <div className="bg-[#f0f3ff] rounded-md border border-[#263a99]/10 aspect-[4/3] flex items-center justify-center">
                                <span className="text-[#1e2d7d]/60 text-lg font-semibold">Конструктор</span>
                            </div>

                            {/* Buttons */}
                            <div className="flex gap-3 flex-wrap">
                                <Link
                                    href="/editor/new?product=magazine&format=A4&pages=20"
                                    className="flex-1 bg-[#1e2d7d] text-white text-center px-6 py-3 rounded-lg font-semibold hover:bg-[#263a99] transition-colors duration-200"
                                >
                                    Відкрити конструктор
                                </Link>
                                <button
                                    onClick={() => setMagazineModalOpen(true)}
                                    className="flex-1 border-2 border-[#1e2d7d] text-[#1e2d7d] bg-white hover:bg-[#f0f2f8] font-semibold px-6 py-3 rounded-lg transition-colors text-center"
                                >
                                    Оформити з дизайнером
                                </button>
                            </div>
                        </div>

                        {/* RIGHT: Video */}
                        <div className="order-1 lg:order-2">
                            <div className="aspect-[4/5] bg-[#f0f2f8] rounded-xl overflow-hidden shadow-lg border border-gray-200 flex items-center justify-center relative">
                                <div className="text-center">
                                    <Play size={48} className="mx-auto mb-2 text-[#1e2d7d]" />
                                    <span className="text-[#1e2d7d] text-sm font-medium">Відео буде додано</span>
                                </div>
                                {/* <video autoPlay muted loop playsInline className="w-full h-full object-cover">
                                    <source src="/videos/magazine-preview.mp4" type="video/mp4" />
                                </video> */}
                            </div>
                        </div>

                    </div>
                </motion.div>

            </div>

            {/* Configuration Modals */}
            <DesignerConfigModal
                isOpen={photobookModalOpen}
                onClose={() => setPhotobookModalOpen(false)}
                productType="photobook"
                productName="Фотокнига"
            />

            <DesignerConfigModal
                isOpen={magazineModalOpen}
                onClose={() => setMagazineModalOpen(false)}
                productType="magazine"
                productName="Глянцевий журнал"
            />
        </section>
    );
}
