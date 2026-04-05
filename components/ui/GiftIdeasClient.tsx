'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import { GiftQuiz } from './GiftQuiz';
import { useT } from '@/lib/i18n/context';

type GiftCollection = {
  id: string;
  slug: string;
  label: string;
  label_uk: string;
  emoji: string | null;
  sort_order: number;
  is_active: boolean;
};

interface SectionContent {
  heading: string | null;
  subheading: string | null;
  body_text: string | null;
  cta_text: string | null;
  cta_url: string | null;
  metadata: any;
}

interface GiftIdeasClientProps {
  collections: GiftCollection[];
  sectionContent?: SectionContent;
}

export function GiftIdeasClient({ collections, sectionContent }: GiftIdeasClientProps) {
  const t = useT();
  const [quizOpen, setQuizOpen] = useState(false);
  const { ref, inView } = useInView({ triggerOnce: true, threshold: 0.1 });

  const heading  = sectionContent?.heading  || t('gift_ideas.heading');
  const subheading = sectionContent?.subheading || t('gift_ideas.subheading');
  const ctaText  = sectionContent?.cta_text  || t('gift_ideas.cta');
  const quizEnabled = sectionContent?.metadata?.quiz_enabled !== false;

  return (
    <section ref={ref} className="py-20 px-4 bg-[#f1f3fb]">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={inView ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.7, ease: [0.23, 1, 0.32, 1] }}
        className="max-w-5xl mx-auto"
      >
        {/* Navy card — exact reference */}
        <div
          className="relative overflow-hidden text-center px-8 py-16 md:px-20 md:py-20"
          style={{
            background: '#1e2d7d',
            borderRadius: '20px',
          }}
        >
          {/* Decorative glow top-right */}
          <div
            style={{
              position: 'absolute',
              top: 0,
              right: 0,
              width: '260px',
              height: '260px',
              borderRadius: '50%',
              background: 'rgba(61,86,196,0.3)',
              filter: 'blur(80px)',
              pointerEvents: 'none',
            }}
          />

          <div className="relative z-10">
            {/* Heading */}
            <h2
              className="font-heading font-bold mb-6"
              style={{ color: '#ffffff', fontSize: 'clamp(1.8rem, 4vw, 2.8rem)', lineHeight: 1.2, letterSpacing: '-0.02em' }}
            >
              {heading}
            </h2>

            {/* Subheading */}
            <p
              className="mb-12 mx-auto"
              style={{ color: 'rgba(255,255,255,0.75)', fontSize: '1.1rem', lineHeight: 1.6, maxWidth: '560px' }}
            >
              {subheading}
            </p>

            {/* CTA — white pill button */}
            {quizEnabled && (
              <button
                onClick={() => setQuizOpen(true)}
                className="font-heading font-bold transition-all duration-200 hover:scale-105 active:scale-95"
                style={{
                  background: '#ffffff',
                  color: '#1e2d7d',
                  padding: '1rem 3rem',
                  borderRadius: '10px',
                  fontSize: '1.1rem',
                  border: 'none',
                  cursor: 'pointer',
                  boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
                }}
              >
                {ctaText}
              </button>
            )}
          </div>
        </div>
      </motion.div>

      {quizEnabled && (
        <GiftQuiz open={quizOpen} onOpenChange={setQuizOpen} />
      )}
    </section>
  );
}
