import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import Image from 'next/image';
import { Calendar, Clock, ArrowRight, User } from 'lucide-react';
import { Navigation } from '@/components/ui/Navigation';
import { Footer } from '@/components/ui/Footer';
import { getLocalized } from '@/lib/i18n/localize';

export const metadata = {
  title: 'Блог — ідеї та натхнення | Touch.Memories',
  description: 'Поради, ідеї та натхнення для створення ідеальної фотокниги та незабутніх подарунків.',
};

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const stripEmoji = (text?: string) => {
    if (!text) return '';
    return text.replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}\u2764\uFE0F]/gu, '').replace(/\s+/g, ' ').trim();
};

const ARTICLES = [
  {
    slug: 'iak-stvoryty-fotoknyhu',
    category: 'Поради',
    title: 'Як створити ідеальну фотокнигу: 7 порад від дизайнерів',
    excerpt: 'Фотокнига — це розповідь, яка живе десятиліттями. Ось перевірені поради від наших дизайнерів.',
    readTime: '8 хв читання',
    image: 'https://images.unsplash.com/photo-1512820790803-83ca734da794?w=600&q=80',
    tag: 'photobooks',
  },
  {
    slug: 'travelbook-vs-photoalbum',
    category: 'Travel',
    title: 'Тревел-бук vs фотоальбом: що обрати для спогадів про подорож?',
    excerpt: 'Порівнюємо два популярні формати, щоб допомогти вам обрати ідеальний.',
    readTime: '5 хв читання',
    image: 'https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=600&q=80',
    tag: 'travel',
  },
  {
    slug: 'vesil-ni-podarunky',
    category: 'Весілля',
    title: 'Топ-5 ідей для весільного альбому, який захоплює подих',
    excerpt: 'Весільний альбом — перша книга вашої сім\'ї. Ось як зробити його незабутнім.',
    readTime: '6 хв читання',
    image: 'https://images.unsplash.com/photo-1519741497674-611481863552?w=600&q=80',
    tag: 'wedding',
  },
];

