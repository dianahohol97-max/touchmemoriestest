import { createClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { Calendar, Clock, User, ArrowRight, Share2, Facebook, Link as LinkIcon } from 'lucide-react';
import { Navigation } from '@/components/ui/Navigation';
import { Footer } from '@/components/ui/Footer';
import MarkdownViewer from '@/components/ui/MarkdownViewer';

export const revalidate = 3600;

export async function generateStaticParams() {
    // We could fetch top 100 slugs here, but returning [] and relying on ISR is fine for now
    return [];
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
    const { slug } = await params;

    try {
        const supabase = await createClient();
        const { data: post, error } = await supabase.from('blog_posts').select('*').eq('slug', slug).single();

        if (error || !post) {
            return {
                title: 'Статтю не знайдено | TouchMemories'
            };
        }

        return {
            title: post?.meta_title || `${post?.title || 'Стаття'} | TouchMemories`,
            description: post?.meta_description || post?.excerpt || '',
            openGraph: {
                title: post?.og_title || post?.meta_title || post?.title || 'Стаття',
                description: post?.meta_description || post?.excerpt || '',
                images: post?.cover_image ? [{ url: post.cover_image, width: 1200, height: 630 }] : [],
                type: 'article',
                publishedTime: post?.published_at,
                authors: post?.author_name ? [post.author_name] : []
            }
        };
    } catch (error) {
        return {
            title: 'Статтю не знайдено | TouchMemories'
        };
    }
}

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
    const { slug } = await params;
    const supabase = await createClient();

    let post: any = null;

    try {
        const { data, error } = await supabase
            .from('blog_posts')
            .select('*, blog_categories(*)')
            .eq('slug', slug)
            .eq('is_published', true)
            .single();

        if (error || !data) {
            notFound();
        }

        post = data;
    } catch (error) {
        notFound();
    }

    if (!post) notFound();

    // Try finding related products
    let relatedProducts: any[] = [];
    if (post?.related_product_ids && Array.isArray(post.related_product_ids) && post.related_product_ids.length > 0) {
        try {
            const { data } = await supabase.from('products').select('*').in('id', post.related_product_ids);
            if (data) relatedProducts = data;
        } catch (error) {
            // Silently fail for related products
            relatedProducts = [];
        }
    }

    // Try finding 3 similar articles
    let similarPosts: any[] = [];
    if (post?.category_id) {
        try {
            const { data } = await supabase
                .from('blog_posts')
                .select('id, title, slug, cover_image, published_at')
                .eq('category_id', post.category_id)
                .neq('id', post.id)
                .eq('is_published', true)
                .limit(3);
            if (data) similarPosts = data;
        } catch (error) {
            // Silently fail for similar posts
            similarPosts = [];
        }
    }

    const domain = process.env.NEXT_PUBLIC_SITE_URL || 'https://touchmemories.com.ua';
    const currentUrl = `${domain}/blog/${post?.slug || slug}`;

    const jsonLdArticle = {
        '@context': 'https://schema.org',
        '@type': 'Article',
        'headline': post?.title || '',
        'image': post?.cover_image ? [post.cover_image] : [],
        'author': {
            '@type': 'Person',
            'name': post?.author_name || 'TouchMemories'
        },
        'publisher': {
            '@type': 'Organization',
            'name': 'TouchMemories',
            // 'logo': { '@type': 'ImageObject', 'url': `${domain}/logo.png` }
        },
        'datePublished': post?.published_at || new Date().toISOString(),
        'dateModified': post?.updated_at || post?.published_at || new Date().toISOString(),
        'description': post?.meta_description || post?.excerpt || ''
    };

    const jsonLdBreadcrumb = {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        'itemListElement': [
            { '@type': 'ListItem', 'position': 1, 'name': 'Головна', 'item': domain },
            { '@type': 'ListItem', 'position': 2, 'name': 'Блог', 'item': `${domain}/blog` },
            {
                '@type': 'ListItem',
                'position': 3,
                'name': post?.blog_categories?.name || 'Стаття',
                'item': post?.blog_categories ? `${domain}/blog?category=${post.blog_categories.slug}` : `${domain}/blog`
            },
            { '@type': 'ListItem', 'position': 4, 'name': post?.title || '' }
        ]
    };

    return (
        <div style={{ backgroundColor: 'white', minHeight: '100vh', fontFamily: 'var(--font-primary)' }}>
            <Navigation />

            <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdArticle) }} />
            <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdBreadcrumb) }} />

            {/* View Counter Trigger */}
            <script dangerouslySetInnerHTML={{
                __html: `
                    fetch('/api/blog/${post?.slug || slug}/view', { method: 'POST', keepalive: true }).catch(console.error);
                `
            }} />

            <main style={{ paddingTop: '100px', paddingBottom: '100px' }}>
                <article style={{ maxWidth: '800px', margin: '0 auto', padding: '0 24px' }}>

                    {/* Breadcrumbs */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: '#94a3b8', marginBottom: '32px', paddingTop: '40px' }}>
                        <Link href="/" style={{ color: 'inherit', textDecoration: 'none' }}>Головна</Link>
                        <span>→</span>
                        <Link href="/blog" style={{ color: 'inherit', textDecoration: 'none' }}>Блог</Link>
                        <span>→</span>
                        {post?.blog_categories && (
                            <>
                                <Link href={`/blog?category=${post.blog_categories.slug}`} style={{ color: 'inherit', textDecoration: 'none' }}>{post.blog_categories.name}</Link>
                                <span>→</span>
                            </>
                        )}
                        <span style={{ color: '#263A99', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{post?.title || ''}</span>
                    </div>

                    {/* Header */}
                    <header style={{ marginBottom: '40px' }}>
                        {post?.blog_categories && (
                            <Link href={`/blog?category=${post.blog_categories.slug}`} style={{ display: 'inline-block', backgroundColor: '#f1f5f9', color: '#263A99', padding: '6px 16px', borderRadius: "3px", fontSize: '13px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '24px', textDecoration: 'none' }}>
                                {post.blog_categories.name}
                            </Link>
                        )}
                        <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '48px', fontWeight: 900, color: '#263A99', lineHeight: 1.1, marginBottom: '24px', letterSpacing: '-0.02em' }}>
                            {post?.title || ''}
                        </h1>
                        <p style={{ fontSize: '20px', color: '#64748b', lineHeight: 1.6, marginBottom: '32px' }}>
                            {post?.excerpt || ''}
                        </p>

                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid #f1f5f9', borderBottom: '1px solid #f1f5f9', padding: '20px 0' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                {post?.author_avatar ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img src={post.author_avatar} alt={post?.author_name || 'Author'} style={{ width: '48px', height: '48px', borderRadius: "3px" }} />
                                ) : (
                                    <div style={{ width: '48px', height: '48px', borderRadius: "3px", backgroundColor: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>
                                        <User size={24} />
                                    </div>
                                )}
                                <div>
                                    <div style={{ fontWeight: 800, color: '#263A99', fontSize: '16px' }}>{post?.author_name || 'TouchMemories'}</div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '14px', color: '#94a3b8', marginTop: '4px' }}>
                                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Calendar size={14} /> {post?.published_at ? new Date(post.published_at).toLocaleDateString('uk-UA') : ''}</span>
                                        <span>•</span>
                                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Clock size={14} /> {post?.reading_time || 5} хв</span>
                                        <span>•</span>
                                        <span>👁 {(post?.views_count || 0) + 1}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Share Buttons */}
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <a href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(currentUrl)}`} target="_blank" rel="noreferrer" style={shareBtnStyle}>
                                    <Facebook size={18} />
                                </a>
                                <button onClick={() => { /* copy to clipboard not simple in Server Component without client wrapper, use target="_blank" pattern or just let it be dummy for now */ }} style={shareBtnStyle}>
                                    <LinkIcon size={18} />
                                </button>
                            </div>
                        </div>
                    </header>

                    {/* Cover Image */}
                    {post?.cover_image && (
                        <div style={{ width: '100%', height: '500px', position: 'relative', borderRadius: "3px", overflow: 'hidden', marginBottom: '48px', backgroundColor: '#f8fafc' }}>
                            <Image src={post.cover_image} alt={post?.cover_image_alt || post?.title || 'Cover image'} fill style={{ objectFit: 'cover' }} priority />
                        </div>
                    )}

                    {/* Article Content */}
                    <div style={{ fontSize: '18px', lineHeight: 1.8, color: '#263A99', marginBottom: '60px' }}>
                        <MarkdownViewer source={post?.content || ''} />
                    </div>

                    {/* Tags */}
                    {post?.tags && Array.isArray(post.tags) && post.tags.length > 0 && (
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '48px' }}>
                            {post.tags.map((tag: string) => (
                                <Link key={tag} href={`/blog/tag/${tag}`} style={{ backgroundColor: '#f1f5f9', color: '#475569', padding: '6px 16px', borderRadius: "3px", fontSize: '14px', fontWeight: 600, textDecoration: 'none', transition: 'background 0.2s', ':hover': { backgroundColor: '#e2e8f0' } } as any}>
                                    #{tag}
                                </Link>
                            ))}
                        </div>
                    )}

                    {/* Related Products */}
                    {relatedProducts.length > 0 && (
                        <div style={{ borderTop: '2px dashed #f1f5f9', paddingTop: '40px', marginBottom: '60px' }}>
                            <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '24px', fontWeight: 900, color: '#263A99', marginBottom: '24px' }}>
                                Згадані товари
                            </h3>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '20px' }}>
                                {relatedProducts.map((p: any) => (
                                    <Link key={p?.id} href={`/products/${p?.slug || ''}`} style={{ border: '1px solid #f1f5f9', borderRadius: "3px", padding: '16px', textDecoration: 'none', color: 'inherit', display: 'flex', flexDirection: 'column', transition: 'border-color 0.2s', ':hover': { borderColor: '#cbd5e1' } } as any}>
                                        <div style={{ width: '100%', aspectRatio: '1/1', position: 'relative', borderRadius: "3px", overflow: 'hidden', backgroundColor: '#f8fafc', marginBottom: '16px' }}>
                                            {p?.images && Array.isArray(p.images) && p.images[0] && <Image src={p.images[0]} alt={p?.name || 'Product'} fill style={{ objectFit: 'cover' }} />}
                                        </div>
                                        <h4 style={{ fontWeight: 800, fontSize: '15px', color: '#263A99', marginBottom: '8px' }}>{p?.name || ''}</h4>
                                        <div style={{ color: '#263A99', fontWeight: 700, fontSize: '14px', marginTop: 'auto' }}>{p?.price || 0} ₴</div>
                                    </Link>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* CTA Banner */}
                    <div style={{ backgroundColor: '#263A99', borderRadius: "3px", padding: '40px', color: 'white', textAlign: 'center', marginBottom: '80px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '28px', fontWeight: 900, marginBottom: '16px' }}>Готові створити свою фотокнигу?</h3>
                        <p style={{ fontSize: '16px', color: '#94a3b8', marginBottom: '32px', maxWidth: '400px' }}>Спробуйте наш зручний онлайн-конструктор та збережіть свої найкращі фото на сторінках преміум фотокниги.</p>
                        <Link href="/constructor/photobook" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '16px 32px', backgroundColor: '#263A99', color: 'white', borderRadius: '9999px', fontWeight: 800, fontSize: '16px', textDecoration: 'none', transition: 'transform 0.2s', ':hover': { transform: 'scale(1.05)' } } as any}>
                            Спробувати конструктор <ArrowRight size={20} />
                        </Link>
                    </div>

                </article>

                {/* Similar Posts */}
                {similarPosts.length > 0 && (
                    <div style={{ backgroundColor: '#f8fafc', padding: '80px 24px' }}>
                        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
                            <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '32px', fontWeight: 900, color: '#263A99', marginBottom: '40px', textAlign: 'center' }}>
                                Читайте також
                            </h3>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '32px' }}>
                                {similarPosts.map(sp => (
                                    <Link key={sp?.id} href={`/blog/${sp?.slug || ''}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                                        <div style={{ position: 'relative', width: '100%', paddingTop: '65%', borderRadius: "3px", overflow: 'hidden', backgroundColor: '#e2e8f0', marginBottom: '20px' }}>
                                            {sp?.cover_image && <Image src={sp.cover_image} alt={sp?.title || 'Article'} fill style={{ objectFit: 'cover' }} />}
                                        </div>
                                        <h4 style={{ fontFamily: 'var(--font-heading)', fontSize: '20px', fontWeight: 800, color: '#263A99', marginBottom: '12px' }}>{sp?.title || ''}</h4>
                                        <div style={{ fontSize: '13px', color: '#94a3b8' }}>{sp?.published_at ? new Date(sp.published_at).toLocaleDateString('uk-UA') : ''}</div>
                                    </Link>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </main>

            <Footer />
        </div>
    );
}

const shareBtnStyle = { display: 'flex', alignItems: 'center', justifyContent: 'center', width: '40px', height: '40px', borderRadius: "3px", backgroundColor: '#f1f5f9', color: '#64748b', border: 'none', cursor: 'pointer', transition: 'all 0.2s' };
