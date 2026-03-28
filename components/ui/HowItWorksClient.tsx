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
    { id: '1', title: '\u041f\u0440\u0435\u043c\u0456\u0430\u043b\u044c\u043d\u0430 \u044f\u043a\u0456\u0441\u0442\u044c', description: '\u0412\u0438\u043a\u043e\u0440\u0438\u0441\u0442\u043e\u0432\u0443\u0454\u043c\u043e \u043b\u0438\u0448\u0435 \u043a\u0440\u0430\u0449\u0456 \u043c\u0430\u0442\u0435\u0440\u0456\u0430\u043b\u0438 \u0437 \u0406\u0442\u0430\u043b\u0456\u0457 \u0442\u0430 \u042f\u043f\u043e\u043d\u0456\u0457 \u0434\u043b\u044f \u0434\u043e\u0432\u0433\u043e\u0432\u0456\u0447\u043d\u043e\u0441\u0442\u0456 \u0432\u0430\u0448\u0438\u0445 \u0441\u043f\u043e\u0433\u0430\u0434\u0456\u0432.' },
    { id: '2', title: '\u0423\u043d\u0456\u043a\u0430\u043b\u044c\u043d\u0438\u0439 \u0434\u0438\u0437\u0430\u0439\u043d', description: '\u041d\u0430\u0448\u0456 \u0434\u0438\u0437\u0430\u0439\u043d\u0435\u0440\u0438 \u0441\u0442\u0432\u043e\u0440\u044e\u044e\u0442\u044c \u043c\u0430\u043a\u0435\u0442\u0438, \u044f\u043a\u0456 \u043f\u0456\u0434\u043a\u0440\u0435\u0441\u043b\u044e\u044e\u0442\u044c \u043d\u0430\u0441\u0442\u0440\u0456\u0439 \u043a\u043e\u0436\u043d\u043e\u0457 \u0444\u043e\u0442\u043e\u0433\u0440\u0430\u0444\u0456\u0457.' },
    { id: '3', title: '\u0428\u0432\u0438\u0434\u043a\u0430 \u0434\u043e\u0441\u0442\u0430\u0432\u043a\u0430', description: '\u0412\u0456\u0434\u043f\u0440\u0430\u0432\u043b\u044f\u0454\u043c\u043e \u0433\u043e\u0442\u043e\u0432\u0456 \u0432\u0438\u0440\u043e\u0431\u0438 \u043f\u043e \u0432\u0441\u0456\u0439 \u0423\u043a\u0440\u0430\u0457\u043d\u0456 \u0442\u0430 \u0437\u0430 \u043a\u043e\u0440\u0434\u043e\u043d \u0443 \u043d\u0430\u0434\u0456\u0439\u043d\u0456\u0439 \u0443\u043f\u0430\u043a\u043e\u0432\u0446\u0456.' },
  ];

  const rawFeatures = featureCards.length > 0
    ? featureCards.map(c => ({ id: c.id, title: c.title, description: c.description }))
    : defaultFeatures;

  // Show max 3 features for this layout
  const features = rawFeatures.slice(0, 3);

  return (
    <section ref={ref} className="py-24 bg-[#f1f3fb]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Section title */}
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="font-heading font-black text-center mb-16"
          style={{ color: '#1e2d7d', fontSize: 'clamp(1.8rem, 3.5vw, 2.5rem)', letterSpacing: '-0.02em' }}
        >
          \u0427\u043e\u043c\u0443 \u0432\u0430\u0440\u0442\u043e \u043e\u0431\u0440\u0430\u0442\u0438 \u043d\u0430\u0441
        </motion.h2>

        {/* Two-column: features left, photo right */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">

          {/* LEFT — features list */}
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
                  {/* Navy icon box — exact reference style */}
                  <div
                    className="flex-shrink-0 flex items-center justify-center"
                    style={{
                      width: '52px',
                      height: '52px',
                      background: '#1e2d7d',
                      borderRadius: '10px',
                    }}
                  >
                    <Icon size={24} color="#ffffff" strokeWidth={2} />
                  </div>

                  <div>
                    <h3
                      className="font-heading font-bold mb-1"
                      style={{ color: '#1e2d7d', fontSize: '1.15rem' }}
                    >
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

          {/* RIGHT — photo */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={inView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.7, delay: 0.2 }}
          >
            <img
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuD_Cdn1awE3AcBOHi31FkW9Q17N3LTvFwkW9duVLxPCRhc2bGmSCiYsulAy2c6fwpux9vGNJJsM7RoUGNYyQMEFc4WYgRqjQz0xI_TQ7sqjavZlUBH8ufqP8ND4La7ycUQydACQe_X0N0N8f5YFJXvnL2D2rUeNKLhp0oNP7UXiZa1U_bJ-CWqp-6T_tB6TrFse3GauWwOBNTtYxEM7FY_9imCt57F-0u6di3nz7PqL0GIWLc5bFCQ4E0THpj3IUl6vuRgt8qOwL7g"
              alt="Touch Memories workshop"
              style={{
                width: '100%',
                borderRadius: '20px',
                boxShadow: '0 20px 50px rgba(38,58,153,0.12)',
                objectFit: 'cover',
                maxHeight: '480px',
              }}
            />
          </motion.div>

        </div>
      </div>
    </section>
  );
}
