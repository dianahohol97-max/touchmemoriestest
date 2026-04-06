'use client';
import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import { Star } from 'lucide-react';
import { useTheme } from '@/components/providers/ThemeProvider';
import { useLocale } from '@/lib/i18n/context';

const testimonials: Record<string, { name: string; text: string; rating: number; city: string }[]> = {
    uk: [
        { name: 'Марина О.', text: 'Фотокнига просто неймовірна! Якість друку та паперу на найвищому рівні. Дякую за збережені спогади!', rating: 5, city: 'Київ' },
        { name: 'Андрій К.', text: 'Дуже зручний конструктор. Зробив книгу за годину, а результат перевершив очікування. Рекомендую!', rating: 5, city: 'Львів' },
        { name: 'Олена С.', text: 'Замовляла глянцевий журнал про нашу подорож. Це найкращий подарунок для чоловіка! Швидка доставка.', rating: 5, city: 'Одеса' },
        { name: 'Вікторія П.', text: 'Прекрасна якість палітурки. Книга виглядає дуже дорого та стильно. Буду замовляти ще!', rating: 5, city: 'Дніпро' },
    ],
    en: [
        { name: 'Marina O.', text: 'The photo book is absolutely incredible! Print and paper quality are top-notch. Thank you for preserving our memories!', rating: 5, city: 'Kyiv' },
        { name: 'Andrew K.', text: 'Very intuitive constructor. Made a book in an hour, and the result exceeded expectations. Highly recommend!', rating: 5, city: 'Lviv' },
        { name: 'Helen S.', text: 'Ordered a glossy magazine about our trip. Best gift for my husband! Fast delivery too.', rating: 5, city: 'Odesa' },
        { name: 'Victoria P.', text: 'Excellent binding quality. The book looks premium and stylish. Will definitely order again!', rating: 5, city: 'Dnipro' },
    ],
    ro: [
        { name: 'Marina O.', text: 'Albumul foto este absolut incredibil! Calitatea imprimării este de top. Mulțumim!', rating: 5, city: 'Kyiv' },
        { name: 'Andrei K.', text: 'Constructor foarte intuitiv. Am făcut o carte într-o oră, iar rezultatul a depășit așteptările!', rating: 5, city: 'Lviv' },
        { name: 'Elena S.', text: 'Am comandat o revistă lucioasă despre călătoria noastră. Cel mai bun cadou!', rating: 5, city: 'Odesa' },
        { name: 'Victoria P.', text: 'Calitate excelentă a legăturii. Cartea arată premium și stilată!', rating: 5, city: 'Dnipro' },
    ],
    pl: [
        { name: 'Marina O.', text: 'Fotoksiążka jest absolutnie niesamowita! Jakość druku i papieru na najwyższym poziomie!', rating: 5, city: 'Kijów' },
        { name: 'Andrzej K.', text: 'Bardzo intuicyjny konstruktor. Zrobiłem książkę w godzinę, a wynik przekroczył oczekiwania!', rating: 5, city: 'Lwów' },
        { name: 'Helena S.', text: 'Zamówiłam błyszczący magazyn o naszej podróży. Najlepszy prezent! Szybka dostawa.', rating: 5, city: 'Odessa' },
        { name: 'Wiktoria P.', text: 'Doskonała jakość oprawy. Książka wygląda luksusowo i stylowo!', rating: 5, city: 'Dniepr' },
    ],
    de: [
        { name: 'Marina O.', text: 'Das Fotobuch ist absolut unglaublich! Druck- und Papierqualität sind erstklassig!', rating: 5, city: 'Kyiv' },
        { name: 'Andreas K.', text: 'Sehr intuitiver Konfigurator. Habe ein Buch in einer Stunde erstellt, das Ergebnis übertrifft alle Erwartungen!', rating: 5, city: 'Lviv' },
        { name: 'Helena S.', text: 'Habe ein Hochglanzmagazin über unsere Reise bestellt. Das beste Geschenk! Schnelle Lieferung.', rating: 5, city: 'Odesa' },
        { name: 'Victoria P.', text: 'Ausgezeichnete Bindungsqualität. Das Buch sieht premium und stilvoll aus!', rating: 5, city: 'Dnipro' },
    ],
};

export function Testimonials() {
    const { content } = useTheme();
    const locale = useLocale();
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
        return testimonials[locale] || testimonials['uk'];
    }, [content['testimonials_json'], locale]);

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
                            style={{ backgroundColor: 'white', padding: '32px', borderRadius: "3px", boxShadow: '0 4px 20px rgba(0,0,0,0.02)', border: '1px solid #f0f0f0' }}
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
