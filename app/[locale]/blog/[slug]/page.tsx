import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { notFound } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { Calendar, Clock, ArrowRight, Facebook, RefreshCw } from 'lucide-react';
import { Navigation } from '@/components/ui/Navigation';
import { Footer } from '@/components/ui/Footer';
import MarkdownContent from '@/components/ui/MarkdownContent';
import BlogShareButton from '@/components/ui/BlogShareButton';
import TableOfContents from '@/components/blog/TableOfContents';
import ArticleFaq, { parseFaq } from '@/components/blog/ArticleFaq';
import ProductCards from '@/components/blog/ProductCards';
import ReadAlso from '@/components/blog/ReadAlso';
import { getLocalized } from '@/lib/i18n/localize';
import { onlyVisiblePosts } from '@/lib/blog/published';
import { readPostForPreview } from '@/lib/blog/queue';
import { extractToc } from '@/lib/blog/markdown';
import {
    isPreviewToken, loadProductCards, metaDescription, metaTitle, postLocales,
} from '@/lib/blog/post';
import {
    getCanonicalUrl, getSubsetAlternates, getBaseUrl, OG_LOCALE_MAP,
    withBrandSuffix, type Locale,
} from '@/lib/seo/locales';
import { serializeJsonLd } from '@/lib/seo/jsonld';

/**
 * Сторінка статті блогу.
 *
 * ЩО ТУТ РОБИТЬ SEO, А ЩО — ТЕКСТ. Усе, що видно пошуковику, збирається з
 * полів рядка, а не пишеться в тілі статті: заголовок, опис, хлібні крихти,
 * зміст, питання й відповіді, картки товарів із цінами. Причина одна —
 * написане в тілі застаріває мовчки. Ціна, названа в тексті, не падає і не
 * світиться, вона просто виявляється неправдою в момент, коли людина з неї
 * приходить у кошик.
 *
 * HREFLANG ТІЛЬКИ ТУДИ, ДЕ Є ТЕКСТ. Стаття існує українською і зрідка
 * перекладається. Повний набір із пʼяти мов сказав би Google, що /de/blog/… —
 * німецька версія, тоді як там лежить той самий український текст. Набір
 * рахує `postLocales`, і він дивиться не на наявність ключа мови, а на
 * наявність у ньому заголовка й тіла: порожній обʼєкт перекладу заводиться
 * сам, щойно хтось відкрив вкладку мови.
 *
 * ПРО ВНУТРІШНІ ПОСИЛАННЯ. Мінімум із технічного завдання — три на каталог і
 * два на статті — тримає САМА сторінка, а не сумлінність автора: блок товарів
 * дає до трьох посилань у каталог, «Читайте також» — три на статті, хлібні
 * крихти — одне на категорію. Тіло статті додає своє зверху.
 *
 * ПРО ПРЕВ'Ю. Чернетку і статтю з черги видно за `?preview=<BLOG_PREVIEW_SECRET>`.
 * Така відповідь несе `noindex`, не кешується і не рахує перегляд.
 */

export const revalidate = 7200;

const stripEmoji = (text?: string) => {
    if (!text) return '';
    return text.replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}❤️]/gu, '').replace(/\s+/g, ' ').trim();
};

type Params = Promise<{ slug: string; locale: string }>;
type Search = Promise<{ preview?: string }>;

/** Стаття для відвідувача або, за секретом, чернетка. */
async function loadPost(db: any, slug: string, preview: boolean) {
    if (preview) return readPostForPreview(db, slug);

    const { data } = await onlyVisiblePosts(
        db.from('blog_posts').select('*, blog_categories(*)').eq('slug', slug),
    ).maybeSingle();
    return data || null;
}

export async function generateMetadata({ params, searchParams }: { params: Params; searchParams: Search }): Promise<Metadata> {
    const { slug, locale: rawLocale } = await params;
    const locale = (rawLocale || 'uk') as Locale;
    const preview = isPreviewToken((await searchParams)?.preview);

    try {
        // Гейт той самий, що й на сторінці: інакше <title> назвав би статтю,
        // яка ще не відкрилася за графіком, на сторінці, яка віддає 404.
        const post = await loadPost(getAdminClient(), slug, preview);
        if (!post) return { title: 'Статтю не знайдено | Touch.Memories' };

        const title = metaTitle(post, locale);
        const description = metaDescription(post, locale);
        const path = `/blog/${slug}`;
        const ogImage = `${getBaseUrl()}/api/og/blog/${slug}?locale=${locale}`;

        return {
            title: withBrandSuffix(title),
            description,
            // Чернетка не має потрапити в індекс навіть випадково: посилання на
            // прев'ю переживає листування і рано чи пізно десь публікується.
            ...(preview ? { robots: { index: false, follow: false } } : {}),
            alternates: {
                canonical: getCanonicalUrl(locale, path),
                languages: getSubsetAlternates(path, postLocales(post), (post.locale || 'uk') as Locale),
            },
            openGraph: {
                title: post.og_title || title,
                description,
                images: [{ url: ogImage, width: 1200, height: 630, alt: title }],
                type: 'article',
                publishedTime: post.published_at || undefined,
                modifiedTime: post.updated_at || post.published_at || undefined,
                locale: OG_LOCALE_MAP[locale],
                url: getCanonicalUrl(locale, path),
                siteName: 'Touch.Memories',
            },
            twitter: {
                card: 'summary_large_image',
                title,
                description,
                images: [ogImage],
            },
        };
    } catch {
        return { title: 'Статтю не знайдено | Touch.Memories' };
    }
}

