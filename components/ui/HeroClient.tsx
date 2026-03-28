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

const REFERENCE_BG = 'https://lh3.googleusercontent.com/aida-public/AB6AXuAi6aUgQKQ9hSFhflZSGt68udg-k8aOkxZO9iYck0N6AeNbVuvpGYFq9TP1xG4LwI3jR1PLlGYTs1FvlfnrlEn94z5bAGwGRmnyf7uLwe0uj4o0AosWr_8bEhrJLN_UANMkWGowF755IUoZk8LQt6tj4VdxfAdhPWhef_cqqUq65-Sh34vOTUmHtyHBZEzh_MRZrYHLHusTjEIqt9WaZiw_cRCMafyN14MBI8XLJ8EgWkL90uMWITtKCm1RIjpzGs3uLe4cH2oP4Ow';

const DEFAULT_PILLS = [
  { id: '1', button_text: 'Фотокнига', button_url: '/catalog' },
  { id: '2', button_text: 'Глянцевий журнал', button_url: '/catalog' },
  { id: '3', button_text: 'Журнал з твердою обкладинкою', button_url: '/catalog' },
  { id: '4', button_text: 'Тревелбук', button_url: '/catalog' },
  { id: '5', button_text: 'Фотодрук', button_url: '/catalog' },
  { id: '6', button_text: 'Фотомагніти', button_url: '/catalog' },
];

export function HeroClient({ heroContent, heroButtons, siteContent = {} }: HeroClientProps) {
  const { content } = useTheme();

  const overlineText =
    heroContent?.overline_text ||
    siteContent['hero_overline'] ||
    content['hero_overline'] ||
    "Створено з любов'ю";

  const title =
    heroContent
      ? ((heroContent.title_line1 || '') + ' ' + (heroContent.title_line2 || '')).trim()
      : 'Доторкнись до спогадів';

  const bgImage =
    heroContent?.background_image_url ||
    siteContent['hero_image_url'] ||
    content['hero_image_url'] ||
    REFERENCE_BG;

  const ctaText = siteContent['hero_cta_text'] || content['hero_cta_text'] || 'Переглянути каталог';
  const ctaUrl  = siteContent['hero_cta_url']  || content['hero_cta_url']  || '/catalog';
  const pills = heroButtons.length > 0 ? heroButtons : DEFAULT_PILLS;

  return (
    <header className="relative h-[921px] w-full flex items-end overflow-hidden">
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url('${bgImage}')` }}
      />
      <div
        className="absolute inset-0"
        style={{ background: 'linear-gradient(to bottom, rgba(2, 16, 100, 0) 60%, rgba(2, 16, 100, 0.8) 100%)' }}
      />
      <div className="relative z-10 w-full max-w-[1440px] mx-auto px-8 pb-20 text-white">
        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: easing }}
          className="font-heading font-bold tracking-widest uppercase text-sm mb-4 opacity-90"
        >
          {overlineText}
        </motion.p>

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: easing, delay: 0.1 }}
          className="font-heading font-extrabold text-6xl md:text-8xl leading-none tracking-tighter mb-12 max-w-4xl text-white"
        >
          {title}
        </motion.h1>

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
              className="px-6 py-2 rounded-full border border-white/30 bg-white/10 backdrop-blur-md text-sm font-semibold hover:bg-white/20 transition-colors text-white"
            >
              {pill.button_text}
            </Link>
          ))}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: easing, delay: 0.4 }}
        >
          <Link
            href={ctaUrl}
            className="inline-flex items-center bg-primary-container text-white px-10 py-4 rounded-full font-bold text-lg hover:bg-primary transition-all duration-300 hover:scale-105 active:scale-95 shadow-lg"
          >
            {ctaText}
          </Link>
        </motion.div>
      </div>
    </header>
  );
}
