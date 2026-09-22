import Link from 'next/link';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { Calendar, Clock, User, ImageIcon, ArrowRight } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getLocalized } from '@/lib/i18n/localize';
import { onlyVisiblePosts } from '@/lib/blog/published';
import { listPath, pageRange, totalPages } from '@/lib/blog/pagination';
import type { Locale } from '@/lib/seo/locales';

/**
 * Список статей: і `/blog`, і `/blog/category/{slug}`, і їхні сторінки з
 * номерами.
 *
 * ЧОМУ ОДИН КОМПОНЕНТ НА ЧОТИРИ МАРШРУТИ. До 22.09.2026 список існував двічі —
 * у `blog/page.tsx` і в `blog/category/[slug]/page.tsx` — і копії вже
 * розійшлися: у категорії не було ні бічної колонки, ні запасного вигляду для
 * картки без обкладинки. Це та сама історія, що з панеллю фото в редакторі:
 * дві копії з наказом «не забудь змінити обидві» розходяться завжди.
 *
 * ПАГІНАЦІЯ СПРАВЖНІМИ АДРЕСАМИ. `?page=2` лежав під забороною `/*&#47;blog?*` у
 * robots.txt, тобто все, крім першої сторінки, було закрите від обходу.
 * Тепер це `/blog/storinka/2`, і сторінки індексуються.
 */

const stripEmoji = (text?: string) => {
    if (!text) return '';
    return text.replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}❤️]/gu, '').replace(/\s+/g, ' ').trim();
};

const DATE_LOCALE: Record<string, string> = { uk: 'uk-UA', en: 'en-GB', ro: 'ro-RO', pl: 'pl-PL', de: 'de-DE' };

export type BlogIndexProps = {
    locale: Locale;
    /** Слаг категорії або `null` для всього блогу. */
    categorySlug?: string | null;
    page: number;
    heading: string;
    subtitle?: string | null;
};

