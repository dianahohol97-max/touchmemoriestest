'use client';
import { motion } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import { Play } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import DesignerConfigModal from '../DesignerConfigModal';

interface SectionContent {
    metadata?: {
        photobooks?: {
            heading: string;
            description: string;
            constructor_url: string;
            constructor_button_text: string;
            designer_button_text: string;
        };
        magazines?: {
            heading: string;
            description: string;
            constructor_url: string;
            constructor_button_text: string;
            designer_button_text: string;
        };
    };
}

interface ConstructorSelectionClientProps {
    sectionContent?: SectionContent;
}

export function ConstructorSelectionClient({ sectionContent }: ConstructorSelectionClientProps) {
    const { ref, inView } = useInView({ triggerOnce: true, threshold: 0.1 });
    const [photobookModalOpen, setPhotobookModalOpen] = useState(false);
    const [magazineModalOpen, setMagazineModalOpen] = useState(false);

    // Photobooks content with fallbacks
    const photobooksHeading = sectionContent?.metadata?.photobooks?.heading || 'Фотокниги';
    const photobooksDescription = sectionContent?.metadata?.photobooks?.description ||
        'Зберіть найкращі моменти у красиву фотокнигу — подарунок, який залишиться на все життя. Обирайте формат, обкладинку та кількість сторінок під свій стиль. Ідеально для весіль, подорожей, сімейних архівів та особливих дат.';
    const photobooksConstructorUrl = sectionContent?.metadata?.photobooks?.constructor_url || '/order/book?product=photobook-velour';
    const photobooksConstructorButtonText = sectionContent?.metadata?.photobooks?.constructor_button_text || 'Відкрити конструктор';
    const photobooksDesignerButtonText = sectionContent?.metadata?.photobooks?.designer_button_text || 'Оформити з дизайнером';

    // Magazines content with fallbacks
    const magazinesHeading = sectionContent?.metadata?.magazines?.heading || 'Глянцеві журнали';
    const magazinesDescription = sectionContent?.metadata?.magazines?.description ||
        'Створіть глянцевий журнал зі своїми фото — стильний і сучасний формат для збереження спогадів. Ідеально для модних зйомок, тематичних подій, подорожей та корпоративних проєктів.';
    const magazinesConstructorUrl = sectionContent?.metadata?.magazines?.constructor_url || '/order/book?product=magazine';
    const magazinesConstructorButtonText = sectionContent?.metadata?.magazines?.constructor_button_text || 'Відкрити конструктор';
    const magazinesDesignerButtonText = sectionContent?.metadata?.magazines?.designer_button_text || 'Оформити з дизайнером';

    console.log('[ConstructorSelectionClient] photobooks URL:', photobooksConstructorUrl);
    console.log('[ConstructorSelectionClient] magazines URL:', magazinesConstructorUrl);

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
                                    {photobooksHeading}
                                </h2>
                                <p className="text-lg text-stone-600 leading-relaxed">
                                    {photobooksDescription}
                                </p>
                            </div>

                            {/* Constructor visualization */}
                            <div className="bg-[#f0f3ff] rounded-md border border-[#263a99]/10 aspect-[4/3] flex items-center justify-center">
                                <span className="text-[#1e2d7d]/60 text-lg font-semibold">Конструктор</span>
                            </div>

                            {/* Buttons */}
                            <div className="flex gap-3 flex-wrap">
                                <Link
                                    href={photobooksConstructorUrl}
                                    className="flex-1 bg-[#1e2d7d] text-white text-center px-6 py-3 rounded-full font-semibold hover:bg-[#263a99] transition-colors duration-200"
                                >
                                    {photobooksConstructorButtonText}
                                </Link>
                                <button
                                    onClick={() => setPhotobookModalOpen(true)}
                                    className="flex-1 border-2 border-[#1e2d7d] text-[#1e2d7d] bg-white hover:bg-[#f0f2f8] font-semibold px-6 py-3 rounded-xl transition-colors text-center"
                                >
                                    {photobooksDesignerButtonText}
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
                                    {magazinesHeading}
                                </h2>
                                <p className="text-lg text-stone-600 leading-relaxed">
                                    {magazinesDescription}
                                </p>
                            </div>

                            {/* Constructor visualization */}
                            <div className="bg-[#f0f3ff] rounded-md border border-[#263a99]/10 aspect-[4/3] flex items-center justify-center">
                                <span className="text-[#1e2d7d]/60 text-lg font-semibold">Конструктор</span>
                            </div>

                            {/* Buttons */}
                            <div className="flex gap-3 flex-wrap">
                                <Link
                                    href={magazinesConstructorUrl}
                                    className="flex-1 bg-[#1e2d7d] text-white text-center px-6 py-3 rounded-full font-semibold hover:bg-[#263a99] transition-colors duration-200"
                                >
                                    {magazinesConstructorButtonText}
                                </Link>
                                <button
                                    onClick={() => setMagazineModalOpen(true)}
                                    className="flex-1 border-2 border-[#1e2d7d] text-[#1e2d7d] bg-white hover:bg-[#f0f2f8] font-semibold px-6 py-3 rounded-xl transition-colors text-center"
                                >
                                    {magazinesDesignerButtonText}
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
