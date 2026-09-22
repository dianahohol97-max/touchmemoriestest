import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';
import { Navigation } from '@/components/ui/Navigation';
import { Footer } from '@/components/ui/Footer';
import BlogIndex from '@/components/blog/BlogIndex';
import { listPath, prevNextLinks, totalPages } from '@/lib/blog/pagination';
import { getAdminClient } from '@/lib/supabase/admin';
import { onlyVisiblePosts } from '@/lib/blog/published';
import { getCanonicalUrl, getAlternateLanguages, type Locale } from '@/lib/seo/locales';
import { BLOG_META } from '@/lib/blog/list-meta';

/**
 * Друга і подальші сторінки списку блогу.
 *
 * ЧОМУ ОКРЕМИЙ МАРШРУТ, А НЕ `?page=`. `robots.txt` закриває `/*&#47;blog?*` —
 * свідомо, щоб робот не ходив по `?category=`, який дублює сторінку категорії.
 * Поки пагінація жила в параметрі, під ту саму заборону потрапляли всі
 * сторінки, крім першої: до статей з другої і далі робот не мав жодного шляху,
 * крім sitemap.
 *
 * `/blog/storinka/1` не існує як окрема адреса — це була б друга адреса з
 * вмістом `/blog`. Вона віддає 301 на `/blog`.
 */

export const revalidate = 3600;

type Params = Promise<{ locale: string; n: string }>;

function parsePage(raw: string): number {
    // Тільки цифри: `/blog/storinka/2abc` має бути 404, а не другою сторінкою.
    // `parseInt` прочитав би таку адресу як двійку й віддав би кодом 200
    // нескінченну кількість дублів однієї сторінки.
    if (!/^\d+$/.test(raw)) return NaN;
    return Number(raw);
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
    const { locale: rawLocale, n } = await params;
    const locale = (rawLocale || 'uk') as Locale;
    const page = parsePage(n);
    if (!Number.isFinite(page) || page < 2) return {};

    const m = BLOG_META[locale] || BLOG_META.uk;
    const { count } = await onlyVisiblePosts(
        getAdminClient().from('blog_posts').select('id', { count: 'exact', head: true }),
    );
    const path = `/blog/storinka/${page}`;

    return {
        // Номер у заголовку обовʼязковий: без нього десяток сторінок списку
        // стають десятком однакових заголовків у видачі, і Google лишає одну.
        title: `${m.title.replace(' | Touch.Memories', '')} — сторінка ${page} | Touch.Memories`,
        description: m.description,
        alternates: {
            // Канонічна адреса — САМА ця сторінка, а не `/blog`. Канонікал на
            // першу сторінку викидає з індексу статті, які видно лише тут.
            canonical: getCanonicalUrl(locale, path),
            languages: getAlternateLanguages(path),
        },
        pagination: prevNextLinks(locale, null, page, totalPages(count)),
    };
}

export default async function BlogPagePage({ params }: { params: Params }) {
    const { locale: rawLocale, n } = await params;
    const locale = (rawLocale || 'uk') as Locale;
    const page = parsePage(n);

    if (!Number.isFinite(page) || page < 1) notFound();
    if (page === 1) permanentRedirect(listPath(locale, null, 1));

    const m = BLOG_META[locale] || BLOG_META.uk;

    return (
        <div style={{ backgroundColor: '#f8fafc', minHeight: '100vh', fontFamily: 'var(--font-primary)', overflowX: 'hidden' }}>
            <Navigation />
            <BlogIndex locale={locale} page={page} heading={m.h1} subtitle={m.subtitle} />
            <Footer />
        </div>
    );
}
