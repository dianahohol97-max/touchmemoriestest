import type { Metadata } from 'next';
import { permanentRedirect } from 'next/navigation';
import { Navigation } from '@/components/ui/Navigation';
import { Footer } from '@/components/ui/Footer';
import BlogIndex from '@/components/blog/BlogIndex';
import { listPath, prevNextLinks, totalPages } from '@/lib/blog/pagination';
import { getAdminClient } from '@/lib/supabase/admin';
import { onlyVisiblePosts } from '@/lib/blog/published';
import { getCanonicalUrl, getAlternateLanguages, OG_LOCALE_MAP, type Locale } from '@/lib/seo/locales';
import { BLOG_META } from '@/lib/blog/list-meta';

/**
 * Перша сторінка блогу.
 *
 * СТАРІ АДРЕСИ З ПАРАМЕТРАМИ. `/blog?category=travel` і `/blog?page=2` лишалися
 * в чужих посиланнях і в закладках, тож замість того, щоб мовчки показати
 * першу сторінку, вони віддають 301 на справжні адреси. Переадресація стоїть
 * тут, у коді сторінки, а НЕ в `next.config.ts`: правило з параметром у
 * конфізі Next переносить параметр у призначення, і саме так `/blog?category=`
 * колись зациклився сам на себе (гоча в ARCHITECTURE.md про redirects).
 */

export const revalidate = 3600;

type Search = Promise<{ category?: string; page?: string }>;

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
    const { locale: rawLocale } = await params;
    const locale = (rawLocale || 'uk') as Locale;
    const m = BLOG_META[locale] || BLOG_META.uk;

    const { count } = await onlyVisiblePosts(
        getAdminClient().from('blog_posts').select('id', { count: 'exact', head: true }),
    );

    return {
        title: m.title,
        description: m.description,
        alternates: {
            canonical: getCanonicalUrl(locale, '/blog'),
            languages: getAlternateLanguages('/blog'),
        },
        pagination: prevNextLinks(locale, null, 1, totalPages(count)),
        openGraph: {
            title: m.title,
            description: m.description,
            url: getCanonicalUrl(locale, '/blog'),
            siteName: 'Touch.Memories',
            locale: OG_LOCALE_MAP[locale],
            type: 'website',
            images: [{ url: '/og-image.jpg', width: 1200, height: 630 }],
        },
        twitter: { card: 'summary_large_image', title: m.title, description: m.description, images: ['/og-image.jpg'] },
    };
}

export default async function BlogHomePage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Search }) {
    const { locale: rawLocale } = await params;
    const locale = (rawLocale || 'uk') as Locale;
    const { category, page } = await searchParams;

    if (category && category !== 'all') {
        permanentRedirect(`/${locale}/blog/category/${category}`);
    }
    const asked = parseInt(page || '1', 10);
    if (Number.isFinite(asked) && asked > 1) {
        permanentRedirect(listPath(locale, null, asked));
    }

    const m = BLOG_META[locale] || BLOG_META.uk;

    return (
        <div style={{ backgroundColor: '#f8fafc', minHeight: '100vh', fontFamily: 'var(--font-primary)', overflowX: 'hidden' }}>
            <Navigation />
            <BlogIndex locale={locale} page={1} heading={m.h1} subtitle={m.subtitle} />
            <Footer />
        </div>
    );
}
