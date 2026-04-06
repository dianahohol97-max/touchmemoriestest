'use client';
import { useT, useLocale } from '@/lib/i18n/context';
import { motion } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import Image from 'next/image';

const EXAMPLE_IMAGES = [
    'https://images.unsplash.com/photo-1513519245088-0e12902e5a38?q=80&w=1200',
    'https://images.unsplash.com/photo-1493246507139-91e8bef99c1e?q=80&w=1200',
    'https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?q=80&w=1200',
    'https://images.unsplash.com/photo-1470770841072-f978cf4d019e?q=80&w=1200',
];
const EXAMPLE_DATA: Record<string, { title: string; description: string }[]> = {
    uk: [{title:'Весільні спогади',description:'Розкішний шовк та преміальний друк'},{title:'Подорож до Альп',description:'Панорамні розвороти для великих моментів'},{title:'Сімейний архів',description:'Класика, що зберігається десятиліттями'},{title:'Перший рік малюка',description:'Кожна деталь має значення'}],
    en: [{title:'Wedding Memories',description:'Luxury silk and premium printing'},{title:'Trip to the Alps',description:'Panoramic spreads for big moments'},{title:'Family Archive',description:'Classics that last for decades'},{title:"Baby's First Year",description:'Every detail matters'}],
    ro: [{title:'Amintiri de Nuntă',description:'Mătase de lux și imprimare premium'},{title:'Călătorie în Alpi',description:'Pagini panoramice'},{title:'Arhiva Familiei',description:'Clasice care durează decenii'},{title:'Primul An',description:'Fiecare detaliu contează'}],
    pl: [{title:'Wspomnienia Weselne',description:'Luksusowy jedwab i druk premium'},{title:'Podróż do Alp',description:'Panoramiczne rozkładówki'},{title:'Archiwum Rodzinne',description:'Klasyka na dziesięciolecia'},{title:'Pierwszy Rok Dziecka',description:'Każdy detal ma znaczenie'}],
    de: [{title:'Hochzeitserinnerungen',description:'Luxuriöse Seide und Premium-Druck'},{title:'Reise in die Alpen',description:'Panoramische Doppelseiten'},{title:'Familienarchiv',description:'Klassiker die Jahrzehnte überdauern'},{title:'Babys Erstes Jahr',description:'Jedes Detail zählt'}],
};

export function RealExamples() {
    const t = useT();
    const locale = useLocale();
    const { ref, inView } = useInView({
        triggerOnce: true,
        threshold: 0.1,
    });

    return (
        <section ref={ref} className="section-padding bg-premium-subtle">
            <div className="container">
                <div className="mb-24 text-center">
                    <h2 className="section-title">{t('examples.title')}</h2>
                    <p className="section-subtitle">{t('examples.subtitle')}</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                    {(EXAMPLE_DATA[locale] || EXAMPLE_DATA['uk']).map((item, idx) => (
                        <motion.div
                            key={idx}
                            initial={{ opacity: 0, y: 30 }}
                            animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
                            transition={{ duration: 0.8, delay: idx * 0.2 }}
                            className="group relative overflow-hidden rounded-brand shadow-[var(--shadow-premium)] hover:shadow-[var(--shadow-hover)] transition-all"
                        >
                            <div className="relative aspect-[16/10] overflow-hidden">
                                <Image
                                    src={EXAMPLE_IMAGES[idx]}
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
