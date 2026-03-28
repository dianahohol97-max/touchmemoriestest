'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import { GiftQuiz } from './GiftQuiz';

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
  const [quizOpen, setQuizOpen] = useState(false);
  const { ref, inView } = useInView({ triggerOnce: true, threshold: 0.1 });

  const heading  = sectionContent?.heading  || '\u041d\u0435 \u0437\u043d\u0430\u0454\u0448 \u0449\u043e \u043e\u0431\u0440\u0430\u0442\u0438 \u043d\u0430 \u043f\u043e\u0434\u0430\u0440\u0443\u043d\u043e\u043a?';
  const subheading = sectionContent?.subheading || '\u041f\u0440\u043e\u0439\u0434\u0438 \u0448\u0432\u0438\u0434\u043a\u0438\u0439 \u0442\u0435\u0441\u0442 \u0456 \u043e\u0442\u0440\u0438\u043c\u0430\u0439 \u043f\u0435\u0440\u0441\u043e\u043d\u0430\u043b\u044c\u043d\u0456 \u0440\u0435\u043a\u043e\u043c\u0435\u043d\u0434\u0430\u0446\u0456\u0457 \u0434\u043b\u044f \u0442\u0432\u043e\u0433\u043e \u043e\u0441\u043e\u0431\u043b\u0438\u0432\u043e\u0433\u043e \u0432\u0438\u043f\u0430\u0434\u043a\u0443';
  const ctaText  = sectionContent?.cta_text  || '\u041f\u0440\u043e\u0439\u0442\u0438 \u0442\u0435\u0441\u0442';
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
                  borderRadius: '9999px',
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