export default async function BlogPostPage({ params, searchParams }: { params: Params; searchParams: Search }) {
    const { slug, locale: rawLocale } = await params;
    const locale = (rawLocale || 'uk') as Locale;
    const preview = isPreviewToken((await searchParams)?.preview);

    // Прев'ю читає сервісним ключем: чернетка закрита політикою, і звичайний
    // клієнт віддав би порожньо — тобто 404 замість перегляду.
    const supabase = preview ? getAdminClient() : await createClient();
    const post = await loadPost(supabase, slug, preview);
    if (!post) notFound();

    const productCards = await loadProductCards(supabase, post, 3);

    // Три сусіди з тієї ж категорії, а якщо їх менше — найсвіжіші з решти
    // блогу. Порожній блок «Читайте також» читається як поломка сторінки.
    const readAlso = await loadReadAlso(supabase, post);

    const currentUrl = getCanonicalUrl(locale, `/blog/${post.slug}`);
    const content = getLocalized(post, locale, 'content') || '';
    const title = getLocalized(post, locale, 'title') || '';
    const toc = extractToc(content);
    const faq = parseFaq(post.faq);
    const categorySlug = post.blog_categories?.slug || null;
    const categoryName = stripEmoji(post.blog_categories ? getLocalized(post.blog_categories, locale, 'name') : '') || 'Стаття';
    const categoryUrl = categorySlug
        ? getCanonicalUrl(locale, `/blog/category/${categorySlug}`)
        : getCanonicalUrl(locale, '/blog');

    const published = post.published_at ? new Date(post.published_at) : null;
    const updated = post.updated_at ? new Date(post.updated_at) : null;
    // «Оновлено» показується лише коли це правда: дата, яка щодня дорівнює
    // даті публікації, знецінює сам напис.
    const showUpdated = !!(published && updated && updated.getTime() - published.getTime() > 86_400_000);

    const jsonLdArticle = {
        '@context': 'https://schema.org',
        '@type': 'Article',
        'mainEntityOfPage': { '@type': 'WebPage', '@id': currentUrl },
        'headline': title,
        'image': post.cover_image ? [post.cover_image] : [`${getBaseUrl()}/api/og/blog/${post.slug}`],
        // Автор — організація, а не вигадана людина. Підписувати статті іменем,
        // за яким нікого немає, означає обіцяти експертність, яку неможливо
        // підтвердити ні сторінкою автора, ні чимось іще.
        'author': { '@type': 'Organization', 'name': 'touch.memories', 'url': getBaseUrl() },
        'publisher': {
            '@type': 'Organization',
            'name': 'touch.memories',
            'logo': { '@type': 'ImageObject', 'url': `${getBaseUrl()}/og-image.jpg`, 'width': 1200, 'height': 630 },
        },
        'datePublished': post.published_at || undefined,
        'dateModified': post.updated_at || post.published_at || undefined,
        'description': metaDescription(post, locale),
        'inLanguage': locale,
    };

    const jsonLdBreadcrumb = {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        'itemListElement': [
            { '@type': 'ListItem', 'position': 1, 'name': 'Головна', 'item': getCanonicalUrl(locale) },
            { '@type': 'ListItem', 'position': 2, 'name': 'Блог', 'item': getCanonicalUrl(locale, '/blog') },
            { '@type': 'ListItem', 'position': 3, 'name': categoryName, 'item': categoryUrl },
            { '@type': 'ListItem', 'position': 4, 'name': title },
        ],
    };

    // Схема будується з ТИХ САМИХ рядків, які показує акордеон нижче: питання,
    // якого немає на сторінці, — порушення рекомендацій Google, і карається
    // воно тихим зникненням сніпета, а не помилкою.
    const jsonLdFaq = faq.length ? {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        'mainEntity': faq.map(item => ({
            '@type': 'Question',
            'name': item.q,
            'acceptedAnswer': { '@type': 'Answer', 'text': item.a },
        })),
    } : null;

    const jsonLdProducts = productCards.length ? {
        '@context': 'https://schema.org',
        '@type': 'ItemList',
        'itemListElement': productCards.map((card, i) => ({
            '@type': 'ListItem',
            'position': i + 1,
            'name': card.name,
            'url': getCanonicalUrl(locale, `/catalog/${card.slug}`),
        })),
    } : null;

    return (
        <div style={{ backgroundColor: 'white', minHeight: '100vh', fontFamily: 'var(--font-primary)' }}>
            <Navigation />

            <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLdArticle) }} />
            <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLdBreadcrumb) }} />
            {jsonLdFaq && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLdFaq) }} />}
            {jsonLdProducts && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLdProducts) }} />}

            {/* Лічильник переглядів не чіпає чернетку: прев'ю дивиться Діана, і
                статистика статті, яка ще не вийшла, — це шум у цифрах. */}
            {!preview && (
                <script dangerouslySetInnerHTML={{
                    __html: `fetch('/api/blog/${post.slug}/view', { method: 'POST', keepalive: true }).catch(function(){});`,
                }} />
            )}

            <main style={{ paddingTop: '100px', paddingBottom: '100px' }}>
                <article style={{ maxWidth: '800px', margin: '0 auto', padding: '0 24px' }}>

                    {preview && (
                        <div style={{ backgroundColor: '#fef3c7', border: '1px solid #f59e0b', color: '#92400e', borderRadius: '3px', padding: '12px 16px', marginTop: '40px', fontSize: '14px', fontWeight: 600 }}>
                            Прев&apos;ю: статтю ще не опубліковано, у пошук вона не потрапляє. Стан — {post.status === 'scheduled' ? 'у черзі' : 'чернетка'}.
                        </div>
                    )}

                    <nav aria-label="Хлібні крихти" style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: '#94a3b8', marginBottom: '32px', paddingTop: preview ? '24px' : '40px', flexWrap: 'wrap' }}>
                        <Link href={`/${locale}`} style={{ color: 'inherit', textDecoration: 'none' }}>Головна</Link>
                        <span aria-hidden>→</span>
                        <Link href={`/${locale}/blog`} style={{ color: 'inherit', textDecoration: 'none' }}>Блог</Link>
                        {categorySlug && (
                            <>
                                <span aria-hidden>→</span>
                                {/* Посилання веде на індексовану сторінку категорії,
                                    а не на /blog?category= — та форма закрита в
                                    robots.txt, і хлібні крихти вели б у заборонене. */}
                                <Link href={`/${locale}/blog/category/${categorySlug}`} style={{ color: 'inherit', textDecoration: 'none' }}>
                                    {categoryName}
                                </Link>
                            </>
                        )}
                        <span aria-hidden>→</span>
                        <span style={{ color: '#263A99' }}>{title}</span>
                    </nav>

                    <header style={{ marginBottom: '40px' }}>
                        {categorySlug && (
                            <Link href={`/${locale}/blog/category/${categorySlug}`} style={{ display: 'inline-block', backgroundColor: '#f1f5f9', color: '#263A99', padding: '6px 16px', borderRadius: '3px', fontSize: '13px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '24px', textDecoration: 'none' }}>
                                {categoryName}
                            </Link>
                        )}
                        {/* Єдиний H1 на сторінці. У тілі статті найвищий рівень —
                            другий: рендер markdown піднімає `#` до H2 саме для
                            того, щоб другий H1 не зʼявився. */}
                        <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '48px', fontWeight: 900, color: '#263A99', lineHeight: 1.1, marginBottom: '24px', letterSpacing: '-0.02em' }}>
                            {title}
                        </h1>
                        <p style={{ fontSize: '20px', color: '#64748b', lineHeight: 1.6, marginBottom: '32px' }}>
                            {getLocalized(post, locale, 'excerpt') || ''}
                        </p>

                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid #f1f5f9', borderBottom: '1px solid #f1f5f9', padding: '20px 0', gap: '16px', flexWrap: 'wrap' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap', fontSize: '14px', color: '#94a3b8' }}>
                                <span style={{ fontWeight: 800, color: '#263A99', fontSize: '15px' }}>touch.memories</span>
                                {published && (
                                    <time dateTime={published.toISOString()} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                        <Calendar size={14} /> {published.toLocaleDateString('uk-UA')}
                                    </time>
                                )}
                                {showUpdated && updated && (
                                    <time dateTime={updated.toISOString()} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                        <RefreshCw size={14} /> оновлено {updated.toLocaleDateString('uk-UA')}
                                    </time>
                                )}
                                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <Clock size={14} /> {post.reading_time || 5} хв читання
                                </span>
                            </div>

                            <div style={{ display: 'flex', gap: '8px' }}>
                                <a href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(currentUrl)}`} target="_blank" rel="noreferrer" aria-label="Поділитися у Facebook" style={shareBtnStyle}>
                                    <Facebook size={18} />
                                </a>
                                <BlogShareButton url={currentUrl} />
                            </div>
                        </div>
                    </header>

                    {post.cover_image && (
                        <div style={{ width: '100%', aspectRatio: '16/9', position: 'relative', borderRadius: '3px', overflow: 'hidden', marginBottom: '48px', backgroundColor: '#f8fafc' }}>
                            {/* Обкладинка — це LCP сторінки, тож вона єдина йде з
                                priority. Решта зображень лінькуваті. */}
                            <Image
                                src={post.cover_image}
                                alt={post.cover_image_alt || title}
                                fill
                                priority
                                sizes="(max-width: 850px) 100vw, 800px"
                                style={{ objectFit: 'cover' }}
                            />
                        </div>
                    )}

                    <TableOfContents entries={toc} />

                    <div style={{ fontSize: '18px', lineHeight: 1.8, color: '#263A99', marginBottom: '60px' }}>
                        <MarkdownContent source={content} />
                    </div>

                    <ArticleFaq items={faq} />

                    <ProductCards cards={productCards} locale={locale} />

                    {Array.isArray(post.tags) && post.tags.length > 0 && (
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '48px' }}>
                            {post.tags.map((tag: string) => (
                                <Link key={tag} href={`/${locale}/blog/tag/${tag}`} rel="nofollow" style={{ backgroundColor: '#f1f5f9', color: '#475569', padding: '6px 16px', borderRadius: '3px', fontSize: '14px', fontWeight: 600, textDecoration: 'none' }}>
                                    #{tag}
                                </Link>
                            ))}
                        </div>
                    )}

                    <div style={{ backgroundColor: '#263A99', borderRadius: '3px', padding: '40px', color: 'white', textAlign: 'center', marginBottom: '80px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        {/* color обов'язковий: globals.css має правило h2 { color: var(--primary) },
                            і воно б'є успадкований від банера білий — заголовок ставав #263A99 на #263A99. */}
                        <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '28px', fontWeight: 900, marginBottom: '16px', color: 'white' }}>
                            Зберемо це разом з вами
                        </h2>
                        <p style={{ fontSize: '16px', color: '#cbd5e1', marginBottom: '32px', maxWidth: '460px' }}>
                            Оберіть формат у каталозі або зберіть макет самостійно в конструкторі. Якщо не хочеться верстати, це зробить дизайнерка студії.
                        </p>
                        {/* Кнопка навмисно інверсна: банер уже #263A99, і кнопка того ж кольору
                            на ньому зникала — лишався самий білий напис без жодної форми. */}
                        <Link href={`/${locale}/catalog`} style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '16px 32px', backgroundColor: 'white', color: '#263A99', borderRadius: '9999px', fontWeight: 800, fontSize: '16px', textDecoration: 'none' }}>
                            Перейти в каталог <ArrowRight size={20} />
                        </Link>
                    </div>

                </article>

                <ReadAlso posts={readAlso} locale={locale} />
            </main>

            <Footer />
        </div>
    );
}

/** Три сусідні статті: спершу з тієї ж категорії, потім найсвіжіші з блогу. */
async function loadReadAlso(db: any, post: any): Promise<any[]> {
    const fields = 'id, title, slug, cover_image, cover_image_alt, published_at, translations';
    const picked: any[] = [];
    const seen = new Set<string>([post.id]);

    if (post.category_id) {
        const { data } = await onlyVisiblePosts(
            db.from('blog_posts').select(fields).eq('category_id', post.category_id).neq('id', post.id),
        ).order('published_at', { ascending: false }).limit(3);
        for (const row of data || []) {
            if (seen.has(row.id)) continue;
            seen.add(row.id);
            picked.push(row);
        }
    }

    if (picked.length < 3) {
        const { data } = await onlyVisiblePosts(
            db.from('blog_posts').select(fields).neq('id', post.id),
        ).order('published_at', { ascending: false }).limit(6);
        for (const row of data || []) {
            if (picked.length >= 3 || seen.has(row.id)) continue;
            seen.add(row.id);
            picked.push(row);
        }
    }

    return picked.slice(0, 3);
}

const shareBtnStyle = { display: 'flex', alignItems: 'center', justifyContent: 'center', width: '40px', height: '40px', borderRadius: '3px', backgroundColor: '#f1f5f9', color: '#64748b', border: 'none', cursor: 'pointer', transition: 'all 0.2s' };
