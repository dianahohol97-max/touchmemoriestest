import { getBaseUrl } from '@/lib/seo/locales';

/**
 * Покажчик карт сайту.
 *
 * Мап стало дві: `/sitemap.xml` з каталогом, категоріями, лендінгами й
 * фотографами, і `/blog-sitemap.xml`, який змінюється раз на два-три дні.
 * `robots.txt` перелічує обидві напряму — цього формально достатньо, — а цей
 * файл існує для Search Console, де зручніше подати одну адресу й бачити
 * покриття по кожній мапі окремо.
 *
 * `lastmod` тут навмисно немає. Проставляти «змінено щойно» на кожній
 * генерації означає привчити Google ігнорувати наші дати взагалі, а справжню
 * дату зміни покажчик не знає: її знають самі мапи, і там вона стоїть по
 * кожному рядку. Та сама причина, що й для статичних маршрутів у sitemap.ts.
 */

export const dynamic = 'force-dynamic';
export const revalidate = 3600;

export function GET() {
    const base = getBaseUrl();
    const maps = [`${base}/sitemap.xml`, `${base}/blog-sitemap.xml`];

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${maps.map(loc => `  <sitemap>\n    <loc>${loc}</loc>\n  </sitemap>`).join('\n')}
</sitemapindex>`;

    return new Response(xml, {
        headers: {
            'Content-Type': 'application/xml; charset=utf-8',
            'Cache-Control': 'public, max-age=0, s-maxage=3600',
        },
    });
}
