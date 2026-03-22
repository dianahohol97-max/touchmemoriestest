'use client';
import { motion } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import { useTheme } from '@/components/providers/ThemeProvider';

export function HowItWorks() {
    const { ref, inView } = useInView({ triggerOnce: true, threshold: 0.1 });
    const { content, blocks } = useTheme();
    const block = blocks.find(b => b.block_name === 'how_it_works');
    const style = block?.style_metadata || {};

    const features = [
        {
            emoji: null,
            title: 'Преміум якість друку',
            description: 'Fujicolor Crystal Archive, термін зберігання 100+ років',
        },
        {
            emoji: null,
            title: 'Персональний дизайн',
            description: 'Безкоштовний макет у подарунок, необмежені правки',
        }
    ];

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

                {/* 2 cards centered */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
                    {features.map((feature, index) => (
                        <motion.div
                            key={index}
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
