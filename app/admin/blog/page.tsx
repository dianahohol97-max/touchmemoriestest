'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import {
    Plus,
    Edit,
    Trash2,
    Eye,
    Globe,
    FileLock2,
    Search,
    Copy,
    Loader2
} from 'lucide-react';
import { toast } from 'sonner';
import Image from 'next/image';

export default function AdminBlogPostsPage() {
    const supabase = createClient();
    const [posts, setPosts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [filter, setFilter] = useState<'all' | 'published' | 'drafts'>('all');

    useEffect(() => {
        fetchPosts();
    }, [filter]);

    async function fetchPosts() {
        setLoading(true);
        let query = supabase
            .from('blog_posts')
            .select('*, blog_categories(name)')
            .order('created_at', { ascending: false });

        if (filter === 'published') {
            query = query.eq('is_published', true);
        } else if (filter === 'drafts') {
            query = query.eq('is_published', false);
        }

        const { data, error } = await query;
        if (error) {
            toast.error(error.message);
        } else {
            setPosts(data || []);
        }
        setLoading(false);
    }

    const togglePublish = async (post: any) => {
        try {
            const { error } = await supabase
                .from('blog_posts')
                .update({
                    is_published: !post.is_published,
                    published_at: !post.is_published ? new Date().toISOString() : null
                })
                .eq('id', post.id);

            if (error) throw error;
            toast.success(post.is_published ? 'Знято з публікації' : 'Опубліковано');
            fetchPosts();
        } catch (error: any) {
            toast.error(error.message);
        }
    };

    const duplicatePost = async (post: any) => {
        if (!confirm('Дублювати статтю?')) return;
        try {
            const { error } = await supabase.from('blog_posts').insert([{
                title: `${post.title} (Копія)`,
                slug: `${post.slug}-copy-${Date.now()}`,
                category_id: post.category_id,
                author_name: post.author_name,
                cover_image: post.cover_image,
                excerpt: post.excerpt,
                content: post.content,
                keywords: post.keywords || [],
                content_images: post.content_images || [],
                is_published: false
            }]);

            if (error) throw error;
            toast.success('Статтю здубльовано');
            fetchPosts();
        } catch (error: any) {
            toast.error(error.message);
        }
    };

    const deletePost = async (id: string) => {
        if (!confirm('Видалити статтю назавжди?')) return;
        try {
            const { error } = await supabase.from('blog_posts').delete().eq('id', id);
            if (error) throw error;
            toast.success('Видалено');
            setPosts(posts.filter(p => p.id !== id));
        } catch (error: any) {
            toast.error(error.message);
        }
    };

    const filteredPosts = posts.filter(post => post.title.toLowerCase().includes(search.toLowerCase()));

    return (
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px' }}>
                <div>
                    <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '28px', fontWeight: 900, color: '#263A99', marginBottom: '8px' }}>Всі статті блогу</h1>
                    <p style={{ color: '#64748b' }}>Керуйте вмістом блогу, чернетками та публікаціями.</p>
                </div>
                <Link href="/admin/blog/new" style={addBtnStyle}>
                    <Plus size={20} />
                    Нова стаття
                </Link>
            </div>

            <div style={{ backgroundColor: 'white', borderRadius: "3px", border: '1px solid #f1f5f9', boxShadow: '0 4px 15px rgba(0,0,0,0.01)', padding: '24px', marginBottom: '24px' }}>
                <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                    <div style={{ position: 'relative', flex: 1 }}>
                        <Search size={18} color="#94a3b8" style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)' }} />
                        <input
                            type="text"
                            placeholder="Пошук за заголовком..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            style={{ width: '100%', padding: '12px 16px 12px 44px', borderRadius: "3px", border: '1.5px solid #e2e8f0', outline: 'none', fontSize: '14px', backgroundColor: '#f8fafc' }}
                        />
                    </div>
                    <div style={{ display: 'flex', gap: '8px', backgroundColor: '#f8fafc', padding: '4px', borderRadius: "3px", border: '1.5px solid #e2e8f0' }}>
                        {(['all', 'published', 'drafts'] as const).map(f => (
                            <button
                                key={f}
                                onClick={() => setFilter(f)}
                                style={{
                                    padding: '8px 16px', borderRadius: "3px", fontSize: '13px', fontWeight: 600, border: 'none', cursor: 'pointer', transition: 'all 0.2s',
                                    backgroundColor: filter === f ? 'white' : 'transparent',
                                    color: filter === f ? '#263A99' : '#64748b',
                                    boxShadow: filter === f ? '0 2px 8px rgba(0,0,0,0.05)' : 'none'
                                }}
                            >
                                {f === 'all' ? 'Всі' : f === 'published' ? 'Опубліковані' : 'Чернетки'}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {loading ? (
                    <div style={{ textAlign: 'center', padding: '60px' }}><Loader2 size={32} className="animate-spin" color="#cbd5e1" style={{ margin: '0 auto' }} /></div>
                ) : filteredPosts.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '60px', color: '#64748b', backgroundColor: 'white', borderRadius: "3px", border: '1px dashed #cbd5e1' }}>
                        Статей не знайдено.
                    </div>
                ) : (
                    filteredPosts.map((post) => (
                        <div key={post.id} style={postRowStyle}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '20px', flex: 1 }}>
                                {post.cover_image ? (
                                    <div style={{ width: '80px', height: '60px', borderRadius: "3px", overflow: 'hidden', position: 'relative', backgroundColor: '#e2e8f0', flexShrink: 0 }}>
                                        <Image src={post.cover_image} alt={post.title} fill style={{ objectFit: 'cover' }} />
                                    </div>
                                ) : (
                                    <div style={{ width: '80px', height: '60px', borderRadius: "3px", backgroundColor: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', flexShrink: 0 }}>
                                        <FileLock2 size={24} />
                                    </div>
                                )}
                                <div style={{ minWidth: 0 }}>
                                    <Link href={`/admin/blog/${post.id}/edit`} style={{ fontWeight: 800, color: '#263A99', fontSize: '15px', textDecoration: 'none', display: 'block', marginBottom: '4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                        {post.title}
                                    </Link>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '12px', color: '#64748b' }}>
                                        <span style={{ backgroundColor: '#f8fafc', padding: '2px 8px', borderRadius: "3px", border: '1px solid #e2e8f0', fontWeight: 600 }}>
                                            {post.blog_categories?.name || 'Без категорії'}
                                        </span>
                                        <span>👁 {post.views_count} переглядів</span>
                                        <span>Автор: {post.author_name || 'Не вказано'}</span>
                                    </div>
                                </div>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                                <div style={{ width: '100px', textAlign: 'center' }}>
                                    {post.is_published ? (
                                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#10b981', fontSize: '12px', fontWeight: 700, backgroundColor: '#d1fae5', padding: '4px 8px', borderRadius: "3px" }}>
                                            <Globe size={14} /> Опубліковано
                                        </span>
                                    ) : (
                                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#f59e0b', fontSize: '12px', fontWeight: 700, backgroundColor: '#fef3c7', padding: '4px 8px', borderRadius: "3px" }}>
                                            <FileLock2 size={14} /> Чернетка
                                        </span>
                                    )}
                                </div>
                                <div style={{ fontSize: '12px', color: '#94a3b8', width: '90px', textAlign: 'right' }}>
                                    {new Date(post.created_at).toLocaleDateString('uk-UA')}
                                </div>
                                <div style={{ display: 'flex', gap: '6px' }}>
                                    <button onClick={() => togglePublish(post)} title={post.is_published ? 'Зняти з публікації' : 'Опублікувати'} style={actionBtnStyle} >
                                        {post.is_published ? <FileLock2 size={16} color="#f59e0b" /> : <Globe size={16} color="#10b981" />}
                                    </button>
                                    <button onClick={() => duplicatePost(post)} title="Дублювати" style={actionBtnStyle}>
                                        <Copy size={16} color="#64748b" />
                                    </button>
                                    <Link href={`/admin/blog/${post.id}/edit`} title="Редагувати" style={{ ...actionBtnStyle, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <Edit size={16} color="#263A99" />
                                    </Link>
                                    <button onClick={() => deletePost(post.id)} title="Видалити" style={actionBtnStyle}>
                                        <Trash2 size={16} color="#ef4444" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}

const addBtnStyle = { display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 24px', backgroundColor: '#263A99', color: 'white', borderRadius: "3px", border: 'none', fontWeight: 700, fontSize: '15px', cursor: 'pointer', textDecoration: 'none' };
const postRowStyle = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', backgroundColor: 'white', borderRadius: "3px", border: '1px solid #f1f5f9', transition: 'all 0.2s', ':hover': { borderColor: '#e2e8f0', boxShadow: '0 4px 12px rgba(0,0,0,0.03)' } };
const actionBtnStyle = { padding: '8px', borderRadius: "3px", backgroundColor: '#f8fafc', border: '1px solid transparent', cursor: 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center', ':hover': { borderColor: '#e2e8f0', backgroundColor: 'white' } };
