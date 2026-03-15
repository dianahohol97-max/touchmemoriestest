'use client';
import { motion } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import { Upload, Edit3, Truck } from 'lucide-react';
import { useTheme } from '@/components/providers/ThemeProvider';
import { DynamicText } from './DynamicText';

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
        <section
            ref={ref}
            className="section-padding bg-gray-50/50 relative overflow-hidden"
            style={{
                borderRadius: style.border_radius || '0px'
            }}
        >
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary/10 to-transparent" />

            <div className="container text-center">
                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 1, ease: [0.23, 1, 0.32, 1] }}
                >
                    <h2 className="section-title text-center max-w-3xl mx-auto mb-10">
                        Створити свою фотокнигу легко
                    </h2>
                </motion.div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-12 text-left mb-20">
                    {steps.map((step, index) => (
                        <motion.div
                            key={index}
                            initial={{ opacity: 0, y: 30 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.8, delay: index * 0.2, ease: [0.23, 1, 0.32, 1] }}
                            className="group relative p-12 bg-white rounded-brand shadow-[var(--shadow-premium)] hover:shadow-[var(--shadow-hover)] transition-all hover:translate-y-[-8px] flex flex-col items-start min-h-[320px]"
                        >
                            <span className="text-[64px] font-black text-primary/5 absolute top-4 right-8 select-none group-hover:text-primary/10 transition-colors">
                                0{index + 1}
                            </span>
                            <div className="w-16 h-16 bg-primary text-white rounded-brand flex items-center justify-center mb-10 shadow-lg shadow-primary/20 group-hover:scale-110 transition-transform duration-500">
                                <span className="text-2xl">{step.icon}</span>
                            </div>

                            <h3 className="text-2xl font-black text-primary mb-5 m-0 tracking-tight leading-none">{step.title}</h3>
                            <div className="absolute -top-12 -left-6 text-[120px] font-black text-primary/10 select-none pointer-events-none transition-colors group-hover:text-primary/15">
                                {`0${index + 1}`}
                            </div>
                            <p className="text-[15px] text-primary/40 font-body leading-relaxed m-0">
                                {step.description}
                            </p>
                        </motion.div>
                    ))}
                </div>
            </div>
        </section>
    );
}
