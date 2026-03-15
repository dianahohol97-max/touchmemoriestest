import { createClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Clock, User, ArrowLeft } from 'lucide-react';
import { Navigation } from '@/components/ui/Navigation';
import { Footer } from '@/components/ui/Footer';

export const revalidate = 3600;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
    const { slug } = await params;
    const supabase = await createClient();
    const { data: category } = await supabase.from('blog_categories').select('*').eq('slug', slug).single();

    if (!category) {
        return { title: 'Категорію не знайдено | TouchMemories Блог' };
    }

    return {
        title: `${category.name} | TouchMemories Блог`,
        description: category.description || `Читайте статті в категорії ${category.name}`,
    };
}

export default async function CategoryPage({ params, searchParams }: { params: Promise<{ slug: string }>, searchParams: Promise<{ page?: string }> }) {
    const { slug } = await params;
    const { page } = await searchParams;
    const supabase = await createClient();

    const { data: category } = await supabase.from('blog_categories').select('*').eq('slug', slug).single();
    if (!category) notFound();

    const currentPage = parseInt(page || '1');
    const limit = 9;
    const offset = (currentPage - 1) * limit;

    const { data: posts, count } = await supabase.from('blog_posts')
        .select('*, blog_categories(name)', { count: 'exact' })
        .eq('category_id', category.id)
        .eq('is_published', true)
        .order('published_at', { ascending: false })
        .range(offset, offset + limit - 1);

    const totalPages = Math.ceil((count || 0) / limit);

    return (
        <div style={{ backgroundColor: '#f8fafc', minHeight: '100vh', fontFamily: 'var(--font-primary)' }}>
            <Navigation />

            <main style={{ paddingTop: '140px', paddingBottom: '100px', maxWidth: '1200px', margin: '0 auto', paddingLeft: '24px', paddingRight: '24px' }}>
                <Link href="/blog" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', color: '#64748b', fontWeight: 600, fontSize: '14px', marginBottom: '32px', textDecoration: 'none' }}>
                    <ArrowLeft size={16} /> До всіх статей
                </Link>

                <div style={{ marginBottom: '60px' }}>
                    <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '40px', fontWeight: 900, color: '#263A99', marginBottom: '16px', letterSpacing: '-0.02em' }}>
                        {category.name}
                    </h1>
                    {category.description && (
                        <p style={{ fontSize: '18px', color: '#64748b', maxWidth: '600px' }}>
                            {category.description}
                        </p>
                    )}
                </div>

                {posts && posts.length > 0 ? (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '32px' }}>
                        {posts.map((post: any) => (
                            <Link key={post.id} href={`/blog/${post.slug}`} style={{ textDecoration: 'none', color: 'inherit', display: 'flex', flexDirection: 'column', height: '100%' } as any}>
                                <div style={{ position: 'relative', width: '100%', paddingTop: '65%', borderRadius: '24px', overflow: 'hidden', backgroundColor: '#e2e8f0', marginBottom: '20px' }}>
                                    {post.cover_image && <Image src={post.cover_image} alt={post.title} fill style={{ objectFit: 'cover', transition: 'transform 0.5s ease' }} className="hover:scale-105" />}
                                </div>
                                <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                                    <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '20px', fontWeight: 800, color: '#263A99', marginBottom: '12px', lineHeight: 1.3 }}>
                                        {post.title}
                                    </h3>
                                    <p style={{ color: '#64748b', fontSize: '15px', lineHeight: 1.6, marginBottom: '20px', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', flex: 1 }}>
                                        {post.excerpt}
                                    </p>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto', borderTop: '1px solid #f1f5f9', paddingTop: '16px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <div style={{ width: '28px', height: '28px', borderRadius: '50%', backgroundColor: '#cbd5e1', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
                                                <User size={14} />
                                            </div>
                                            <div>
                                                <div style={{ fontSize: '12px', fontWeight: 700, color: '#263A99' }}>{post.author_name}</div>
                                                <div style={{ fontSize: '11px', color: '#94a3b8' }}>{new Date(post.published_at).toLocaleDateString('uk-UA')}</div>
                                            </div>
                                        </div>
                                        <div style={{ fontSize: '12px', fontWeight: 600, color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                            <Clock size={14} /> {post.reading_time} хв
                                        </div>
                                    </div>
                                </div>
                            </Link>
                        ))}
                    </div>
                ) : (
                    <div style={{ textAlign: 'center', padding: '60px', color: '#64748b', backgroundColor: 'white', borderRadius: '24px', border: '1px dashed #cbd5e1' }}>
                        В цій категорії ще немає статей.
                    </div>
                )}

                {/* Pagination */}
                {totalPages > 1 && (
                    <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginTop: '60px' }}>
                        {Array.from({ length: totalPages }).map((_, i) => (
                            <Link
                                key={i}
                                href={`/blog/category/${category.slug}?page=${i + 1}`}
                                style={{ width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '12px', fontWeight: 700, fontSize: '15px', textDecoration: 'none', backgroundColor: currentPage === i + 1 ? '#263A99' : 'white', color: currentPage === i + 1 ? 'white' : '#64748b', border: currentPage === i + 1 ? 'none' : '1px solid #e2e8f0' }}
                            >
                                {i + 1}
                            </Link>
                        ))}
                    </div>
                )}
            </main>
            <Footer />
        </div>
    );
}
