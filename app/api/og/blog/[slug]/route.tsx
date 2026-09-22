import { ImageResponse } from 'next/og';
import { getAdminClient } from '@/lib/supabase/admin';
import { onlyVisiblePosts } from '@/lib/blog/published';
import { getLocalized } from '@/lib/i18n/localize';
import { LOCALES, type Locale } from '@/lib/seo/locales';
import { loadOgFont } from '@/lib/seo/og-font';

/**
 * Картинка для соцмереж: 1200×630, обкладинка + заголовок + логотип.
 *
 * НАВІЩО ГЕНЕРУВАТИ, А НЕ ВІДДАВАТИ ОБКЛАДИНКУ. Обкладинка статті має довільні
 * пропорції, і Facebook із Telegram ріжуть її по центру під свої 1,91:1 — з
 * вертикального фото лишається смуга посередині. До того ж у стрічці картинка
 * йде без заголовка поруч, тож знімок без підпису не каже про статтю нічого.
 *
 * ЧОМУ ЦЕ ТОЙ САМИЙ ПАЙПЛАЙН, ЩО Й ОБКЛАДИНКИ ВІШБУКІВ. `next/og` — це Satori,
 * який уже рендерить обкладинки для друку в `lib/print/wishbook-cover.tsx`.
 * Нова залежність тут не потрібна, а от шрифт Satori треба давати руками:
 * системного запасу в неї немає, і без шрифту з кирилицею заголовок вийшов би
 * рядом чорних прямокутників.
 *
 * Стаття мусить бути опублікована — гейт той самий, що й на сторінці. Інакше
 * картинка чернетки віддавалася б будь-кому, хто вгадав слаг, і заголовок
 * ненаписаної статті гуляв би раніше за саму статтю.
 */

export const runtime = 'nodejs';
export const revalidate = 86400;

const W = 1200;
const H = 630;
const BRAND = '#263A99';

export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
    const { slug } = await params;
    const raw = new URL(request.url).searchParams.get('locale') || 'uk';
    const locale = ((LOCALES as readonly string[]).includes(raw) ? raw : 'uk') as Locale;

    const { data: post } = await onlyVisiblePosts(
        getAdminClient().from('blog_posts').select('title, translations, cover_image, blog_categories(name)').eq('slug', slug),
    ).maybeSingle();

    if (!post) return new Response('Not found', { status: 404 });

    const title = getLocalized(post, locale, 'title') || '';
    const category = stripEmoji((post as any).blog_categories?.name || '');
    const cover = (post as any).cover_image as string | null;

    // Шрифт замовляється рівно на ті гліфи, які тут малюються: Google віддає
    // підмножину, і це різниця між сотнею кілобайтів і кількома мегабайтами на
    // кожен рендер.
    const font = await loadOgFont('Montserrat', `${title}${category}touch.memories`);

    return new ImageResponse(
        (
            <div style={{ width: W, height: H, display: 'flex', flexDirection: 'column', backgroundColor: BRAND, position: 'relative' }}>
                {cover && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={cover} alt="" width={W} height={H} style={{ position: 'absolute', inset: 0, width: W, height: H, objectFit: 'cover' }} />
                )}
                {/* Завіса поверх фото: без неї білий текст на світлому знімку
                    зникає, і саме це стається з половиною обкладинок. */}
                <div style={{ position: 'absolute', inset: 0, display: 'flex', backgroundColor: cover ? 'rgba(38, 58, 153, 0.78)' : BRAND }} />

                <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', width: '100%', height: '100%', padding: 64 }}>
                    <div style={{ display: 'flex', fontSize: 26, fontWeight: 700, color: '#c7d2fe', letterSpacing: 2, textTransform: 'uppercase' }}>
                        {category || 'Блог'}
                    </div>

                    <div style={{
                        display: 'flex',
                        fontSize: title.length > 70 ? 54 : 66,
                        fontWeight: 800,
                        color: 'white',
                        lineHeight: 1.15,
                        // Satori не вміє -webkit-line-clamp, тож довгий
                        // заголовок ріжеться тут, а не в браузері.
                        maxWidth: 1000,
                    }}>
                        {clamp(title, 120)}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', fontSize: 30, fontWeight: 700, color: 'white' }}>
                        touch.memories
                    </div>
                </div>
            </div>
        ),
        {
            width: W,
            height: H,
            fonts: font ? [{ name: 'Montserrat', data: font, weight: 700 as const, style: 'normal' as const }] : [],
        },
    );
}

function clamp(text: string, max: number): string {
    if (text.length <= max) return text;
    const cut = text.slice(0, max);
    const space = cut.lastIndexOf(' ');
    return `${space > max * 0.6 ? cut.slice(0, space) : cut}…`;
}

function stripEmoji(text: string): string {
    return text.replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}❤️]/gu, '').replace(/\s+/g, ' ').trim();
}
