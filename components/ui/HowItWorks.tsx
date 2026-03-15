'use client';
import { motion } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import { Upload, Edit3, Truck } from 'lucide-react';
import { useTheme } from '@/components/providers/ThemeProvider';

export function HowItWorks() {
    const { ref, inView } = useInView({ triggerOnce: true, threshold: 0.1 });
    const { content, blocks } = useTheme();
    const block = blocks.find(b => b.block_name === 'how_it_works');
    const style = block?.style_metadata || {};

    const title = content['how_title'] || 'Як це працює';

    const steps = [
        {
            title: content['how_step1_title'] || 'Завантажте фото',
            description: content['how_step1_text'] || 'Оберіть найкращі знімки з телефону, комп’ютера або соцмереж.',
            icon: <Upload size={32} />,
        },
        {
            title: content['how_step2_title'] || 'Створіть макет',
            description: content['how_step2_text'] || 'Використовуйте наш інтуїтивний конструктор для дизайну сторінок.',
            icon: <Edit3 size={32} />,
        },
        {
            title: content['how_step3_title'] || 'Отримайте книгу',
            description: content['how_step3_text'] || 'Ми надрукуємо та доставимо ваше замовлення протягом 3-5 днів.',
            icon: <Truck size={32} />,
        }
    ];

    return (
        <section ref={ref} className="bg-white section-padding px-10">
            <div className="max-w-[1280px] mx-auto">
                <div className="text-center mb-24">
                    <motion.span
                        initial={{ opacity: 0 }}
                        animate={inView ? { opacity: 0.4 } : { opacity: 0 }}
                        className="text-[12px] uppercase tracking-[0.3em] font-extrabold text-primary"
                    >
                        Процес
                    </motion.span>
                    <motion.h2
                        initial={{ opacity: 0, y: 20 }}
                        animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
                        transition={{ duration: 0.6 }}
                        className="mt-4"
                    >
                        {title}
                    </motion.h2>
                    <motion.p
                        initial={{ opacity: 0, y: 20 }}
                        animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
                        transition={{ duration: 0.6, delay: 0.2 }}
                        className="text-primary/60 text-lg max-w-[600px] mx-auto leading-relaxed"
                    >
                        {content['how_subtitle'] || 'Всього три прості кроки до створення вашої ідеальної сімейної реліквії.'}
                    </motion.p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-12 lg:gap-20">
                    {steps.map((step, index) => (
                        <motion.div
                            key={index}
                            initial={{ opacity: 0, y: 30 }}
                            animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
                            transition={{ duration: 0.8, delay: index * 0.2 }}
                            className="flex flex-col items-center text-center group"
                        >
                            <div className="w-16 h-16 bg-primary/5 text-primary rounded-brand flex items-center justify-center mb-10 transition-colors group-hover:bg-primary group-hover:text-white duration-500">
                                {step.icon}
                            </div>
                            <span className="text-[11px] font-black text-primary/20 uppercase tracking-[0.2em] mb-4">
                                Крок {index + 1}
                            </span>
                            <h3 className="text-[22px] font-extrabold mb-4 text-primary leading-tight">{step.title}</h3>
                            <p className="text-primary/60 leading-relaxed font-medium">{step.description}</p>
                        </motion.div>
                    ))}
                </div>
            </div>
        </section>
    );
}
