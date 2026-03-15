'use client';
import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import { Star } from 'lucide-react';
import { useTheme } from '@/components/providers/ThemeProvider';

const testimonials = [
    {
        name: 'Марина О.',
        text: 'Фотокнига просто неймовірна! Якість друку та паперу на найвищому рівні. Дякую за збережені спогади!',
        rating: 5,
        city: 'Київ',
    },
    {
        name: 'Андрій К.',
        text: 'Дуже зручний конструктор. Зробив книгу за годину, а результат перевершив очікування. Рекомендую!',
        rating: 5,
        city: 'Львів',
    },
    {
        name: 'Олена С.',
        text: 'Замовляла глянцевий журнал про нашу подорож. Це найкращий подарунок для чоловіка! Швидка доставка.',
        rating: 5,
        city: 'Одеса',
    },
    {
        name: 'Вікторія П.',
        text: 'Прекрасна якість палітурки. Книга виглядає дуже дорого та стильно. Буду замовляти ще!',
        rating: 5,
        city: 'Дніпро',
    }
];

export function Testimonials() {
    const { content } = useTheme();
    const { ref, inView } = useInView({ triggerOnce: true, threshold: 0.1 });

    const activeTestimonials = useMemo(() => {
        const custom = content['testimonials_json'];
        if (custom) {
            try {
                return JSON.parse(custom);
            } catch (e) {
                console.error('Failed to parse testimonials_json', e);
            }
        }
        return testimonials;
    }, [content['testimonials_json']]);

    return (
        <section ref={ref} style={{ padding: '120px 20px', backgroundColor: '#fcfcfc' }}>
            <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
                <div style={{ textAlign: 'center', marginBottom: '80px' }}>
                    <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: 'clamp(32px, 5vw, 48px)', fontWeight: 900, marginBottom: '16px' }}>
                        {content['testimonials_title'] || 'Відгуки клієнтів'}
                    </h2>
                    <p style={{ color: '#666', fontSize: '18px', maxWidth: '600px', margin: '0 auto' }}>
                        {content['testimonials_subtitle'] || 'Що кажуть про нас ті, хто вже замовив свою історію'}
                    </p>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '32px' }}>
                    {activeTestimonials.map((t: any, index: number) => (
                        <motion.div
                            key={index}
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={inView ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.95 }}
                            transition={{ duration: 0.6, delay: index * 0.15 }}
                            style={{ backgroundColor: 'white', padding: '32px', borderRadius: '3px', boxShadow: '0 4px 20px rgba(0,0,0,0.02)', border: '1px solid #f0f0f0' }}
                        >
                            <div style={{ display: 'flex', gap: '4px', marginBottom: '16px', color: '#F59E0B' }}>
                                {[...Array(t.rating || 5)].map((_, i) => <Star key={i} size={16} fill="currentColor" />)}
                            </div>
                            <p style={{ fontSize: '16px', color: '#333', lineHeight: 1.7, marginBottom: '24px', fontStyle: 'italic' }}>
                                "{t.text}"
                            </p>
                            <div>
                                <div style={{ fontWeight: 800, fontSize: '15px' }}>{t.name}</div>
                                <div style={{ fontSize: '13px', color: '#888' }}>{t.city}</div>
                            </div>
                        </motion.div>
                    ))}
                </div>
            </div>
        </section>
    );
}
