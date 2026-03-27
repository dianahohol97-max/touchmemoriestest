'use client';
import { motion } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import { useTheme } from '@/components/providers/ThemeProvider';

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

export function HowItWorksClient({ featureCards }: HowItWorksClientProps) {
    const { ref, inView } = useInView({ triggerOnce: true, threshold: 0.1 });
    const { content, blocks } = useTheme();
    const block = blocks.find(b => b.block_name === 'how_it_works');
    const style = block?.style_metadata || {};

    // Fallback to hardcoded features if no database content
    const defaultFeatures = [
        {
            id: '1',
            emoji: null,
            title: 'Преміум якість друку',
            description: 'Fujicolor Crystal Archive, термін зберігання 100+ років',
        },
        {
            id: '2',
            emoji: null,
            title: 'Персональний дизайн',
            description: 'Безкоштовний макет у подарунок, необмежені правки',
        },
        {
            id: '3',
            emoji: null,
            title: 'Доступні ціни',
            description: 'Якісний друк за чесною ціною',
        },
        {
            id: '4',
            emoji: null,
            title: 'Понад 20 000 задоволених клієнтів',
            description: 'Нам довіряють свої найдорожчі спогади',
        }
    ];

    const features = featureCards.length > 0
        ? featureCards.map(card => ({
            id: card.id,
            emoji: null,
            title: card.title,
            description: card.description
        }))
        : defaultFeatures;

    return (
        <section
            ref={ref}
            className="py-20 relative overflow-hidden"
            style={{
                borderRadius: style.border_radius || '0px'
            }}
        >
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={inView ? { opacity: 1, y: 0 } : {}}
                    transition={{ duration: 0.6, ease: [0.23, 1, 0.32, 1] }}
                    className="text-center mb-12"
                >
                    <h2 className="text-3xl lg:text-4xl font-black text-[#1e2d7d] mb-4">
                        Чому варто обрати нас
                    </h2>
                </motion.div>

                {/* Grid with dynamic column count based on feature count */}
                <div className={`grid grid-cols-1 md:grid-cols-2 ${features.length >= 4 ? 'lg:grid-cols-4' : features.length === 3 ? 'lg:grid-cols-3' : 'lg:grid-cols-2'} gap-6`}>
                    {features.map((feature, index) => (
                        <motion.div
                            key={feature.id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={inView ? { opacity: 1, y: 0 } : {}}
                            transition={{ duration: 0.6, delay: index * 0.1, ease: [0.23, 1, 0.32, 1] }}
                            className="bg-white rounded-2xl p-8 shadow-sm border border-stone-100 hover:shadow-md hover:-translate-y-1 transition-all duration-300"
                        >
                            <div className="text-4xl mb-4">{feature.emoji}</div>
                            <h3 className="font-bold text-lg text-stone-900 mb-2">{feature.title}</h3>
                            <p className="text-stone-500 text-sm leading-relaxed">{feature.description}</p>
                        </motion.div>
                    ))}
                </div>
            </div>
        </section>
    );
}
