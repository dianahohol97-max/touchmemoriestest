'use client';
import { motion } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import Image from 'next/image';

const EXAMPLES = [
    {
        id: '1',
        title: 'Весільні спогади',
        image: 'https://images.unsplash.com/photo-1513519245088-0e12902e5a38?q=80&w=1200',
        description: 'Розкішний шовк та преміальний друк'
    },
    {
        id: '2',
        title: 'Подорож до Альп',
        image: 'https://images.unsplash.com/photo-1493246507139-91e8bef99c1e?q=80&w=1200',
        description: 'Панорамні розвороти для великих моментів'
    },
    {
        id: '3',
        title: 'Сімейний архів',
        image: 'https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?q=80&w=1200',
        description: 'Класика, що зберігається десятиліттями'
    },
    {
        id: '4',
        title: 'Перший рік малюка',
        image: 'https://images.unsplash.com/photo-1470770841072-f978cf4d019e?q=80&w=1200',
        description: 'Кожна деталь має значення'
    }
];

export function RealExamples() {
    const { ref, inView } = useInView({
        triggerOnce: true,
        threshold: 0.1,
    });

    return (
        <section ref={ref} className="section-padding bg-premium-subtle">
            <div className="container">
                <div className="mb-24 text-center">
                    <h2 className="section-title">Магічне перетворення</h2>
                    <p className="section-subtitle">Подивіться, як ваші цифрові фото стають справжніми витворами мистецтва в руках майстрів Touch.Memories</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                    {EXAMPLES.map((item, idx) => (
                        <motion.div
                            key={item.id}
                            initial={{ opacity: 0, y: 30 }}
                            animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
                            transition={{ duration: 0.8, delay: idx * 0.2 }}
                            className="group relative overflow-hidden rounded-brand shadow-[var(--shadow-premium)] hover:shadow-[var(--shadow-hover)] transition-all"
                        >
                            <div className="relative aspect-[16/10] overflow-hidden">
                                <Image
                                    src={item.image}
                                    alt={item.title}
                                    fill
                                    className="object-cover transition-transform duration-1000 group-hover:scale-105"
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-primary/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                            </div>
                            <div className="absolute bottom-0 left-0 right-0 p-12 translate-y-4 group-hover:translate-y-0 opacity-0 group-hover:opacity-100 transition-all duration-500">
                                <h3 className="text-white text-2xl font-bold mb-2">{item.title}</h3>
                                <p className="text-white/80 text-sm font-body">{item.description}</p>
                            </div>
                        </motion.div>
                    ))}
                </div>
            </div>
        </section>
    );
}
