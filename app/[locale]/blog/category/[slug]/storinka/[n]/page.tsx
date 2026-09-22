import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';
import { Navigation } from '@/components/ui/Navigation';
import { Footer } from '@/components/ui/Footer';
import BlogIndex from '@/components/blog/BlogIndex';
import { getAdminClient } from '@/lib/supabase/admin';
import { onlyVisiblePosts } from '@/lib/blog/published';
import { listPath, prevNextLinks, totalPages } from '@/lib/blog/pagination';
import { categoryDescription, categoryTitle, loadCategory } from '@/lib/blog/category-meta';
import { getLocalized } from '@/lib/i18n/localize';
import { getCanonicalUrl, getAlternateLanguages, withBrandSuffix, type Locale } from '@/lib/seo/locales';

/** Друга і подальші сторінки категорії. Причини ті самі, що й у `/blog/storinka/[n]`. */

export const revalidate = 3600;

type Params = Promise<{ locale: string; slug: string; n: string }>;

const stripEmoji = (text?: string) => {
    if (!text) return '';
    return text.replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}❤️]/gu, '').replace(/\s+/g, ' ').trim();
};

/** Тільки цифри: `/storinka/2abc` має бути 404, а не другою сторінкою. */
function parsePage(raw: string): number {
    return /^\d+$/.test(raw) ? Number(raw) : NaN;
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
    const { locale: rawLocale, slug, n } = await params;
    const locale = (rawLocale || 'uk') as Locale;
    const page = parsePage(n);
    if (!Number.isFinite(page) || page < 2) return {};

    const category = await loadCategory(slug);
    if (!category) return { title: 'Категорію не знайдено | Touch.Memories' };

    const name = stripEmoji(getLocalized(category, locale, 'name'));
    const path = `/blog/category/${slug}/storinka/${page}`;

    const { count } = await onlyVisiblePosts(
        getAdminClient().from('blog_posts').select('id', { count: 'exact', head: true }).eq('category_id', category.id),
    );

    return {
        title: withBrandSuffix(`${categoryTitle(category, locale, name)} — сторінка ${page}`),
        description: categoryDescription(category, locale, name),
        alternates: {
            // Канонічна адреса — сама ця сторінка: канонікал на першу викинув
            // би з індексу статті, які видно тільки тут.
            canonical: getCanonicalUrl(locale, path),
            languages: getAlternateLanguages(path),
        },
        pagination: prevNextLinks(locale, slug, page, totalPages(count)),
    };
}

export default async function BlogCategoryPagePage({ params }: { params: Params }) {
    const { locale: rawLocale, slug, n } = await params;
    const locale = (rawLocale || 'uk') as Locale;
    const page = parsePage(n);

    if (!Number.isFinite(page) || page < 1) notFound();
    if (page === 1) permanentRedirect(listPath(locale, slug, 1));

    const category = await loadCategory(slug);
    const name = category ? stripEmoji(getLocalized(category, locale, 'name')) : '';
    const description = category ? getLocalized(category, locale, 'description') : '';

    return (
        <div style={{ backgroundColor: '#f8fafc', minHeight: '100vh', fontFamily: 'var(--font-primary)', overflowX: 'hidden' }}>
            <Navigation />
            <BlogIndex locale={locale} categorySlug={slug} page={page} heading={name || slug} subtitle={description || null} />
            <Footer />
        </div>
    );
}
