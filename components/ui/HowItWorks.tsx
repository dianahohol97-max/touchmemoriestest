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
                <div style={{ textAlign: 'center', marginBottom: '80px' }}>
                    <h2 style={{
                        fontFamily: 'var(--font-heading)',
                        fontSize: 'clamp(32px, 5vw, 48px)',
                        fontWeight: 900,
                        marginBottom: '16px',
                        color: style.text_color || 'inherit'
                    }}>
                        {title}
                    </h2>
                    <p style={{ color: style.text_color || '#666', fontSize: '18px', maxWidth: '600px', margin: '0 auto', opacity: style.text_color ? 1 : 0.8 }}>
                        {content['how_subtitle'] || 'Три простих кроки до вашої ідеальної фотокниги'}
                    </p>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '40px' }}>
                    {steps.map((step, index) => (
                        <motion.div
                            key={index}
                            initial={{ opacity: 0, y: 30 }}
                            animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
                            transition={{ duration: 0.6, delay: index * 0.2 }}
                            style={{ textAlign: 'center', padding: '40px', borderRadius: '32px', backgroundColor: '#fcfcfc', border: '1px solid #f0f0f0' }}
                        >
                            <div style={{
                                width: '80px',
                                height: '80px',
                                backgroundColor: 'var(--primary)',
                                color: 'white',
                                borderRadius: '24px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                margin: '0 auto 24px',
                                boxShadow: '0 10px 20px rgba(0,0,0,0.1)'
                            }}>
                                {step.icon}
                            </div>
                            <h3 style={{ fontSize: '22px', fontWeight: 800, marginBottom: '16px', color: style.text_color || 'inherit' }}>{step.title}</h3>
                            <p style={{ color: style.text_color || '#666', lineHeight: 1.6, opacity: style.text_color ? 1 : 0.8 }}>{step.description}</p>
                        </motion.div>
                    ))}
                </div>
            </div>
        </section>
    );
}
