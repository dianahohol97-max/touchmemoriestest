'use client';

import { motion } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import { useTheme } from '@/components/providers/ThemeProvider';
import { Sparkles, PenLine, Truck, Users } from 'lucide-react';

interface FeatureCard {
  id: string;
  title: string;
  description: string;
  icon_name: string | null;
  display_order: number;
  is_active: boolean;
}

interface HowItWorksClientProps {
  featureCards: FeatureCard[];
}

const ICONS = [Sparkles, PenLine, Truck, Users];

export function HowItWorksClient({ featureCards }: HowItWorksClientProps) {
  const { ref, inView } = useInView({ triggerOnce: true, threshold: 0.1 });
  const { content, blocks } = useTheme();

  const defaultFeatures = [
    { id: '1', title: t('home.quality_title'), description: t('home.quality_desc') },
    { id: '2', title: t('home.design_title'), description: t('home.design_desc') },
    { id: '3', title: t('home.delivery_title'), description: t('home.delivery_desc') },
  ];

  const rawFeatures = featureCards.length > 0
    ? featureCards.map(c => ({ id: c.id, title: c.title, description: c.description }))
    : defaultFeatures;

  const features = rawFeatures.slice(0, 3);

  return (
    <section ref={ref} className="py-24 bg-[#f1f3fb]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="font-heading font-black text-center mb-16"
          style={{ color: '#1e2d7d', fontSize: 'clamp(1.8rem, 3.5vw, 2.5rem)', letterSpacing: '-0.02em' }}
        >
          Чому варто обрати нас
        </motion.h2>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">

          <div className="flex flex-col gap-10">
            {features.map((feature, index) => {
              const Icon = ICONS[index] || Sparkles;
              return (
                <motion.div
                  key={feature.id}
                  initial={{ opacity: 0, x: -30 }}
                  animate={inView ? { opacity: 1, x: 0 } : {}}
                  transition={{ duration: 0.6, delay: index * 0.15 }}
                  className="flex gap-6 items-start"
                >
                  <div
                    className="flex-shrink-0 flex items-center justify-center"
                    style={{ width: '52px', height: '52px', background: '#1e2d7d', borderRadius: '10px' }}
                  >
                    <Icon size={24} color="#ffffff" strokeWidth={2} />
                  </div>
                  <div>
                    <h3 className="font-heading font-bold mb-1" style={{ color: '#1e2d7d', fontSize: '1.15rem' }}>
                      {feature.title}
                    </h3>
                    <p style={{ color: '#585C7D', fontSize: '0.95rem', lineHeight: 1.65 }}>
                      {feature.description}
                    </p>
                  </div>
                </motion.div>
              );
            })}
          </div>

          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={inView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.7, delay: 0.2 }}
          >
            <img
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuD_Cdn1awE3AcBOHi31FkW9Q17N3LTvFwkW9duVLxPCRhc2bGmSCiYsulAy2c6fwpux9vGNJJsM7RoUGNYyQMEFc4WYgRqjQz0xI_TQ7sqjavZlUBH8ufqP8ND4La7ycUQydACQe_X0N0N8f5YFJXvnL2D2rUeNKLhp0oNP7UXiZa1U_bJ-CWqp-6T_tB6TrFse3GauWwOBNTtYxEM7FY_9imCt57F-0u6di3nz7PqL0GIWLc5bFCQ4E0THpj3IUl6vuRgt8qOwL7g"
              alt="Touch Memories workshop"
              style={{ width: '100%', borderRadius: '20px', boxShadow: '0 20px 50px rgba(38,58,153,0.12)', objectFit: 'cover', maxHeight: '480px' }}
            />
          </motion.div>

        </div>
      </div>
    </section>
  );
}
