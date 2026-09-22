import { getAdminClient } from '@/lib/supabase/admin';
import { onlyVisiblePosts } from '@/lib/blog/published';
import { postLocales } from '@/lib/blog/post';
import { HREFLANG_MAP, getCanonicalUrl, type Locale } from '@/lib/seo/locales';

/**
 * Мапа блогу: статті й сторінки категорій.
 *
 * НАВІЩО ОКРЕМО ВІД `/sitemap.xml`. Статті — єдине в цьому сайті, що зʼявляється
 * за розкладом, раз на два-три дні. Окремий файл дає роботу побачити свіжий
 * `lastmod` малим документом, замість перечитувати всі 785 адрес каталогу.
 * Обидва файли перелічені в `/sitemap-index.xml` і в `robots.txt`.
 *
 * ЧОМУ РУЧНИЙ XML, А НЕ `MetadataRoute.Sitemap`. Вбудований формат Next не
 * вміє віддавати РІЗНИЙ набір `hreflang` для різних рядків — він або ставить
 * один набір усім, або не ставить нікому. А тут саме в цьому суть: стаття
 * існує українською, зрідка ще якоюсь, і перелічити пʼять мов для кожної
 * означало б самому здати Google чотири дублі на кожну статтю.
 *
 * ПРО ПАГІНАЦІЮ. Гоча 14 у CLAUDE.md: `blog_posts` ще далеко від тисячі рядків,
 * але межа перетинається без жодної зміни в коді, а мовчазний обрив виглядає
 * як коротша мапа, а не як помилка. Тому читання одразу циклом по `.range()`.
 */

export const dynamic = 'force-dynamic';
export const revalidate = 3600;

const PAGE = 1000;

type Row = {
    slug: string;
    updated_at: string | null;
    published_at: string | null;
    locale: string | null;
    translations: Record<string, any> | null;
};

export async function GET() {
    const admin = getAdminClient();

    const posts: Row[] = [];
    for (let from = 0; ; from += PAGE) {
        const { data } = await onlyVisiblePosts(
            admin.from('blog_posts').select('slug, updated_at, published_at, locale, translations'),
        ).order('published_at', { ascending: false }).range(from, from + PAGE - 1);

        posts.push(...((data || []) as Row[]));
        if (!data || data.length < PAGE) break;
    }

    const { data: categories } = await admin
        .from('blog_categories').select('slug, updated_at').eq('is_active', true);

    const urls: string[] = [];

    for (const post of posts) {
        const locales = postLocales(post);
        const lastmod = post.updated_at || post.published_at;
        for (const locale of locales) {
            urls.push(urlEntry(getCanonicalUrl(locale, `/blog/${post.slug}`), lastmod, 'monthly', 0.6, locales, `/blog/${post.slug}`));
        }
    }

    // Сторінки категорій індексуються як самостійні: у кожної свій title і
    // свій опис. Категорії існують усіма пʼятьма мовами, бо їхній текст —
    // це назва, яка лежить у `translations`.
    for (const cat of categories || []) {
        const path = `/blog/category/${cat.slug}`;
        const all = ['uk', 'en', 'ro', 'pl', 'de'] as Locale[];
        for (const locale of all) {
            urls.push(urlEntry(getCanonicalUrl(locale, path), cat.updated_at, 'weekly', 0.5, all, path));
        }
    }

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urls.join('\n')}
</urlset>`;

    return new Response(xml, {
        headers: {
            'Content-Type': 'application/xml; charset=utf-8',
            'Cache-Control': 'public, max-age=0, s-maxage=3600',
        },
    });
}

function urlEntry(
    loc: string,
    lastmod: string | null,
    changefreq: string,
    priority: number,
    locales: readonly Locale[],
    path: string,
): string {
    const alts = locales.map(
        l => `    <xhtml:link rel="alternate" hreflang="${HREFLANG_MAP[l]}" href="${escapeXml(getCanonicalUrl(l, path))}"/>`,
    ).join('\n');

    return `  <url>
    <loc>${escapeXml(loc)}</loc>${lastmod ? `\n    <lastmod>${new Date(lastmod).toISOString()}</lastmod>` : ''}
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
${alts}
  </url>`;
}

function escapeXml(value: string): string {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}
