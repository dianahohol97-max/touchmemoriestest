'use client';
import { motion } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import Image from 'next/image';
import Link from 'next/link';

const IDEAS = [
    {
        id: 'travel',
        title: 'Для мандрівників',
        subtitle: 'Збережіть кожне місто, кожен краєвид у панорамному альбомі.',
        image: 'https://images.unsplash.com/photo-1488646953014-85cb44e25828?q=80&w=800',
        cta: 'Створити Travel Book',
        link: '/catalog/travel-books'
    },
    {
        id: 'family',
        title: 'Сімейне дерево',
        subtitle: 'Історія поколінь, захована в преміальному текстилі.',
        image: 'https://images.unsplash.com/photo-1511895426328-dc8714191300?q=80&w=800',
        cta: 'Оглянути альбоми',
        link: '/catalog/family-albums'
    },
    {
        id: 'gift',
        title: 'Ідеальний дарунок',
        subtitle: 'Сертифікати на друк емоцій — подарунок, що не тьмяніє.',
        image: 'https://images.unsplash.com/photo-1549465220-1d8c9d9c6703?q=80&w=800',
        cta: 'Детальніше',
        link: '/catalog/gifts'
    }
];

export function GiftIdeas() {
    const { ref, inView } = useInView({
        triggerOnce: true,
        threshold: 0.1,
    });

    return (
        <section ref={ref} className="section-padding bg-premium-gradient">
            <div className="container">
                <div className="max-w-3xl mb-24">
                    <h2 className="section-title text-left">Мистецтво дарування</h2>
                    <p className="section-subtitle text-left m-0">Знайдіть натхнення для особливих моментів життя. Ми створили колекції, які допоможуть вам обрати найкращий спосіб зберегти спогади.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-16">
                    {IDEAS.map((idea, idx) => (
                        <motion.div
                            key={idea.id}
                            initial={{ opacity: 0, y: 30 }}
                            animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
                            transition={{ duration: 0.8, delay: idx * 0.2 }}
                            className="flex flex-col gap-8 group"
                        >
                            <div className="relative aspect-[3/4] overflow-hidden rounded-brand shadow-[var(--shadow-premium)] group-hover:shadow-[var(--shadow-hover)] transition-all">
                                <Image
                                    src={idea.image}
                                    alt={idea.title}
                                    fill
                                    className="object-cover transition-transform duration-1000 group-hover:scale-110"
                                />
                            </div>
                            <div className="flex flex-col gap-4">
                                <h3 className="text-2xl font-bold text-primary">{idea.title}</h3>
                                <p className="text-[15px] text-primary/60 leading-relaxed font-body">{idea.subtitle}</p>
                                <Link
                                    href={idea.link}
                                    className="text-[11px] font-black uppercase tracking-[0.3em] text-primary mt-4 flex items-center gap-4 group-hover:gap-6 transition-all no-underline"
                                >
                                    {idea.cta} <span className="text-xl font-light">→</span>
                                </Link>
                            </div>
                        </motion.div>
                    ))}
                </div>
            </div>
        </section>
    );
}
