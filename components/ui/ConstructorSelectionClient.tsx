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
    const magazinesConstructorUrl = sectionContent?.metadata?.magazines?.constructor_url || '/order/book?product=personalized-glossy-magazine';
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

                            {/* Constructor visualization — photobook editor mockup */}
                            <div className="rounded-xl overflow-hidden border border-[#263a99]/15 shadow-md" style={{background:'#f4f6fb'}}>
                                <svg viewBox="0 0 480 320" xmlns="http://www.w3.org/2000/svg" style={{display:'block',width:'100%'}}>
                                    {/* Top bar */}
                                    <rect width="480" height="36" fill="#fff"/>
                                    <rect x="12" y="10" width="60" height="16" rx="4" fill="#e2e8f0"/>
                                    <rect x="82" y="10" width="90" height="16" rx="4" fill="#f0f3ff"/>
                                    <rect x="390" y="8" width="80" height="20" rx="8" fill="#1e2d7d"/>
                                    <rect width="480" height="1" y="36" fill="#e2e8f0"/>
                                    {/* Left panel */}
                                    <rect x="0" y="37" width="64" height="283" fill="#fff"/>
                                    <rect x="8" y="50" width="48" height="38" rx="4" fill="#f0f3ff"/>
                                    <rect x="16" y="58" width="32" height="4" rx="2" fill="#1e2d7d" opacity="0.5"/>
                                    <rect x="16" y="66" width="24" height="3" rx="1.5" fill="#94a3b8"/>
                                    <rect x="8" y="96" width="48" height="38" rx="4" fill="#f8fafc"/>
                                    <rect x="16" y="104" width="32" height="4" rx="2" fill="#94a3b8"/>
                                    <rect x="16" y="112" width="24" height="3" rx="1.5" fill="#cbd5e1"/>
                                    <rect x="8" y="142" width="48" height="38" rx="4" fill="#f8fafc"/>
                                    <rect x="16" y="150" width="32" height="4" rx="2" fill="#94a3b8"/>
                                    <rect x="63" y="37" width="1" height="283" fill="#e2e8f0"/>
                                    {/* Photo strip left */}
                                    <rect x="64" y="37" width="90" height="283" fill="#fff"/>
                                    <rect x="72" y="48" width="74" height="52" rx="4" fill="#e2e8f0"/>
                                    <rect x="72" y="108" width="74" height="52" rx="4" fill="#dbeafe"/>
                                    <rect x="78" y="114" width="62" height="40" rx="2" fill="#93c5fd" opacity="0.6"/>
                                    <rect x="72" y="168" width="74" height="52" rx="4" fill="#e2e8f0"/>
                                    <rect x="72" y="228" width="74" height="52" rx="4" fill="#fef9c3"/>
                                    <rect x="78" y="234" width="62" height="40" rx="2" fill="#fde047" opacity="0.5"/>
                                    <rect x="153" y="37" width="1" height="283" fill="#e2e8f0"/>
                                    {/* Spread canvas */}
                                    <rect x="154" y="44" width="230" height="265" rx="4" fill="#fff" filter="url(#shadow)"/>
                                    {/* Left page */}
                                    <rect x="154" y="44" width="114" height="265" rx="4" fill="#fff"/>
                                    <rect x="160" y="52" width="100" height="140" rx="3" fill="#f0f9ff"/>
                                    <rect x="164" y="56" width="92" height="132" rx="2" fill="#bae6fd" opacity="0.7"/>
                                    <rect x="160" y="200" width="60" height="6" rx="3" fill="#1e2d7d" opacity="0.3"/>
                                    <rect x="160" y="212" width="80" height="4" rx="2" fill="#e2e8f0"/>
                                    <rect x="160" y="220" width="70" height="4" rx="2" fill="#e2e8f0"/>
                                    {/* Spine */}
                                    <rect x="267" y="44" width="4" height="265" fill="#e2e8f0"/>
                                    {/* Right page */}
                                    <rect x="271" y="44" width="113" height="265" rx="4" fill="#fff"/>
                                    <rect x="277" y="52" width="50" height="70" rx="3" fill="#fef3c7"/>
                                    <rect x="281" y="56" width="42" height="62" rx="2" fill="#fde047" opacity="0.6"/>
                                    <rect x="331" y="52" width="47" height="70" rx="3" fill="#f0fdf4"/>
                                    <rect x="335" y="56" width="39" height="62" rx="2" fill="#86efac" opacity="0.6"/>
                                    <rect x="277" y="130" width="101" height="100" rx="3" fill="#f8fafc"/>
                                    <rect x="281" y="134" width="93" height="92" rx="2" fill="#c7d2fe" opacity="0.5"/>
                                    <rect x="277" y="238" width="60" height="5" rx="2.5" fill="#1e2d7d" opacity="0.25"/>
                                    <rect x="277" y="248" width="80" height="4" rx="2" fill="#e2e8f0"/>
                                    {/* Right panel */}
                                    <rect x="384" y="37" width="96" height="283" fill="#fff"/>
                                    <rect x="384" y="37" width="1" height="283" fill="#e2e8f0"/>
                                    <rect x="392" y="50" width="78" height="16" rx="3" fill="#f1f5f9"/>
                                    <rect x="392" y="72" width="36" height="36" rx="4" fill="#f0f3ff"/>
                                    <rect x="432" y="72" width="36" height="36" rx="4" fill="#f8fafc"/>
                                    <rect x="392" y="114" width="36" height="36" rx="4" fill="#f8fafc"/>
                                    <rect x="432" y="114" width="36" height="36" rx="4" fill="#f8fafc"/>
                                    <rect x="392" y="156" width="78" height="16" rx="3" fill="#f1f5f9"/>
                                    <rect x="392" y="178" width="78" height="6" rx="3" fill="#e2e8f0"/>
                                    <rect x="392" y="190" width="60" height="6" rx="3" fill="#e2e8f0"/>
                                    <defs>
                                        <filter id="shadow" x="-5%" y="-5%" width="110%" height="110%">
                                            <feDropShadow dx="0" dy="2" stdDeviation="4" floodColor="#1e2d7d" floodOpacity="0.08"/>
                                        </filter>
                                    </defs>
                                </svg>
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