export default async function BlogIndex({ locale, categorySlug = null, page, heading, subtitle }: BlogIndexProps) {
    const supabase = await createClient();
    const dateFmt = DATE_LOCALE[locale] || 'uk-UA';

    const { data: categories } = await supabase
        .from('blog_categories').select('*').eq('is_active', true).order('sort_order');

    let categoryId: string | null = null;
    if (categorySlug) {
        const found = (categories || []).find((c: any) => c.slug === categorySlug);
        // Невідома категорія — це 404, а не порожній список: сторінка з
        // заголовком і без статей виглядає як наша поломка, і Google
        // індексує її як порожню.
        if (!found) notFound();
        categoryId = found.id;
    }

    const { from, to } = pageRange(page);
    let query = onlyVisiblePosts(
        supabase.from('blog_posts').select('*, blog_categories(name, slug)', { count: 'exact' }),
    ).order('published_at', { ascending: false }).range(from, to);
    if (categoryId) query = query.eq('category_id', categoryId);

    const { data: posts, count } = await query;
    const pages = totalPages(count);

    // Сторінка за межами наявних — 404. Інакше `/blog/storinka/99` віддавав би
    // порожній список кодом 200, і таких адрес можна вигадати нескінченно.
    if (page > 1 && (!posts || posts.length === 0)) notFound();

    const showHero = !categorySlug && page === 1;
    const { data: featuredPost } = showHero
        ? await onlyVisiblePosts(supabase.from('blog_posts').select('*, blog_categories(name, slug)'))
            .eq('is_featured', true).order('published_at', { ascending: false }).limit(1).maybeSingle()
        : { data: null };

    const { data: popularPosts } = await onlyVisiblePosts(
        supabase.from('blog_posts').select('id, title, slug, views_count, published_at, translations'),
    ).order('views_count', { ascending: false }).limit(5);

    const { data: featuredProducts } = await supabase
        .from('products').select('id, name, slug, price, images').eq('is_active', true).limit(3);

    return (
        <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '100px 24px 80px' }}>
            <div style={{ textAlign: 'center', marginBottom: '60px' }}>
                <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '48px', fontWeight: 900, color: '#263A99', marginBottom: '16px', letterSpacing: '-0.02em' }}>
                    {heading}
                </h1>
                {subtitle && (
                    <p style={{ fontSize: '18px', color: '#64748b', maxWidth: '600px', margin: '0 auto' }}>{subtitle}</p>
                )}
                {page > 1 && (
                    <p style={{ fontSize: '15px', color: '#94a3b8', marginTop: '12px' }}>Сторінка {page} з {pages}</p>
                )}
            </div>

            {showHero && featuredPost && (
                <Link href={`/${locale}/blog/${featuredPost.slug}`} style={{ display: 'block', textDecoration: 'none', marginBottom: '60px' }}>
                    <div style={{ position: 'relative', borderRadius: '12px', overflow: 'hidden', height: '500px', display: 'flex', alignItems: 'flex-end', background: featuredPost.cover_image ? '#e2e8f0' : 'linear-gradient(135deg, #263A99 0%, #4254b5 55%, #aeb8e8 100%)', boxShadow: '0 20px 40px rgba(0,0,0,0.1)' }}>
                        {featuredPost.cover_image ? (
                            // Герой — це LCP першої сторінки, тож єдине зображення
                            // тут із priority. Решта сторінки лінькувата.
                            <Image
                                src={featuredPost.cover_image}
                                alt={featuredPost.cover_image_alt || getLocalized(featuredPost, locale, 'title')}
                                fill
                                priority
                                sizes="(max-width: 1200px) 100vw, 1152px"
                                style={{ objectFit: 'cover' }}
                            />
                        ) : (
                            // Обкладинки ще немає — показуємо той самий знак, що й у картках сітки,
                            // щоб місце під фото читалося як заготовка, а не як порожній прямокутник.
                            <div aria-hidden style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: '96px' }}>
                                <ImageIcon size={88} strokeWidth={1} color="rgba(255,255,255,0.32)" />
                            </div>
                        )}
                        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(38, 58, 153, 0.9) 0%, rgba(38, 58, 153, 0.4) 50%, transparent 100%)' }} />
                        <div style={{ position: 'relative', padding: '48px', width: '100%', maxWidth: '800px', color: 'white' }}>
                            {featuredPost.blog_categories && (
                                <span style={{ display: 'inline-block', backgroundColor: 'rgba(255,255,255,0.2)', padding: '4px 12px', borderRadius: '12px', fontSize: '13px', fontWeight: 600, marginBottom: '16px' }}>
                                    {stripEmoji(getLocalized(featuredPost.blog_categories, locale, 'name'))}
                                </span>
                            )}
                            {/* color обов'язковий: globals.css має правило h2 { color: var(--primary) },
                                і воно б'є успадкований від батька білий — заголовок ставав #263A99 на #263A99. */}
                            <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '40px', fontWeight: 900, lineHeight: 1.1, marginBottom: '16px', color: 'white' }}>
                                {getLocalized(featuredPost, locale, 'title')}
                            </h2>
                            <p style={{ fontSize: '18px', color: '#cbd5e1', marginBottom: '24px' }}>
                                {getLocalized(featuredPost, locale, 'excerpt')}
                            </p>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '24px', fontSize: '14px', color: '#cbd5e1', fontWeight: 500, flexWrap: 'wrap' }}>
                                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><User size={16} /> touch.memories</span>
                                {featuredPost.published_at && (
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Calendar size={16} /> {new Date(featuredPost.published_at).toLocaleDateString(dateFmt)}</span>
                                )}
                                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Clock size={16} /> {featuredPost.reading_time || 5} хв читання</span>
                            </div>
                        </div>
                    </div>
                </Link>
            )}

            {/* minmax(0, …) обов'язковий: у звичайного 1fr мінімум дорівнює min-content колонки,
                а рядок категорій розтягує його до власної ширини — колонка виходила на 1229px
                у сітці на 1152px, і третя картка ряду опинялася за межею екрана. */}
            <div className="blog-layout-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 340px', gap: '48px', alignItems: 'start' }}>
                <div>
                    {/* Фільтр веде на індексовані адреси категорій, а не на
                        /blog?category= — та форма закрита в robots.txt, тобто
                        посилання вело б робота в заборонене. */}
                    <nav aria-label="Категорії блогу" style={{ display: 'flex', gap: '12px', overflowX: 'auto', paddingBottom: '16px', marginBottom: '32px', scrollbarWidth: 'none' }}>
                        <Link href={`/${locale}/blog`} style={{ ...tabStyle, backgroundColor: categorySlug ? 'white' : '#263A99', color: categorySlug ? '#64748b' : 'white' }}>
                            Всі статті
                        </Link>
                        {(categories || []).map((cat: any) => (
                            <Link
                                key={cat.id}
                                href={`/${locale}/blog/category/${cat.slug}`}
                                aria-current={categorySlug === cat.slug ? 'page' : undefined}
                                style={{ ...tabStyle, backgroundColor: categorySlug === cat.slug ? '#263A99' : 'white', color: categorySlug === cat.slug ? 'white' : '#64748b' }}
                            >
                                {stripEmoji(getLocalized(cat, locale, 'name'))}
                            </Link>
                        ))}
                    </nav>

                    {posts && posts.length > 0 ? (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '28px' }}>
                            {posts.map((post: any) => (
                                <Link key={post.id} href={`/${locale}/blog/${post.slug}`} style={{ textDecoration: 'none', color: 'inherit', display: 'flex', flexDirection: 'column', height: '100%' }}>
                                    <div style={{ position: 'relative', width: '100%', paddingTop: '65%', borderRadius: '12px', overflow: 'hidden', backgroundColor: '#e2e8f0', marginBottom: '20px' }}>
                                        {post.cover_image ? (
                                            <Image
                                                src={post.cover_image}
                                                alt={post.cover_image_alt || getLocalized(post, locale, 'title')}
                                                fill
                                                loading="lazy"
                                                sizes="(max-width: 700px) 90vw, 360px"
                                                style={{ objectFit: 'cover' }}
                                            />
                                        ) : (
                                            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg, #263A99 0%, #4254b5 55%, #aeb8e8 100%)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px', padding: '28px' }}>
                                                <ImageIcon aria-hidden size={32} strokeWidth={1.25} color="rgba(255,255,255,0.45)" />
                                                <span style={{ fontFamily: 'var(--font-heading)', color: 'white', fontWeight: 800, fontSize: '20px', lineHeight: 1.25, textAlign: 'center' }}>
                                                    {getLocalized(post, locale, 'title')}
                                                </span>
                                            </div>
                                        )}
                                        {post.blog_categories && (
                                            <div style={{ position: 'absolute', top: '16px', left: '16px', backgroundColor: 'white', padding: '6px 14px', borderRadius: '12px', fontSize: '12px', fontWeight: 800, color: '#263A99', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
                                                {stripEmoji(getLocalized(post.blog_categories, locale, 'name'))}
                                            </div>
                                        )}
                                    </div>
                                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                                        <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '20px', fontWeight: 800, color: '#263A99', margin: '0 0 12px', lineHeight: 1.3 }}>
                                            {getLocalized(post, locale, 'title')}
                                        </h2>
                                        <p style={{ color: '#64748b', fontSize: '15px', lineHeight: 1.6, marginBottom: '20px', flex: 1 }}>
                                            {getLocalized(post, locale, 'excerpt')}
                                        </p>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto', borderTop: '1px solid #f1f5f9', paddingTop: '16px', fontSize: '12px', color: '#94a3b8' }}>
                                            <span>{post.published_at ? new Date(post.published_at).toLocaleDateString(dateFmt) : ''}</span>
                                            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                <Clock size={14} /> {post.reading_time || 5} хв
                                            </span>
                                        </div>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    ) : (
                        <div style={{ textAlign: 'center', padding: '60px', color: '#64748b', backgroundColor: 'white', borderRadius: '12px', border: '1px dashed #cbd5e1' }}>
                            У цій категорії ще немає статей.
                        </div>
                    )}

                    {pages > 1 && (
                        <nav aria-label="Сторінки" style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginTop: '60px', flexWrap: 'wrap' }}>
                            {Array.from({ length: pages }).map((_, i) => {
                                const n = i + 1;
                                const current = n === page;
                                return (
                                    <Link
                                        key={n}
                                        href={listPath(locale, categorySlug, n)}
                                        aria-current={current ? 'page' : undefined}
                                        style={{ width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '12px', fontWeight: 700, fontSize: '15px', textDecoration: 'none', backgroundColor: current ? '#263A99' : 'white', color: current ? 'white' : '#64748b', border: current ? 'none' : '1px solid #e2e8f0' }}
                                    >
                                        {n}
                                    </Link>
                                );
                            })}
                        </nav>
                    )}
                </div>

                <aside style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
                    <div style={{ backgroundColor: '#263A99', borderRadius: '12px', padding: '24px', color: 'white', textAlign: 'center' }}>
                        <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '18px', fontWeight: 800, marginBottom: '8px', color: 'white' }}>Залишайтеся на звʼязку</h2>
                        <p style={{ color: '#cbd5e1', fontSize: '13px', marginBottom: '16px' }}>Нові статті та ідеї приходитимуть на пошту.</p>
                        <form style={{ display: 'flex', flexDirection: 'column', gap: '8px' }} action="/api/newsletter" method="POST">
                            <input type="email" name="email" placeholder="Ваш email" required aria-label="Ваш email" style={{ width: '100%', padding: '10px 14px', borderRadius: '6px', border: 'none', backgroundColor: '#ffffff', color: '#1e2d7d', fontSize: '14px', outline: 'none' }} />
                            <button type="submit" style={{ width: '100%', padding: '8px 16px', borderRadius: '8px', backgroundColor: 'white', color: '#1e2d7d', border: 'none', fontWeight: 600, fontSize: '14px', cursor: 'pointer' }}>
                                Підписатися
                            </button>
                        </form>
                    </div>

                    {popularPosts && popularPosts.length > 0 && (
                        <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '24px', border: '1px solid #f1f5f9' }}>
                            <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '18px', fontWeight: 800, color: '#263A99', marginBottom: '20px' }}>Популярне</h2>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                {popularPosts.map((post: any, index: number) => (
                                    <Link key={post.id} href={`/${locale}/blog/${post.slug}`} style={{ display: 'flex', gap: '16px', textDecoration: 'none', color: 'inherit', alignItems: 'center' }}>
                                        <span aria-hidden style={{ fontSize: '24px', fontWeight: 900, color: '#e2e8f0', fontFamily: 'var(--font-heading)' }}>
                                            0{index + 1}
                                        </span>
                                        <span>
                                            <span style={{ display: 'block', fontSize: '14px', fontWeight: 700, color: '#263A99', marginBottom: '4px', lineHeight: 1.3 }}>
                                                {getLocalized(post, locale, 'title')}
                                            </span>
                                            <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                                                {post.published_at ? new Date(post.published_at).toLocaleDateString(dateFmt) : ''}
                                            </span>
                                        </span>
                                    </Link>
                                ))}
                            </div>
                        </div>
                    )}

                    {featuredProducts && featuredProducts.length > 0 && (
                        <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '24px', border: '1px solid #f1f5f9' }}>
                            <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '18px', fontWeight: 800, color: '#263A99', marginBottom: '20px' }}>Наші продукти</h2>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                {featuredProducts.map((product: any) => (
                                    <Link key={product.id} href={`/${locale}/catalog/${product.slug}`} style={{ textDecoration: 'none', color: 'inherit', display: 'flex', gap: '16px', alignItems: 'center' }}>
                                        <span style={{ width: '80px', height: '80px', borderRadius: '12px', overflow: 'hidden', backgroundColor: '#f8fafc', position: 'relative', flexShrink: 0, display: 'block' }}>
                                            {product.images?.[0] && (
                                                <Image src={product.images[0]} alt={product.name} fill loading="lazy" sizes="80px" style={{ objectFit: 'cover' }} />
                                            )}
                                        </span>
                                        <span>
                                            <span style={{ display: 'block', fontSize: '15px', fontWeight: 800, color: '#263A99', marginBottom: '4px' }}>{product.name}</span>
                                            <span style={{ fontSize: '14px', fontWeight: 700, color: '#263A99' }}>від {product.price} ₴</span>
                                        </span>
                                    </Link>
                                ))}
                                <Link href={`/${locale}/catalog`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '12px', borderRadius: '8px', backgroundColor: '#f8fafc', color: '#64748b', fontWeight: 700, fontSize: '13px', textDecoration: 'none', marginTop: '8px' }}>
                                    В каталог <ArrowRight size={16} />
                                </Link>
                            </div>
                        </div>
                    )}
                </aside>
            </div>
        </main>
    );
}

const tabStyle = { padding: '8px 20px', borderRadius: '10px', fontWeight: 700, fontSize: '14px', textDecoration: 'none', whiteSpace: 'nowrap' as const, border: '1px solid #e2e8f0' };
