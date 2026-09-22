import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { onlyVisiblePosts } from '@/lib/blog/published';
import { getCanonicalUrl, getBaseUrl, LOCALES, type Locale } from '@/lib/seo/locales';

/**
 * RSS блогу.
 *
 * ТРИ РЕЧІ, ЯКІ ТУТ БУЛИ ЗЛАМАНІ ДО 22.09.2026 і виглядали як робочий канал:
 *
 * 1. Посилання йшли на `${domain}/blog/${slug}` — без коду локалі. Така адреса
 *    існує тільки як 308 на `/uk/blog/...`, тобто кожен пункт стрічки вів через
 *    переадресацію, а `guid` (за яким читалки відрізняють нову статтю від
 *    прочитаної) не збігався з канонічною адресою жодної сторінки сайту.
 * 2. Канал віддавався тим самим для всіх пʼятьох локалей, хоча маршрут лежить
 *    під `[locale]`: німецький читач отримував український заголовок разом із
 *    `<language>uk</language>`.
 * 3. `new Date(post.published_at).toUTCString()` на порожній даті друкує
 *    «Invalid Date» — рядок, через який деякі читалки відкидають увесь канал.
 *
 * Ще одна дрібниця, яка дорого коштує: CDATA не рятує від рядка `]]>` усередині
 * тексту — він закриває секцію достроково і ламає XML. Тому текст екранується,
 * а не загортається.
 */

export const dynamic = 'force-dynamic';
export const revalidate = 3600;

export async function GET(_request: Request, { params }: { params: Promise<{ locale: string }> }) {
    const { locale: raw } = await params;
    const locale = ((LOCALES as readonly string[]).includes(raw) ? raw : 'uk') as Locale;

    const { data: posts } = await onlyVisiblePosts(
        getAdminClient().from('blog_posts').select('title, slug, excerpt, published_at, translations, cover_image'),
    ).order('published_at', { ascending: false }).limit(20);

    const self = `${getBaseUrl()}/${locale}/blog/rss.xml`;
    const items = (posts || []).map((post: any) => {
        const tr = (post.translations || {})[locale] || {};
        const url = getCanonicalUrl(locale, `/blog/${post.slug}`);
        const date = post.published_at ? new Date(post.published_at) : null;
        const pubDate = date && !Number.isNaN(date.getTime()) ? date.toUTCString() : null;

        return `    <item>
      <guid isPermaLink="true">${esc(url)}</guid>
      <title>${esc(tr.title || post.title || '')}</title>
      <link>${esc(url)}</link>
      <description>${esc(tr.excerpt || post.excerpt || '')}</description>${pubDate ? `\n      <pubDate>${pubDate}</pubDate>` : ''}
    </item>`;
    }).join('\n');

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Блог touch.memories</title>
    <link>${esc(getCanonicalUrl(locale, '/blog'))}</link>
    <atom:link href="${esc(self)}" rel="self" type="application/rss+xml"/>
    <description>Статті про фотокниги, тревелбуки та подарунки з фотографіями</description>
    <language>${locale}</language>
${items}
  </channel>
</rss>`;

    return new NextResponse(xml, {
        headers: {
            'Content-Type': 'application/rss+xml; charset=utf-8',
            'Cache-Control': 'public, max-age=0, s-maxage=3600',
        },
    });
}

function esc(value: string): string {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}
