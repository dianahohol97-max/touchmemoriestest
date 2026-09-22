import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import type { ProductCard } from '@/lib/blog/post';
import type { Locale } from '@/lib/seo/locales';

/**
 * Блок «Що з цього можна зробити» — місток зі статті в каталог.
 *
 * ЧОМУ ЦІНА ЙДЕ З БАЗИ, А НЕ З ТЕКСТУ. Ціна, написана в тілі статті, застаріває
 * мовчки: вона не падає, не світиться і виявляється тоді, коли людина приходить
 * із неї в кошик. Тому генератору заборонено називати суми в тексті, а сюди
 * вони приходять із `products.price` у момент рендеру.
 *
 * Товари показуються ТІЛЬКИ активні — відбір стоїть у `loadProductCards`, у
 * самому запиті. Стаття, яка веде на знятий з продажу товар, гірша за статтю
 * без цього блоку взагалі.
 */
export default function ProductCards({
    cards,
    locale,
    title = 'Що з цього можна зробити',
}: {
    cards: ProductCard[];
    locale: Locale;
    title?: string;
}) {
    if (!cards.length) return null;

    return (
        <section style={{ borderTop: '2px dashed #f1f5f9', paddingTop: '40px', marginBottom: '48px' }}>
            <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '28px', fontWeight: 900, color: '#263A99', marginBottom: '24px' }}>
                {title}
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px' }}>
                {cards.map(card => (
                    <Link
                        key={card.id}
                        href={`/${locale}/catalog/${card.slug}`}
                        style={{ border: '1px solid #e2e8f0', borderRadius: '3px', padding: '16px', textDecoration: 'none', color: 'inherit', display: 'flex', flexDirection: 'column' }}
                    >
                        <div style={{ width: '100%', aspectRatio: '1/1', position: 'relative', borderRadius: '3px', overflow: 'hidden', backgroundColor: '#f8fafc', marginBottom: '16px' }}>
                            {card.image && (
                                <Image
                                    src={card.image}
                                    alt={card.name}
                                    fill
                                    // Блок стоїть у кінці статті й ніколи не є
                                    // LCP — вантажиться лінькувато, і розмір
                                    // заявлений, щоб верстка не стрибала.
                                    loading="lazy"
                                    sizes="(max-width: 700px) 45vw, 220px"
                                    style={{ objectFit: 'cover' }}
                                />
                            )}
                        </div>
                        <h3 style={{ fontWeight: 800, fontSize: '15px', color: '#263A99', margin: '0 0 8px', lineHeight: 1.35 }}>{card.name}</h3>
                        {card.price !== null && (
                            <div style={{ color: '#263A99', fontWeight: 700, fontSize: '14px', marginTop: 'auto' }}>
                                від {card.price} ₴
                            </div>
                        )}
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 700, color: '#64748b', marginTop: '10px' }}>
                            Подивитися <ArrowRight size={14} />
                        </span>
                    </Link>
                ))}
            </div>
        </section>
    );
}
