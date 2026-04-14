'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import Image from 'next/image';
import { useTheme } from '@/components/providers/ThemeProvider';
import { useT } from '@/lib/i18n/context';
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

// Exact reference image — photobook on wooden table
const REFERENCE_BG = 'https://lh3.googleusercontent.com/aida-public/AB6AXuAi6aUgQKQ9hSFhflZSGt68udg-k8aOkxZO9iYck0N6AeNbVuvpGYFq9TP1xG4LwI3jR1PLlGYTs1FvlfnrlEn94z5bAGwGRmnyf7uLwe0uj4o0AosWr_8bEhrJLN_UANMkWGowF755IUoZk8LQt6tj4VdxfAdhPWhef_cqqUq65-Sh34vOTUmHtyHBZEzh_MRZrYHLHusTjEIqt9WaZiw_cRCMafyN14MBI8XLJ8EgWkL90uMWITtKCm1RIjpzGs3uLe4cH2oP4Ow';

// Exact 6 pills from reference with correct category URLs
const REFERENCE_PILLS = [
  { id: '1', text: 'Фотокнига', url: '/catalog?category=photobooks' },
  { id: '2', text: 'Глянцевий журнал', url: '/catalog/personalized-glossy-magazine' },
  { id: '3', text: 'Журнал з твердою обкладинкою', url: '/catalog/fotozhurnal-tverd-obkladynka' },
  { id: '4', text: 'Тревелбук', url: '/catalog/travelbook-20x30' },
  { id: '5', text: 'Книга побажань', url: '/catalog?category=guestbooks' },
  { id: '6', text: 'Фотоальбоми', url: '/catalog?category=photoalbomy-failykovi' },
];

export function HeroClient({ heroContent, heroButtons, siteContent = {} }: HeroClientProps) {
  const { content } = useTheme();
  const t = useT();

  // Category pills — localized
  const pills = [
    { id: '1', text: t('hero.pill_photobook'), url: '/catalog?category=photobooks' },
    { id: '2', text: t('hero.pill_magazine'), url: '/catalog/personalized-glossy-magazine' },
    { id: '3', text: t('hero.pill_magazine_hard'), url: '/catalog/fotozhurnal-tverd-obkladynka' },
    { id: '4', text: t('hero.pill_travelbook'), url: '/catalog/travelbook-20x30' },
    { id: '5', text: t('hero.pill_guestbook'), url: '/catalog?category=guestbooks' },
    { id: '6', text: t('hero.pill_albums'), url: '/catalog?category=photoalbomy-failykovi' },
  ];

  const overlineText =
    heroContent?.overline_text ||
    siteContent['hero_overline'] ||
    content['hero_overline'] ||
    t('hero.created_with_love');

  const bgImage =
    heroContent?.background_image_url ||
    siteContent['hero_image_url'] ||
    content['hero_image_url'] ||
    REFERENCE_BG;

  return (
    <header className="relative h-[921px] w-full flex items-end overflow-hidden">

      {/* Background image — next/image with priority for LCP */}
      <div className="absolute inset-0">
        <Image
          src={bgImage}
          alt=""
          fill
          priority
          fetchPriority="high"
          sizes="100vw"
          style={{ objectFit: 'cover', objectPosition: 'center' }}
        />
      </div>

      {/* Scrim — exact from reference */}
      <div
        className="absolute inset-0"
        style={{ background: 'linear-gradient(to bottom, rgba(2, 16, 100, 0) 60%, rgba(2, 16, 100, 0.8) 100%)' }}
      />

      {/* Content */}
      <div className="relative z-10 w-full max-w-[1440px] mx-auto px-8 pb-20">

        {/* Eyebrow */}
        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: easing }}
          style={{ color: '#ffffff', fontFamily: 'inherit', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', fontSize: '0.875rem', marginBottom: '1rem', opacity: 0.9 }}
        >
          {overlineText}
        </motion.p>

        {/* Headline — white, exact size */}
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: easing, delay: 0.1 }}
          style={{ color: '#ffffff', fontSize: 'clamp(3rem, 8vw, 6rem)', fontWeight: 900, lineHeight: 1, letterSpacing: '-0.04em', marginBottom: '3rem', maxWidth: '56rem' }}
        >
          {t('home.hero_title')}
        </motion.h1>

        {/* Exact 6 pills from reference */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: easing, delay: 0.25 }}
          style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}
        >
          {pills.map((pill) => (
            <Link
              key={pill.id}
              href={pill.url}
              style={{
                padding: '0.5rem 1.5rem',
                borderRadius: '10px',
                border: '1px solid rgba(255,255,255,0.3)',
                background: 'rgba(255,255,255,0.1)',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                color: '#ffffff',
                fontSize: '0.875rem',
                fontWeight: 600,
                textDecoration: 'none',
                transition: 'background 0.2s',
                whiteSpace: 'nowrap',
              }}
            >
              {pill.text}
            </Link>
          ))}
        </motion.div>

        {/* CTA — exact from reference */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: easing, delay: 0.4 }}
        >
          <Link
            href="/catalog"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              background: '#1e2a78',
              color: '#ffffff',
              padding: '0.65rem 1.75rem',
              borderRadius: '10px',
              fontWeight: 700,
              fontSize: '0.95rem',
              textDecoration: 'none',
              transition: 'all 0.3s',
              boxShadow: '0 4px 20px rgba(38,58,153,0.35)',
            }}
          >
            {t('home.hero_cta')}
          </Link>
        </motion.div>

      </div>
    </header>
  );
}
