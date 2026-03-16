'use client';
import { motion } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import { Award, Palette, Zap, MapPin, Gem } from 'lucide-react';
import { useTheme } from '@/components/providers/ThemeProvider';

export function HowItWorks() {
    const { ref, inView } = useInView({ triggerOnce: true, threshold: 0.1 });
    const { content, blocks } = useTheme();
    const block = blocks.find(b => b.block_name === 'how_it_works');
    const style = block?.style_metadata || {};

    const features = [
        {
            title: 'Преміум якість друку',
            description: 'Використовуємо найкращий фотопапір та професійне обладнання для ідеального результату.',
            icon: <Award size={32} className="text-primary" />,
        },
        {
            title: 'Персональний дизайн',
            description: 'Створюйте унікальні макети власноруч або довірте це нашим досвідченим дизайнерам.',
            icon: <Palette size={32} className="text-primary" />,
        },
        {
            title: 'Швидке виробництво',
            description: 'Ваше замовлення буде виготовлено та підготовлено до відправки протягом 3-5 робочих днів.',
            icon: <Zap size={32} className="text-primary" />,
        },
        {
            title: 'Доставка по Україні',
            description: 'Надійно пакуємо та доставляємо ваші спогади у будь-який куточок країни.',
            icon: <MapPin size={32} className="text-primary" />,
        },
        {
            title: 'Унікальні продукти',
            description: 'Від класичних фотокниг до глянцевих журналів — ми створюємо те, що дивує.',
            icon: <Gem size={32} className="text-primary" />,
        }
    ];

    return (
        <section
            ref={ref}
            className="section-padding bg-gray-50/30 relative overflow-hidden"
            style={{
                borderRadius: style.border_radius || '0px'
            }}
        >
            <div className="container">
                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    animate={inView ? { opacity: 1, y: 0 } : {}}
                    transition={{ duration: 1, ease: [0.23, 1, 0.32, 1] }}
                    className="text-center mb-16"
                >
                    <h2 className="text-[40px] lg:text-[56px] font-black leading-none tracking-tight text-primary mb-6">
                        Чому варто обрати нас
                    </h2>
                    <div className="w-24 h-1 bg-primary/20 mx-auto rounded-full" />
                </motion.div>

                <div className="flex flex-wrap justify-center gap-6 lg:gap-8">
                    {features.map((feature, index) => (
                        <motion.div
                            key={index}
                            initial={{ opacity: 0, y: 30 }}
                            animate={inView ? { opacity: 1, y: 0 } : {}}
                            transition={{ duration: 0.8, delay: index * 0.1, ease: [0.23, 1, 0.32, 1] }}
                            className="group relative w-full sm:w-[calc(50%-12px)] lg:w-[calc(33.333%-22px)] xl:w-[calc(20%-26px)] bg-white p-10 rounded-[3px] shadow-[var(--card-shadow)] hover:shadow-[var(--card-shadow-hover)] transition-all duration-500 hover:-translate-y-2 flex flex-col items-center text-center border border-gray-100"
                        >
                            <div className="w-16 h-16 bg-primary/5 rounded-[3px] flex items-center justify-center mb-8 group-hover:bg-primary group-hover:text-white transition-all duration-500 transform group-hover:rotate-3">
                                <span className="text-primary group-hover:text-white transition-colors duration-500">
                                    {feature.icon}
                                </span>
                            </div>

                            <h3 className="text-xl font-bold text-primary mb-4 tracking-tight leading-tight">
                                {feature.title}
                            </h3>
                            <p className="text-[14px] text-slate-500 leading-relaxed m-0 font-medium">
                                {feature.description}
                            </p>
                        </motion.div>
                    ))}
                </div>
            </div>

            {/* Background Decorative Elements */}
            <div className="absolute top-0 right-0 w-96 h-96 bg-primary/5 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/2 pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-96 h-96 bg-primary/5 rounded-full blur-[100px] translate-y-1/2 -translate-x-1/2 pointer-events-none" />
        </section>
    );
}
