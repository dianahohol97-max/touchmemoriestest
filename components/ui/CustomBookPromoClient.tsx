'use client';

import { motion } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import Link from 'next/link';

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

// Material Symbols icon component — exact icons from reference
function MatIcon({ name, size = 40 }: { name: string; size?: number }) {
  return (
    <span
      className="material-symbols-outlined"
      style={{
        fontSize: size + 'px',
        fontVariationSettings: "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 48",
        lineHeight: 1,
      }}
    >
      {name}
    </span>
  );
}

const productCategories = [
  { icon: 'menu_book',                  label: 'Фотокниги', href: '/catalog?category=photobooks' },
  { icon: 'auto_stories',               label: 'Журнали',   href: '/catalog?category=magazines' },
  { icon: 'explore',                    label: 'TravelBook', href: '/catalog/travelbook' },
  { icon: 'photo_library',              label: 'Фотодрук',  href: '/catalog/photo-prints' },
  { icon: 'featured_seasonal_and_gifts',label: 'Подарунки', href: '/catalog?category=gifts' },
];

export function CustomBookPromoClient({ sectionContent }: CustomBookPromoClientProps) {
  const { ref, inView } = useInView({ triggerOnce: true, threshold: 0.1 });

  const heading   = sectionContent?.heading   || 'Фотокниги, журнали та фотовироби з душею';
  const subheading = sectionContent?.subheading || 'Touch.Memories — студія у Тернополі, яка перетворює ваші фотографії на красиві фізичні вироби';
  const bodyText  = sectionContent?.body_text  || 'Фотокниги, глянцеві журнали, тревел-буки, фотодрук та сувеніри — все з преміум якістю та турботою до деталей.';
  const ctaText   = sectionContent?.cta_text   || 'В магазин →';
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
            {subheading}
            {bodyText && bodyText !== subheading && <> {bodyText}</>}
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
                    <MatIcon name={cat.icon} size={44} />
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
