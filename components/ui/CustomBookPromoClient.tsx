'use client';
import { useT, useLocale } from '@/lib/i18n/context';

import { motion } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import Link from 'next/link';
import { BookOpen, Newspaper, Compass, Images, Gift } from 'lucide-react';

interface SectionContent {
  heading: string | null;
  subheading: string | null;
  body_text: string | null;
  cta_text: string | null;
  cta_url: string | null;
  metadata: any;
}

interface CustomBookPromoClientProps {
  sectionContent?: SectionContent;
}

export function CustomBookPromoClient({
  sectionContent }: CustomBookPromoClientProps) {
    const t = useT();
    const locale = useLocale();
    const productCategories = [
      { Icon: BookOpen,  label: t('nav.photobooks'), href: `/${locale}/category/photobooks` },
      { Icon: Newspaper, label: t('nav.magazines'),   href: `/${locale}/category/hlyantsevi-zhurnaly` },
      { Icon: Compass,   label: 'TravelBook', href: `/${locale}/category/travelbooks` },
      { Icon: Images,    label: t('custom_book.photo_print_label'),  href: `/${locale}/category/prints` },
      { Icon: Gift,      label: t('custom_book.gifts_label'), href: `/${locale}/category/gifts` },
    ];
    
  const { ref, inView } = useInView({ triggerOnce: true, threshold: 0.1 });

  const heading   = sectionContent?.heading   || t('custom_book.default_heading');
  const subheading = sectionContent?.subheading || t('custom_book.default_body');
  const bodyText  = sectionContent?.body_text  || t('custom_book.default_body');
  const ctaText   = sectionContent?.cta_text   || t('custom_book.default_cta');
  const ctaUrl    = sectionContent?.cta_url    || '/catalog';

  return (
    <section ref={ref} className="py-20 bg-[#f1f3fb]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8, ease: [0.25, 0.46, 0.45, 0.94] }}
          className="text-center"
        >
          {/* Heading */}
          <h2 className="font-heading font-black text-[#1e2d7d] leading-tight mb-6"
            style={{ fontSize: 'clamp(1.6rem, 3vw, 2.2rem)', letterSpacing: '-0.02em' }}>
            {heading}
          </h2>

          {/* Description */}
          <p className="text-stone-600 leading-relaxed max-w-3xl mx-auto mb-12"
            style={{ fontSize: '1.05rem', lineHeight: 1.7 }}>
            {bodyText || subheading}
          </p>

          {/* Icons row — exact reference style */}
          <div className="flex flex-wrap justify-center items-center gap-12 lg:gap-16 mb-12">
            {productCategories.map((cat, index) => (
              <motion.div
                key={cat.label}
                initial={{ opacity: 0, y: 20 }}
                animate={inView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.5, delay: index * 0.1 }}
              >
                <Link
                  href={cat.href}
                  className="flex flex-col items-center gap-3 group"
                >
                  {/* Icon — navy color, no circle background */}
                  <div
                    className="flex items-center justify-center"
                    style={{ color: '#1e2d7d', transition: 'transform 0.2s, color 0.2s' }}
                  >
                    <cat.Icon size={44} strokeWidth={1.5} />
                  </div>
                  <span className="font-semibold text-[#1e2d7d]"
                    style={{ fontSize: '0.95rem' }}>
                    {cat.label}
                  </span>
                </Link>
              </motion.div>
            ))}
          </div>

          {/* CTA — outlined pill button */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={inView ? { opacity: 1, scale: 1 } : {}}
            transition={{ duration: 0.5, delay: 0.6 }}
          >
            <Link
              href={ctaUrl}
              className="inline-flex items-center gap-2 text-[#1e2d7d] border-2 border-[#1e2d7d] bg-transparent hover:bg-[#1e2d7d] hover:text-white font-semibold px-8 py-3.5 rounded-full transition-all duration-200"
            >
              {ctaText}
            </Link>
          </motion.div>

        </motion.div>
      </div>
    </section>
  );
}
