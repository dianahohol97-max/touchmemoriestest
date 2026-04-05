'use client';
import { useT } from '@/lib/i18n/context';
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

export function ConstructorSelectionClient({
  sectionContent }: ConstructorSelectionClientProps) {
    const t = useT();
    const { ref, inView } = useInView({ triggerOnce: true, threshold: 0.1 });
    const [photobookModalOpen, setPhotobookModalOpen] = useState(false);
    const [magazineModalOpen, setMagazineModalOpen] = useState(false);

    // Photobooks content with fallbacks
    const photobooksHeading = sectionContent?.metadata?.photobooks?.heading || t('constructor_sel.photobooks_heading');
    const photobooksDescription = sectionContent?.metadata?.photobooks?.description ||
        t('constructor_sel.photobooks_desc');
    const photobooksConstructorUrl = sectionContent?.metadata?.photobooks?.constructor_url || '/order/book?product=photobook-velour';
    const photobooksConstructorButtonText = sectionContent?.metadata?.photobooks?.constructor_button_text || t('constructor_sel.open_constructor');
    const photobooksDesignerButtonText = sectionContent?.metadata?.photobooks?.designer_button_text || t('constructor_sel.order_designer');

    // Magazines content with fallbacks
    const magazinesHeading = sectionContent?.metadata?.magazines?.heading || t('constructor_sel.magazines_heading');
    const magazinesDescription = sectionContent?.metadata?.magazines?.description ||
        t('constructor_sel.magazines_desc');
    const magazinesConstructorUrl = sectionContent?.metadata?.magazines?.constructor_url || '/order/book?product=personalized-glossy-magazine';
    const magazinesConstructorButtonText = sectionContent?.metadata?.magazines?.constructor_button_text || t('constructor_sel.open_constructor');
    const magazinesDesignerButtonText = sectionContent?.metadata?.magazines?.designer_button_text || t('constructor_sel.order_designer');

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
                                    <span className="text-stone-500 text-sm font-medium">{t('constructor_sel.video_placeholder')}</span>
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

                            {/* Constructor visualization — photobook editor */}
                            <div className="rounded-xl overflow-hidden border border-[#263a99]/15 shadow-md" style={{background:'#f4f6fb'}}>
                                <svg viewBox="0 0 600 340" xmlns="http://www.w3.org/2000/svg" style={{display:'block',width:'100%'}}>
  {/* Фон */}
  <rect width="600" height="340" fill="#f4f6fb"/>

  {/* ── TOPBAR (36px) ── */}
  <rect width="600" height="36" fill="#fff"/>
  <rect x="0" y="35.5" width="600" height="0.5" fill="#e2e8f0"/>
  {/* Кнопка назад */}
  <rect x="10" y="8" width="40" height="20" rx="4" fill="#f8fafc"/>
  <polyline points="28,14 22,18 28,22" fill="none" stroke="#374151" strokeWidth="1.5" strokeLinecap="round"/>
  {/* Назва продукту */}
  <rect x="58" y="11" width="90" height="7" rx="2" fill="#1e2d7d" opacity="0.8"/>
  <rect x="58" y="22" width="60" height="5" rx="1.5" fill="#94a3b8"/>
  {/* Авто + Undo */}
  <rect x="210" y="9" width="44" height="18" rx="5" fill="#fff" stroke="#e2e8f0" strokeWidth="1"/>
  <rect x="215" y="14.5" width="14" height="7" rx="1.5" fill="#c7d2fe"/>
  <rect x="232" y="14" width="18" height="4" rx="1" fill="#1e2d7d" opacity="0.5"/>
  <rect x="260" y="9" width="40" height="18" rx="5" fill="#fff" stroke="#e2e8f0" strokeWidth="1"/>
  <rect x="265" y="14" width="30" height="4" rx="1" fill="#94a3b8"/>
  <rect x="265" y="21" width="20" height="3" rx="1" fill="#e2e8f0"/>
  {/* Ціна */}
  <rect x="460" y="10" width="50" height="16" rx="3" fill="#f0f3ff"/>
  <rect x="465" y="15" width="40" height="6" rx="1.5" fill="#1e2d7d" opacity="0.7"/>
  {/* До кошика */}
  <rect x="516" y="7" width="76" height="22" rx="8" fill="#1e2d7d"/>
  <rect x="526" y="14" width="40" height="8" rx="2" fill="white" opacity="0.85"/>

  {/* ── ICON COL (72px) ── */}
  <rect x="0" y="36" width="72" height="304" fill="#fff"/>
  <rect x="71.5" y="36" width="0.5" height="304" fill="#f1f5f9"/>
  {/* Фото (активна вкладка — синя) */}
  <rect x="8" y="46" width="56" height="46" rx="4" fill="#1e2d7d"/>
  <rect x="22" y="56" width="28" height="20" rx="2" fill="white" opacity="0.25"/>
  <rect x="25" y="78" width="22" height="5" rx="1.5" fill="white" opacity="0.7"/>
  {/* Шаблон */}
  <rect x="8" y="100" width="56" height="46" rx="4" fill="transparent"/>
  <rect x="20" y="113" width="14" height="10" rx="1" fill="#e2e8f0"/>
  <rect x="36" y="113" width="14" height="10" rx="1" fill="#e2e8f0"/>
  <rect x="20" y="125" width="30" height="4" rx="1" fill="#e2e8f0"/>
  <rect x="28" y="137" width="18" height="4" rx="1.5" fill="#94a3b8"/>
  {/* Текст */}
  <rect x="8" y="154" width="56" height="46" rx="4" fill="transparent"/>
  <rect x="18" y="168" width="36" height="5" rx="1.5" fill="#e2e8f0"/>
  <rect x="22" y="177" width="28" height="4" rx="1.5" fill="#e2e8f0"/>
  <rect x="26" y="185" width="20" height="3" rx="1.5" fill="#e2e8f0"/>
  <rect x="30" y="191" width="14" height="4" rx="1.5" fill="#94a3b8"/>
  {/* Фон */}
  <rect x="8" y="208" width="56" height="46" rx="4" fill="transparent"/>
  <rect x="14" y="214" width="44" height="34" rx="3" fill="#f0f3ff" opacity="0.7"/>
  <rect x="18" y="218" width="36" height="26" rx="2" fill="#c7d2fe" opacity="0.5"/>
  <rect x="28" y="242" width="18" height="4" rx="1.5" fill="#94a3b8"/>

  {/* ── LEFT PANEL (200px) ── */}
  <rect x="72" y="36" width="200" height="304" fill="#fff"/>
  <rect x="272" y="36" width="0.5" height="304" fill="#e2e8f0"/>
  {/* Заголовок панелі */}
  <rect x="84" y="44" width="80" height="7" rx="2" fill="#1e2d7d" opacity="0.6"/>
  {/* Кнопка додати фото */}
  <rect x="84" y="58" width="176" height="26" rx="6" fill="#f0f3ff" stroke="#c7d2fe" strokeWidth="1.5" strokeDasharray="4,2"/>
  <rect x="104" y="66" width="16" height="10" rx="2" fill="#c7d2fe"/>
  <rect x="124" y="69" width="70" height="6" rx="2" fill="#1e2d7d" opacity="0.5"/>
  {/* Мініатюри фото */}
  <rect x="84" y="92" width="84" height="64" rx="4" fill="#dbeafe" stroke="#bfdbfe" strokeWidth="1"/>
  <rect x="88" y="96" width="76" height="56" rx="2" fill="#93c5fd" opacity="0.55"/>
  {/* зелений тік — вже використано */}
  <circle cx="162" cy="100" r="7" fill="#10b981"/>
  <polyline points="158,100 161,103 166,97" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
  <rect x="176" y="92" width="84" height="64" rx="4" fill="#fef9c3" stroke="#fde68a" strokeWidth="1"/>
  <rect x="180" y="96" width="76" height="56" rx="2" fill="#fde047" opacity="0.5"/>
  <rect x="84" y="164" width="84" height="64" rx="4" fill="#f0fdf4" stroke="#bbf7d0" strokeWidth="1"/>
  <rect x="88" y="168" width="76" height="56" rx="2" fill="#86efac" opacity="0.5"/>
  <rect x="176" y="164" width="84" height="64" rx="4" fill="#fce7f3" stroke="#fbcfe8" strokeWidth="1"/>
  <rect x="180" y="168" width="76" height="56" rx="2" fill="#f9a8d4" opacity="0.5"/>
  <rect x="84" y="236" width="84" height="64" rx="4" fill="#ede9fe" stroke="#ddd6fe" strokeWidth="1"/>
  <rect x="88" y="240" width="76" height="56" rx="2" fill="#a78bfa" opacity="0.45"/>
  <rect x="176" y="236" width="84" height="64" rx="4" fill="#f1f5f9" stroke="#e2e8f0" strokeWidth="1"/>
  <rect x="180" y="250" width="48" height="28" rx="2" fill="#e2e8f0" opacity="0.8"/>
  <text x="204" y="269" textAnchor="middle" fontSize="10" fill="#94a3b8" fontFamily="sans-serif">+</text>

  {/* ── CANVAS (центр) — розворот фотокниги ── */}
  {/* Сторінка ліва */}
  <rect x="284" y="46" width="138" height="284" rx="3" fill="#fff" stroke="#e8edf5" strokeWidth="1" filter="url(#bs)"/>
  {/* Фото 1/2 на лівій */}
  <rect x="290" y="52" width="126" height="160" rx="2" fill="#dbeafe"/>
  <rect x="294" y="56" width="118" height="152" rx="1" fill="#93c5fd" opacity="0.5"/>
  <rect x="290" y="220" width="56" height="7" rx="2" fill="#1e2d7d" opacity="0.35"/>
  <rect x="290" y="232" width="90" height="4" rx="1.5" fill="#e2e8f0"/>
  <rect x="290" y="240" width="80" height="4" rx="1.5" fill="#e2e8f0"/>
  <rect x="290" y="248" width="70" height="4" rx="1.5" fill="#e2e8f0"/>
  {/* корінець */}
  <rect x="422" y="46" width="4" height="284" fill="#f1f5f9"/>
  {/* Сторінка права */}
  <rect x="426" y="46" width="138" height="284" rx="3" fill="#fff" stroke="#e8edf5" strokeWidth="1" filter="url(#bs)"/>
  {/* 2 фото на правій */}
  <rect x="432" y="52" width="60" height="80" rx="2" fill="#fef9c3"/>
  <rect x="436" y="56" width="52" height="72" rx="1" fill="#fde047" opacity="0.55"/>
  <rect x="498" y="52" width="60" height="80" rx="2" fill="#f0fdf4"/>
  <rect x="502" y="56" width="52" height="72" rx="1" fill="#86efac" opacity="0.55"/>
  <rect x="432" y="140" width="126" height="100" rx="2" fill="#fce7f3"/>
  <rect x="436" y="144" width="118" height="92" rx="1" fill="#f9a8d4" opacity="0.45"/>
  <rect x="432" y="250" width="60" height="5" rx="1.5" fill="#1e2d7d" opacity="0.25"/>
  <rect x="432" y="259" width="90" height="4" rx="1.5" fill="#e2e8f0"/>
  <rect x="432" y="267" width="72" height="4" rx="1.5" fill="#e2e8f0"/>

  <defs>
    <filter id="bs" x="-5%" y="-5%" width="110%" height="110%">
      <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#1e2d7d" floodOpacity="0.07"/>
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

                            {/* Constructor visualization — magazine editor */}
                            <div className="rounded-xl overflow-hidden border border-[#263a99]/15 shadow-md" style={{background:'#f4f6fb'}}>
                                <svg viewBox="0 0 600 340" xmlns="http://www.w3.org/2000/svg" style={{display:'block',width:'100%'}}>
  {/* Фон */}
  <rect width="600" height="340" fill="#f4f6fb"/>

  {/* ── TOPBAR ── */}
  <rect width="600" height="36" fill="#fff"/>
  <rect x="0" y="35.5" width="600" height="0.5" fill="#e2e8f0"/>
  <rect x="10" y="8" width="40" height="20" rx="4" fill="#f8fafc"/>
  <polyline points="28,14 22,18 28,22" fill="none" stroke="#374151" strokeWidth="1.5" strokeLinecap="round"/>
  <rect x="58" y="11" width="100" height="7" rx="2" fill="#7c3aed" opacity="0.75"/>
  <rect x="58" y="22" width="65" height="5" rx="1.5" fill="#94a3b8"/>
  <rect x="210" y="9" width="44" height="18" rx="5" fill="#fff" stroke="#e2e8f0" strokeWidth="1"/>
  <rect x="215" y="14.5" width="14" height="7" rx="1.5" fill="#ede9fe"/>
  <rect x="232" y="14" width="18" height="4" rx="1" fill="#7c3aed" opacity="0.4"/>
  <rect x="460" y="10" width="50" height="16" rx="3" fill="#f5f3ff"/>
  <rect x="465" y="15" width="40" height="6" rx="1.5" fill="#7c3aed" opacity="0.6"/>
  <rect x="516" y="7" width="76" height="22" rx="8" fill="#7c3aed"/>
  <rect x="526" y="14" width="40" height="8" rx="2" fill="white" opacity="0.85"/>

  {/* ── ICON COL ── */}
  <rect x="0" y="36" width="72" height="304" fill="#fff"/>
  <rect x="71.5" y="36" width="0.5" height="304" fill="#f1f5f9"/>
  {/* Фото — активна */}
  <rect x="8" y="46" width="56" height="46" rx="4" fill="#7c3aed"/>
  <rect x="22" y="56" width="28" height="20" rx="2" fill="white" opacity="0.25"/>
  <rect x="25" y="78" width="22" height="5" rx="1.5" fill="white" opacity="0.7"/>
  {/* Шаблон */}
  <rect x="8" y="100" width="56" height="46" rx="4" fill="transparent"/>
  <rect x="18" y="111" width="36" height="24" rx="2" fill="#f5f3ff"/>
  <rect x="20" y="113" width="32" height="20" rx="1" fill="#ddd6fe" opacity="0.6"/>
  <rect x="28" y="141" width="18" height="4" rx="1.5" fill="#94a3b8"/>
  {/* Текст */}
  <rect x="8" y="154" width="56" height="46" rx="4" fill="transparent"/>
  <rect x="18" y="167" width="36" height="5" rx="1.5" fill="#e2e8f0"/>
  <rect x="22" y="176" width="28" height="4" rx="1.5" fill="#ede9fe"/>
  <rect x="30" y="191" width="14" height="4" rx="1.5" fill="#94a3b8"/>
  {/* Фон */}
  <rect x="8" y="208" width="56" height="46" rx="4" fill="transparent"/>
  <rect x="14" y="214" width="44" height="34" rx="3" fill="#f5f3ff" opacity="0.7"/>
  <rect x="18" y="218" width="36" height="26" rx="2" fill="#c4b5fd" opacity="0.4"/>
  <rect x="28" y="242" width="18" height="4" rx="1.5" fill="#94a3b8"/>

  {/* ── LEFT PANEL ── */}
  <rect x="72" y="36" width="200" height="304" fill="#fff"/>
  <rect x="272" y="36" width="0.5" height="304" fill="#e2e8f0"/>
  <rect x="84" y="44" width="80" height="7" rx="2" fill="#7c3aed" opacity="0.5"/>
  <rect x="84" y="58" width="176" height="26" rx="6" fill="#f5f3ff" stroke="#ddd6fe" strokeWidth="1.5" strokeDasharray="4,2"/>
  <rect x="104" y="66" width="16" height="10" rx="2" fill="#c4b5fd"/>
  <rect x="124" y="69" width="70" height="6" rx="2" fill="#7c3aed" opacity="0.4"/>
  {/* Мініатюри — фіолетові тони */}
  <rect x="84" y="92" width="84" height="64" rx="4" fill="#ede9fe" stroke="#ddd6fe" strokeWidth="1"/>
  <rect x="88" y="96" width="76" height="56" rx="2" fill="#a78bfa" opacity="0.5"/>
  <circle cx="162" cy="100" r="7" fill="#10b981"/>
  <polyline points="158,100 161,103 166,97" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
  <rect x="176" y="92" width="84" height="64" rx="4" fill="#fdf4ff" stroke="#f5d0fe" strokeWidth="1"/>
  <rect x="180" y="96" width="76" height="56" rx="2" fill="#f0abfc" opacity="0.45"/>
  <rect x="84" y="164" width="84" height="64" rx="4" fill="#f5f3ff" stroke="#ede9fe" strokeWidth="1"/>
  <rect x="88" y="168" width="76" height="56" rx="2" fill="#c4b5fd" opacity="0.5"/>
  <rect x="176" y="164" width="84" height="64" rx="4" fill="#fce7f3" stroke="#fbcfe8" strokeWidth="1"/>
  <rect x="180" y="168" width="76" height="56" rx="2" fill="#f9a8d4" opacity="0.45"/>
  <rect x="84" y="236" width="84" height="64" rx="4" fill="#f1f5f9" stroke="#e2e8f0" strokeWidth="1"/>
  <rect x="88" y="250" width="48" height="28" rx="2" fill="#e2e8f0" opacity="0.8"/>
  <text x="112" y="269" textAnchor="middle" fontSize="10" fill="#94a3b8" fontFamily="sans-serif">+</text>
  <rect x="176" y="236" width="84" height="64" rx="4" fill="#ede9fe" stroke="#ddd6fe" strokeWidth="1"/>
  <rect x="180" y="240" width="76" height="56" rx="2" fill="#8b5cf6" opacity="0.3"/>

  {/* ── CANVAS — журнальний розворот A4 ── */}
  {/* Ліва A4 сторінка — вертикальна */}
  <rect x="284" y="44" width="150" height="288" rx="3" fill="#fff" stroke="#e8edf5" strokeWidth="1" filter="url(#bsm)"/>
  {/* Повнокадрове фото зверху */}
  <rect x="284" y="44" width="150" height="130" rx="3" fill="#ede9fe"/>
  <rect x="288" y="48" width="142" height="122" rx="2" fill="#a78bfa" opacity="0.45"/>
  {/* Назва матеріалу — великий заголовок */}
  <rect x="292" y="184" width="100" height="10" rx="2" fill="#7c3aed" opacity="0.7"/>
  {/* Текст колонки */}
  <rect x="292" y="200" width="62" height="4" rx="1.5" fill="#e2e8f0"/>
  <rect x="292" y="208" width="62" height="4" rx="1.5" fill="#e2e8f0"/>
  <rect x="292" y="216" width="55" height="4" rx="1.5" fill="#e2e8f0"/>
  <rect x="292" y="224" width="60" height="4" rx="1.5" fill="#e2e8f0"/>
  <rect x="362" y="200" width="62" height="4" rx="1.5" fill="#e2e8f0"/>
  <rect x="362" y="208" width="55" height="4" rx="1.5" fill="#e2e8f0"/>
  <rect x="362" y="216" width="62" height="4" rx="1.5" fill="#e2e8f0"/>
  <rect x="362" y="224" width="50" height="4" rx="1.5" fill="#e2e8f0"/>
  {/* Маленьке фото + текст */}
  <rect x="292" y="236" width="56" height="56" rx="2" fill="#f5f3ff"/>
  <rect x="296" y="240" width="48" height="48" rx="1" fill="#c4b5fd" opacity="0.5"/>
  <rect x="356" y="236" width="68" height="5" rx="1.5" fill="#7c3aed" opacity="0.4"/>
  <rect x="356" y="245" width="62" height="4" rx="1.5" fill="#e2e8f0"/>
  <rect x="356" y="253" width="58" height="4" rx="1.5" fill="#e2e8f0"/>
  <rect x="356" y="261" width="65" height="4" rx="1.5" fill="#e2e8f0"/>
  {/* Корінець */}
  <rect x="434" y="44" width="4" height="288" fill="#f5f3ff"/>
  {/* Права A4 сторінка — більше фото */}
  <rect x="438" y="44" width="150" height="288" rx="3" fill="#fff" stroke="#e8edf5" strokeWidth="1" filter="url(#bsm)"/>
  {/* Велике фото */}
  <rect x="444" y="52" width="136" height="166" rx="2" fill="#fdf4ff"/>
  <rect x="448" y="56" width="128" height="158" rx="1" fill="#e879f9" opacity="0.3"/>
  {/* Підпис під фото */}
  <rect x="444" y="226" width="80" height="9" rx="2" fill="#7c3aed" opacity="0.6"/>
  <rect x="444" y="242" width="130" height="4" rx="1.5" fill="#e2e8f0"/>
  <rect x="444" y="250" width="120" height="4" rx="1.5" fill="#e2e8f0"/>
  <rect x="444" y="258" width="128" height="4" rx="1.5" fill="#e2e8f0"/>
  <rect x="444" y="266" width="100" height="4" rx="1.5" fill="#e2e8f0"/>
  <rect x="444" y="278" width="56" height="4" rx="1.5" fill="#ddd6fe"/>

  <defs>
    <filter id="bsm" x="-5%" y="-5%" width="110%" height="110%">
      <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#7c3aed" floodOpacity="0.07"/>
    </filter>
  </defs>
</svg>
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
                                    <span className="text-[#1e2d7d] text-sm font-medium">{t('constructor_sel.video_placeholder')}</span>
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
