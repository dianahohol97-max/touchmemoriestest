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
        <section ref={ref} style={{
            padding: '120px 20px 40px',
            backgroundColor: style.bg_color || '#fff',
            borderRadius: style.border_radius || '0px'
        }}>
            <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
                <div className="text-center mb-24">
                    <h2 className="text-[32px] lg:text-[44px] font-extrabold leading-tight tracking-tight text-primary mb-6">
                        {title}
                    </h2>
                    <p className="text-[16px] lg:text-[18px] text-primary/60 max-w-2xl mx-auto font-body leading-relaxed">
                        {content['how_subtitle'] || 'Три простих кроки до вашої ідеальної фотокниги'}
                    </p>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '40px' }}>
                    {steps.map((step, index) => (
                        <motion.div
                            key={index}
                            initial={{ opacity: 0, y: 30 }}
                            animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
                            transition={{ duration: 0.8, delay: index * 0.1, ease: [0.23, 1, 0.32, 1] }}
                            className="text-center p-12 rounded-brand bg-white border border-black/[0.03] shadow-[0_20px_40px_rgba(0,0,0,0.03)] hover:shadow-[0_30px_60px_rgba(0,0,0,0.08)] transition-all group"
                        >
                            <div className="w-16 h-16 bg-primary text-white rounded-brand flex items-center justify-center mx-auto mb-10 shadow-[0_10px_20px_rgba(38,58,153,0.15)] group-hover:scale-110 group-hover:shadow-[0_15px_30px_rgba(38,58,153,0.3)] transition-all">
                                {step.icon}
                            </div>
                            <h3 className="text-[20px] font-extrabold mb-4 text-primary tracking-tight">{step.title}</h3>
                            <p className="text-[15px] text-primary/60 leading-relaxed font-body">{step.description}</p>
                        </motion.div>
                    ))}
                </div>
            </div>
        </section>
    );
}
