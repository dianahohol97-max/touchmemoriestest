'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { useTheme } from '@/components/providers/ThemeProvider';
import { PRODUCT_IMAGES } from '@/lib/productImages';

const easing = [0.25, 0.46, 0.45, 0.94] as any;

interface HeroContent {
  id: string;
  overline_text: string;
  title_line1: string;
  title_line2: string;
  subtitle: string;
  background_image_url: string;
  is_active: boolean;
}

interface HeroButton {
  id: string;
  button_text: string;
  button_url: string;
  display_order: number;
  row_number: number;
  is_active: boolean;
}

interface HeroClientProps {
  heroContent?: HeroContent;
  heroButtons: HeroButton[];
  siteContent?: Record<string, string>;
}

export function HeroClient({ heroContent, heroButtons, siteContent = {} }: HeroClientProps) {
  const { content, blocks } = useTheme();

  // ── Content from DB / fallback ──────────────────────────────────────────
  const overlineText =
    heroContent?.overline_text ||
    siteContent['hero_overline'] ||
    content['hero_overline'] ||
    "Створено з любов\'ю";

  const titleLine1 =
    heroContent?.title_line1 ||
    siteContent['hero_title_line1'] ||
    content['hero_title_line1'] ||
    'Доторкнись до';

  const titleLine2 =
    heroContent?.title_line2 ||
    siteContent['hero_title_line2'] ||
    content['hero_title_line2'] ||
    'спогадів';

  const bgImage =
    heroContent?.background_image_url ||
    siteContent['hero_image_url'] ||
    content['hero_image_url'] ||
    PRODUCT_IMAGES.hero;

  // ── CTA ─────────────────────────────────────────────────────────────────
  const ctaText = siteContent['hero_cta_text'] || content['hero_cta_text'] || 'Переглянути каталог';
  const ctaUrl  = siteContent['hero_cta_url']  || content['hero_cta_url']  || '/catalog';

  // ── Pills: DB buttons або дефолт ────────────────────────────────────────
  const defaultPills = [
    { id: '1', button_text: 'Фотокнига',                   button_url: '/catalog' },
    { id: '2', button_text: 'Глянцевий журнал',             button_url: '/catalog' },
    { id: '3', button_text: 'Журнал з твердою обкладинкою', button_url: '/catalog' },
    { id: '4', button_text: 'Тревелбук',                    button_url: '/catalog' },
    { id: '5', button_text: 'Фотодрук',                     button_url: '/catalog' },
    { id: '6', button_text: 'Фотомагніти',                  button_url: '/catalog' },
  ];
  const pills = heroButtons.length > 0 ? heroButtons : defaultPills;

  return (
    <header
      className="relative w-full flex items-end overflow-hidden"
      style={{ height: '921px' }}
    >
      {/* Background image */}
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url('${bgImage}')` }}
      />

      {/* Scrim: transparent → deep navy */}
      <div
        className="absolute inset-0"
        style={{
          background: 'linear-gradient(to bottom, rgba(2,16,100,0) 60%, rgba(2,16,100,0.8) 100%)',
        }}
      />

      {/* Content */}
      <div className="relative z-10 w-full max-w-[1440px] mx-auto px-8 pb-20 text-white">

        {/* Eyebrow */}
        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: easing }}
          className="font-heading font-bold uppercase text-sm tracking-widest mb-4 opacity-90"
        >
          {overlineText}
        </motion.p>

        {/* Headline */}
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: easing, delay: 0.1 }}
          className="font-heading font-black leading-none tracking-tighter mb-12 max-w-4xl text-white"
          style={{ fontSize: 'clamp(3.5rem, 8vw, 7rem)' }}
        >
          {titleLine1} {titleLine2}
        </motion.h1>

        {/* Category pills */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: easing, delay: 0.25 }}
          className="flex flex-wrap gap-4 mb-10"
        >
          {pills.map((pill) => (
            <Link
              key={pill.id}
              href={pill.button_url}
              className="px-6 py-2 rounded-full text-sm font-semibold text-white transition-colors duration-200"
              style={{
                border: '1px solid rgba(255,255,255,0.3)',
                background: 'rgba(255,255,255,0.1)',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
              }}
            >
              {pill.button_text}
            </Link>
          ))}
        </motion.div>

        {/* Primary CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: easing, delay: 0.4 }}
        >
          <Link
            href={ctaUrl}
            className="inline-flex items-center font-heading font-bold text-lg text-white rounded-full px-10 py-4 transition-all duration-300 hover:scale-105 active:scale-95 shadow-lg"
            style={{ background: '#1E2F85' }}
          >
            {ctaText}
          </Link>
        </motion.div>

      </div>
    </header>
  );
}