export default async function BlogHomePage({ searchParams, params }: { searchParams: Promise<{ category?: string, page?: string }>, params: Promise<{ locale?: string }> }) {
    const { locale: loc } = await params;
    const locale = loc || 'uk';
    const supabase = await createClient();
    const { category, page } = await searchParams;
    const currentPage = parseInt(page || '1');
    const limit = 9;
    const offset = (currentPage - 1) * limit;

    // Fetch Categories
    const { data: categories } = await supabase.from('blog_categories').select('*').eq('is_active', true).order('sort_order');

    // Build Posts Query
    let query = supabase.from('blog_posts')
        .select('*, blog_categories(name, slug)', { count: 'exact' })
        .eq('is_published', true)
        .order('published_at', { ascending: false })
        .range(offset, offset + limit - 1);

    if (category && category !== 'all') {
        const selectedCat = categories?.find(c => c.slug === category);
        if (selectedCat) {
            query = query.eq('category_id', selectedCat.id);
        }
    }

    const { data: posts, count } = await query;

    // Fetch Featured Post (Hero)
    const { data: featuredPost } = await supabase.from('blog_posts')
        .select('*, blog_categories(name, slug)')
        .eq('is_published', true)
        .eq('is_featured', true)
        .order('published_at', { ascending: false })
        .limit(1)
        .maybeSingle();

    // Fetch Popular Posts
    const { data: popularPosts } = await supabase.from('blog_posts')
        .select('id, title, slug, cover_image, views_count, published_at')
        .eq('is_published', true)
        .order('views_count', { ascending: false })
        .limit(5);

    // Fetch 3 popular products (simplification, getting first 3 active products)
    const { data: featuredProducts } = await supabase.from('products')
        .select('id, name, slug, price, images')
        .eq('is_active', true)
        .limit(3);

    const totalPages = Math.ceil((count || 0) / limit);

    return (
        <div style={{ backgroundColor: '#f8fafc', minHeight: '100vh', fontFamily: 'var(--font-primary)', overflowX: 'hidden' }}>
            <Navigation />

            <main style={{ paddingTop: '100px', paddingBottom: '80px', maxWidth: '1200px', margin: '0 auto', padding: '100px 24px 80px' }}>
                <div style={{ textAlign: 'center', marginBottom: '60px' }}>
                    <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '48px', fontWeight: 900, color: '#263A99', marginBottom: '16px', letterSpacing: '-0.02em' }}>
                        Блог TouchMemories
                    </h1>
                    <p style={{ fontSize: '18px', color: '#64748b', maxWidth: '600px', margin: '0 auto' }}>
                        Натхнення, ідеї для подарунків та поради щодо створення ідеальної фотокниги.
                    </p>
                </div>

                {/* Hero Featured Article */}
                {!category && featuredPost && currentPage === 1 && (
                    <Link href={`/blog/${featuredPost.slug}`} style={{ display: 'block', textDecoration: 'none', marginBottom: '60px' }}>
                        <div style={{ position: 'relative', borderRadius: "12px", overflow: 'hidden', height: '500px', display: 'flex', alignItems: 'flex-end', backgroundColor: '#e2e8f0', boxShadow: '0 20px 40px rgba(0,0,0,0.1)' }}>
                            {featuredPost.cover_image && (
                                <Image src={featuredPost.cover_image} alt={getLocalized(featuredPost, locale, "title")} fill style={{ objectFit: 'cover' }} priority />
                            )}
                            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(38, 58, 153, 0.9) 0%, rgba(38, 58, 153, 0.4) 50%, transparent 100%)' }} />
                            <div style={{ position: 'relative', padding: '48px', width: '100%', maxWidth: '800px', color: 'white' }}>
                                <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
                                    <span style={{ backgroundColor: '#263A99', color: 'white', padding: '4px 12px', borderRadius: "12px", fontSize: '13px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                        Featured
                                    </span>
                                    {featuredPost.blog_categories && (
                                        <span style={{ backgroundColor: 'rgba(255,255,255,0.2)', backdropFilter: 'blur(4px)', padding: '4px 12px', borderRadius: "12px", fontSize: '13px', fontWeight: 600 }}>
                                            {stripEmoji(featuredPost.blog_categories.name)}
                                        </span>
                                    )}
                                </div>
                                <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '40px', fontWeight: 900, lineHeight: 1.1, marginBottom: '16px' }}>
                                    {getLocalized(featuredPost, locale, "title")}
                                </h2>
                                <p style={{ fontSize: '18px', color: '#cbd5e1', marginBottom: '24px', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                                    {getLocalized(featuredPost, locale, "excerpt")}
                                </p>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '24px', fontSize: '14px', color: '#94a3b8', fontWeight: 500 }}>
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><User size={16} /> {featuredPost.author_name}</span>
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Calendar size={16} /> {new Date(featuredPost.published_at).toLocaleDateString('uk-UA')}</span>
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Clock size={16} /> {featuredPost.reading_time} хв читання</span>
                                </div>
                            </div>
                        </div>
                    </Link>
                )}

                <div className="blog-layout-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '48px', alignItems: 'start' }}>

                    {/* Main Content Area */}
                    <div>
                        {/* Categories Tabs */}
                        <div style={{ display: 'flex', gap: '12px', overflowX: 'auto', paddingBottom: '16px', marginBottom: '32px', scrollbarWidth: 'none' }}>
                            <Link href="/blog" style={{ ...tabStyle, backgroundColor: !category || category === 'all' ? '#263A99' : 'white', color: !category || category === 'all' ? 'white' : '#64748b' }}>Всі статті</Link>
                            {categories?.map((cat) => (
                                <Link
                                    key={cat.id}
                                    href={`/blog?category=${cat.slug}`}
                                    style={{ ...tabStyle, backgroundColor: category === cat.slug ? '#263A99' : 'white', color: category === cat.slug ? 'white' : '#64748b' }}
                                >
                                    {stripEmoji(cat.name)}
                                </Link>
                            ))}
                        </div>

                        {/* Article Grid */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '32px' }}>
                            {(posts && posts.length > 0 ? posts : ARTICLES as any).map((post: any, index: number) => (
                                <Link key={post.id || post.slug} href={`/blog/${post.slug}`} style={{ textDecoration: 'none', color: 'inherit', display: 'flex', flexDirection: 'column', height: '100%', group: 'article' } as any}>
                                    <div style={{ position: 'relative', width: '100%', paddingTop: '65%', borderRadius: "12px", overflow: 'hidden', backgroundColor: '#e2e8f0', marginBottom: '20px' }}>
                                        {(post.cover_image || post.image) && <Image src={post.cover_image || post.image} alt={getLocalized(post, locale, "title")} fill style={{ objectFit: 'cover', transition: 'transform 0.5s ease' }} className="hover:scale-105" />}
                                        {(post.blog_categories || post.category) && (
                                            <div style={{ position: 'absolute', top: '16px', left: '16px', backgroundColor: 'white', padding: '6px 14px', borderRadius: "12px", fontSize: '12px', fontWeight: 800, color: '#263A99', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
                                                {stripEmoji(post.blog_categories?.name || post.category)}
                                            </div>
                                        )}
                                    </div>
                                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                                        <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '20px', fontWeight: 800, color: '#263A99', marginBottom: '12px', lineHeight: 1.3 }}>
                                            {getLocalized(post, locale, "title")}
                                        </h3>
                                        <p style={{ color: '#64748b', fontSize: '15px', lineHeight: 1.6, marginBottom: '20px', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', flex: 1 }}>
                                            {getLocalized(post, locale, "excerpt")}
                                        </p>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto', borderTop: '1px solid #f1f5f9', paddingTop: '16px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                {post.author_avatar ? (
                                                    // eslint-disable-next-line @next/next/no-img-element
                                                    <img src={post.author_avatar} alt="" style={{ width: '28px', height: '28px', borderRadius: "12px" }} />
                                                ) : (
                                                    <div style={{ width: '28px', height: '28px', borderRadius: "12px", backgroundColor: '#cbd5e1', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
                                                        <User size={14} />
                                                    </div>
                                                )}
                                                <div>
                                                    <div style={{ fontSize: '12px', fontWeight: 700, color: '#263A99' }}>{post.author_name || 'TouchMemories'}</div>
                                                    <div style={{ fontSize: '11px', color: '#94a3b8' }}>{post.published_at ? new Date(post.published_at).toLocaleDateString('uk-UA') : 'Сьогодні'}</div>
                                                </div>
                                            </div>
                                            <div style={{ fontSize: '12px', fontWeight: 600, color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                <Clock size={14} /> {post.reading_time || post.readTime}
                                            </div>
                                        </div>
                                    </div>
                                </Link>
                            ))}
                        </div>

                        {/* Pagination */}
                        {totalPages > 1 && (
                            <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginTop: '60px' }}>
                                {Array.from({ length: totalPages }).map((_, i) => (
                                    <Link
                                        key={i}
                                        href={`/blog?page=${i + 1}${category ? `&category=${category}` : ''}`}
                                        style={{ width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: "12px", fontWeight: 700, fontSize: '15px', textDecoration: 'none', backgroundColor: currentPage === i + 1 ? '#263A99' : 'white', color: currentPage === i + 1 ? 'white' : '#64748b', border: currentPage === i + 1 ? 'none' : '1px solid #e2e8f0' }}
                                    >
                                        {i + 1}
                                    </Link>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Sidebar */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>

                        {/* Newsletter */}
                        <div style={{ backgroundColor: '#263A99', borderRadius: "12px", padding: '24px', color: 'white', textAlign: 'center' }}>
                            <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '18px', fontWeight: 800, marginBottom: '8px' }}>Залишайся на зв'язку</h3>
                            <p style={{ color: '#94a3b8', fontSize: '13px', marginBottom: '16px' }}>Нові статті та ідеї — прямо на пошту.</p>
                            <form style={{ display: 'flex', flexDirection: 'column', gap: '8px' }} action="/api/newsletter" method="POST">
                                <input
                                    type="email"
                                    placeholder="Ваш email"
                                    required
                                    style={{
                                        width: '100%',
                                        padding: '10px 14px',
                                        borderRadius: '6px',
                                        border: 'none',
                                        backgroundColor: '#ffffff',
                                        color: '#1e2d7d',
                                        fontSize: '14px',
                                        outline: 'none'
                                    }}
                                    className="placeholder:text-[#9ca3af]"
                                />
                                <button type="submit" style={{ width: '100%', padding: '8px 16px', borderRadius: '8px', backgroundColor: 'white', color: '#1e2d7d', border: 'none', fontWeight: 600, fontSize: '14px', cursor: 'pointer', transition: 'background 0.2s' } as any}>
                                    Підписатися
                                </button>
                            </form>
                        </div>

                        {/* Popular Posts */}
                        {popularPosts && popularPosts.length > 0 && (
                            <div style={{ backgroundColor: 'white', borderRadius: "12px", padding: '24px', border: '1px solid #f1f5f9' }}>
                                <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '18px', fontWeight: 800, color: '#263A99', marginBottom: '20px' }}>Популярне</h3>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                    {popularPosts.map((post, index) => (
                                        <Link key={post.id} href={`/blog/${post.slug}`} style={{ display: 'flex', gap: '16px', textDecoration: 'none', color: 'inherit', alignItems: 'center' }}>
                                            <div style={{ fontSize: '24px', fontWeight: 900, color: '#e2e8f0', fontFamily: 'var(--font-heading)' }}>
                                                0{index + 1}
                                            </div>
                                            <div>
                                                <h4 style={{ fontSize: '14px', fontWeight: 700, color: '#263A99', marginBottom: '4px', lineHeight: 1.3 }}>{getLocalized(post, locale, "title")}</h4>
                                                <span style={{ fontSize: '11px', color: '#94a3b8' }}>{new Date(post.published_at).toLocaleDateString('uk-UA')}</span>
                                            </div>
                                        </Link>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Featured Products */}
                        {featuredProducts && featuredProducts.length > 0 && (
                            <div style={{ backgroundColor: 'white', borderRadius: "12px", padding: '24px', border: '1px solid #f1f5f9' }}>
                                <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '18px', fontWeight: 800, color: '#263A99', marginBottom: '20px' }}>Наші продукти</h3>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                    {featuredProducts.map(product => (
                                        <Link key={product.id} href={`/products/${product.slug}`} style={{ textDecoration: 'none', color: 'inherit', display: 'flex', gap: '16px', alignItems: 'center' }}>
                                            <div style={{ width: '80px', height: '80px', borderRadius: "12px", overflow: 'hidden', backgroundColor: '#f8fafc', position: 'relative', flexShrink: 0 }}>
                                                {product.images && product.images[0] && (
                                                    <Image src={product.images[0]} alt={product.name} fill style={{ objectFit: 'cover' }} />
                                                )}
                                            </div>
                                            <div>
                                                <h4 style={{ fontSize: '15px', fontWeight: 800, color: '#263A99', marginBottom: '4px' }}>{product.name}</h4>
                                                <div style={{ fontSize: '14px', fontWeight: 700, color: '#263A99' }}>{product.price} ₴</div>
                                            </div>
                                        </Link>
                                    ))}
                                    <Link href="/products" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '12px', borderRadius: '8px', backgroundColor: '#f8fafc', color: '#64748b', fontWeight: 700, fontSize: '13px', textDecoration: 'none', marginTop: '8px' }}>
                                        В каталог <ArrowRight size={16} />
                                    </Link>
                                </div>
                            </div>
                        )}

                    </div>
                </div>
            </main>

            <Footer />
        </div>
    );
}

const tabStyle = { padding: '8px 20px', borderRadius: '10px', fontWeight: 700, fontSize: '14px', textDecoration: 'none', whiteSpace: 'nowrap' as any, border: '1px solid #e2e8f0', transition: 'all 0.2s' };
