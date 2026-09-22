import Image from 'next/image';
import Link from 'next/link';
import { getLocalized } from '@/lib/i18n/localize';
import type { Locale } from '@/lib/seo/locales';

/**
 * «Читайте також» — три статті тієї ж категорії.
 *
 * НАВІЩО. Це друга половина ланцюжка «категорія каталогу → стаття → категорія»:
 * стаття без вихідних посилань на сусідні статті лишається тупиком, у який
 * людина прийшла з пошуку і з якого йде назад у пошук. Три — це рівно та
 * кількість, після якої блок перестає бути підказкою і стає другим списком
 * блогу.
 *
 * Якщо в категорії менше трьох сусідів, добираються найсвіжіші з решти блогу:
 * порожній блок «читайте також» виглядає як поломка, а не як відсутність
 * матеріалу.
 */
export default function ReadAlso({ posts, locale }: { posts: any[]; locale: Locale }) {
    if (!posts.length) return null;

    return (
        <div style={{ backgroundColor: '#f8fafc', padding: '80px 24px' }}>
            <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
                <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '32px', fontWeight: 900, color: '#263A99', marginBottom: '40px', textAlign: 'center' }}>
                    Читайте також
                </h2>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '32px' }}>
                    {posts.map(post => (
                        <Link key={post.id} href={`/${locale}/blog/${post.slug}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                            <div style={{ position: 'relative', width: '100%', paddingTop: '65%', borderRadius: '3px', overflow: 'hidden', backgroundColor: '#e2e8f0', marginBottom: '20px' }}>
                                {post.cover_image && (
                                    <Image
                                        src={post.cover_image}
                                        alt={post.cover_image_alt || getLocalized(post, locale, 'title') || ''}
                                        fill
                                        loading="lazy"
                                        sizes="(max-width: 900px) 90vw, 360px"
                                        style={{ objectFit: 'cover' }}
                                    />
                                )}
                            </div>
                            <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '20px', fontWeight: 800, color: '#263A99', margin: '0 0 12px', lineHeight: 1.3 }}>
                                {getLocalized(post, locale, 'title') || ''}
                            </h3>
                            <div style={{ fontSize: '13px', color: '#94a3b8' }}>
                                {post.published_at ? new Date(post.published_at).toLocaleDateString('uk-UA') : ''}
                            </div>
                        </Link>
                    ))}
                </div>
            </div>
        </div>
    );
}
