import { getBaseUrl } from '@/lib/seo/locales';

/**
 * Адреси сторінок списку блогу.
 *
 * ЧОМУ НЕ `?page=2`. `robots.txt` закриває правилом «/…/blog?*» усе, що має знак питання, — і
 * закриває свідомо, щоб Google не витрачав бюджет обходу на `?category=`,
 * який дублює сторінку категорії. Поки пагінація жила в тому ж параметрі, під заборону потрапляли
 * ВСІ сторінки, крім першої: статті з другої і далі не мали жодного шляху,
 * яким робот міг би до них дійти, крім sitemap. Тому сторінки тепер справжні
 * адреси, `/blog/storinka/2`, і вони індексуються.
 *
 * Перша сторінка НЕ має власної адреси з номером: `/blog` і `/blog/storinka/1`
 * були б двома адресами з однаковим вмістом. Номер один веде на `/blog`.
 */

export const POSTS_PER_PAGE = 9;

/** Крок сторінки в адресі. Українське слово — як і в слагах категорій. */
export const PAGE_SEGMENT = 'storinka';

export function listPath(locale: string, categorySlug: string | null, page: number): string {
    const base = categorySlug
        ? `/${locale}/blog/category/${categorySlug}`
        : `/${locale}/blog`;
    return page <= 1 ? base : `${base}/${PAGE_SEGMENT}/${page}`;
}

/** Межі для `.range()` — відлік сторінок з одиниці. */
export function pageRange(page: number): { from: number; to: number } {
    const safe = Math.max(1, Math.floor(page) || 1);
    const from = (safe - 1) * POSTS_PER_PAGE;
    return { from, to: from + POSTS_PER_PAGE - 1 };
}

export function totalPages(count: number | null | undefined): number {
    return Math.max(1, Math.ceil((count || 0) / POSTS_PER_PAGE));
}

/**
 * `rel="prev"` і `rel="next"` для `<head>`.
 *
 * Google більше не використовує ці підказки для склеювання сторінок, але Bing
 * і Yandex використовують — а IndexNow ми шлемо саме їм. Коштують вони двох
 * рядків, тож лишаються. Next віддає їх полем `pagination` у метаданих.
 */
export function prevNextLinks(locale: string, categorySlug: string | null, page: number, pages: number) {
    const base = getBaseUrl();
    const links: { previous?: string; next?: string } = {};
    if (page > 1) links.previous = `${base}${listPath(locale, categorySlug, page - 1)}`;
    if (page < pages) links.next = `${base}${listPath(locale, categorySlug, page + 1)}`;
    return links;
}
