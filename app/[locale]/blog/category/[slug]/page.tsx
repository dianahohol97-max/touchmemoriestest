import type { Metadata } from 'next';
import { permanentRedirect } from 'next/navigation';
import { Navigation } from '@/components/ui/Navigation';
import { Footer } from '@/components/ui/Footer';
import BlogIndex from '@/components/blog/BlogIndex';
import { getAdminClient } from '@/lib/supabase/admin';
import { onlyVisiblePosts } from '@/lib/blog/published';
import { listPath, prevNextLinks, totalPages } from '@/lib/blog/pagination';
import { categoryDescription, categoryTitle, loadCategory } from '@/lib/blog/category-meta';
import { getLocalized } from '@/lib/i18n/localize';
import { getCanonicalUrl, getAlternateLanguages, withBrandSuffix, type Locale } from '@/lib/seo/locales';
import { serializeJsonLd } from '@/lib/seo/jsonld';

/**
 * Сторінка категорії блогу — самостійна індексована адреса.
 *
 * Це друга ланка ланцюжка «категорія каталогу → стаття → категорія»: саме сюди
 * ведуть хлібні крихти зі статті й фільтр зі списку. Раніше фільтр вів на
 * `/blog?category=`, а та форма закрита в `robots.txt`, тобто категорії
 * існували, але робот до них не доходив.
 */

export const revalidate = 3600;

type Params = Promise<{ locale: string; slug: string }>;
type Search = Promise<{ page?: string }>;

const stripEmoji = (text?: string) => {
    if (!text) return '';
    return text.replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}❤️]/gu, '').replace(/\s+/g, ' ').trim();
};

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
    const { locale: rawLocale, slug } = await params;
    const locale = (rawLocale || 'uk') as Locale;
    const category = await loadCategory(slug);
    if (!category) return { title: 'Категорію не знайдено | Touch.Memories' };

    const name = stripEmoji(getLocalized(category, locale, 'name'));
    const path = `/blog/category/${slug}`;

    const { count } = await onlyVisiblePosts(
        getAdminClient().from('blog_posts').select('id', { count: 'exact', head: true }).eq('category_id', category.id),
    );

    return {
        title: withBrandSuffix(categoryTitle(category, locale, name)),
        description: categoryDescription(category, locale, name),
        alternates: {
            canonical: getCanonicalUrl(locale, path),
            // Назва категорії лежить у `translations` і перекладена всіма
            // пʼятьма мовами, на відміну від тіла статей.
            languages: getAlternateLanguages(path),
        },
        pagination: prevNextLinks(locale, slug, 1, totalPages(count)),
    };
}

export default async function BlogCategoryPage({ params, searchParams }: { params: Params; searchParams: Search }) {
    const { locale: rawLocale, slug } = await params;
    const locale = (rawLocale || 'uk') as Locale;

    // Стара форма `/blog/category/travel?page=2` лишалася в закладках.
    const asked = parseInt((await searchParams)?.page || '1', 10);
    if (Number.isFinite(asked) && asked > 1) {
        permanentRedirect(listPath(locale, slug, asked));
    }

    const category = await loadCategory(slug);
    const name = category ? stripEmoji(getLocalized(category, locale, 'name')) : '';
    const description = category ? getLocalized(category, locale, 'description') : '';

    const jsonLd = category ? {
        '@context': 'https://schema.org',
        '@type': 'CollectionPage',
        'name': name,
        'url': getCanonicalUrl(locale, `/blog/category/${slug}`),
        'isPartOf': { '@type': 'Blog', 'name': 'touch.memories', 'url': getCanonicalUrl(locale, '/blog') },
    } : null;

    return (
        <div style={{ backgroundColor: '#f8fafc', minHeight: '100vh', fontFamily: 'var(--font-primary)', overflowX: 'hidden' }}>
            <Navigation />
            {jsonLd && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }} />}
            {/* Невідомий слаг ловить сам BlogIndex і віддає 404 — так перевірка
                стоїть в одному місці на всі чотири маршрути списку. */}
            <BlogIndex locale={locale} categorySlug={slug} page={1} heading={name || slug} subtitle={description || null} />
            <Footer />
        </div>
    );
}
