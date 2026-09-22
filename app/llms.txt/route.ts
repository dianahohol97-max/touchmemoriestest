import { getAdminClient } from '@/lib/supabase/admin';
import { onlyVisiblePosts } from '@/lib/blog/published';
import { getCanonicalUrl } from '@/lib/seo/locales';
import { LLMS_HEAD, LLMS_TAIL } from '@/lib/seo/llms-static';

/**
 * `/llms.txt` — коротка довідка про сайт для ШІ-асистентів.
 *
 * ЧОМУ МАРШРУТ, А НЕ ФАЙЛ. Розділ зі статтями застарівав на наступний день
 * після кожної публікації, а публікація тепер щодватри дні. Тепер перелік
 * збирається з бази в момент запиту, і крон скидає кеш цієї адреси разом із
 * рештою. Статичний `public/llms.txt` довелося прибрати: файл у `public/`
 * перекриває маршрут із тим самим шляхом, тож поки він лежав поруч, віддавався
 * саме він.
 *
 * ДВАДЦЯТЬ СТАТЕЙ — СТЕЛЯ. Документ має лишатися коротким: асистент читає його
 * цілком, і перелік із сотні рядків витіснить із відповіді все інше, заради
 * чого його й писали. Двадцять найсвіжіших — це приблизно півтора місяця
 * публікацій.
 */

export const dynamic = 'force-dynamic';
export const revalidate = 3600;

export async function GET() {
    const admin = getAdminClient();

    const { data: posts } = await onlyVisiblePosts(
        admin.from('blog_posts').select('title, slug, excerpt, published_at'),
    ).order('published_at', { ascending: false }).limit(20);

    const lines = (posts || []).map((post: any) => {
        const url = getCanonicalUrl('uk', `/blog/${post.slug}`);
        const note = String(post.excerpt || '').replace(/\s+/g, ' ').trim();
        return `- [${post.title}](${url})${note ? `: ${trim(note, 160)}` : ''}`;
    });

    const body = [
        LLMS_HEAD,
        '',
        '## Статті блогу',
        '',
        lines.length ? lines.join('\n') : '- Статей поки немає',
        '',
        LLMS_TAIL,
        '',
    ].join('\n');

    return new Response(body, {
        headers: {
            'Content-Type': 'text/plain; charset=utf-8',
            'Cache-Control': 'public, max-age=0, s-maxage=3600',
        },
    });
}

function trim(text: string, max: number): string {
    if (text.length <= max) return text;
    const cut = text.slice(0, max);
    const space = cut.lastIndexOf(' ');
    return `${space > max * 0.6 ? cut.slice(0, space) : cut}…`;
}
