'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import MDEditor from '@uiw/react-md-editor';
import { Loader2, Save, Sparkles, Image as ImageIcon, Eye, ArrowLeft, Trash2, X, Plus, GripVertical, AlignLeft, AlignCenter, AlignRight, FileText, Search } from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import { toast } from 'sonner';
import Link from 'next/link';

interface BlogPostEditorProps {
    initialData?: any;
    isEditMode?: boolean;
}

export default function BlogPostEditor({ initialData, isEditMode = false }: BlogPostEditorProps) {
    const router = useRouter();
    const supabase = createClient();

    const [categories, setCategories] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [aiLoading, setAiLoading] = useState<string | null>(null);
    const [uploading, setUploading] = useState<string | null>(null);
    const [articleMedia, setArticleMedia] = useState<string[]>(initialData?.content_images || []);

    const [form, setForm] = useState({
        title: initialData?.title || '',
        slug: initialData?.slug || '',
        category_id: initialData?.category_id || '',
        excerpt: initialData?.excerpt || '',
        content: initialData?.content || '',
        meta_title: initialData?.meta_title || '',
        meta_description: initialData?.meta_description || '',
        keywords: initialData?.keywords || [],
        og_title: initialData?.og_title || '',
        tags: initialData?.tags || [],
        is_published: initialData?.is_published || false,
        is_featured: initialData?.is_featured || false,
        cover_image: initialData?.cover_image || '',
        author_name: initialData?.author_name || 'Команда магазину',
        published_at: initialData?.published_at || new Date().toISOString()
    });

    const [tagInput, setTagInput] = useState('');
    const [keywordInput, setKeywordInput] = useState('');

    useEffect(() => {
        supabase.from('blog_categories').select('id, name').order('sort_order').then(({ data }) => {
            if (data) setCategories(data);
        });
    }, [supabase]);

    const handleAIGenerate = async (action: string) => {
        if (!form.title) {
            toast.warning('Спочатку введіть заголовок статті');
            return;
        }

        setAiLoading(action);
        try {
            const res = await fetch('/api/admin/ai/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action,
                    payload: {
                        title: form.title,
                        content: form.content,
                        text: form.content.substring(0, 1000),
                        excerpt: form.excerpt
                    }
                })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to generate');

            if (action === 'generate_structure') {
                setForm(p => ({ ...p, content: p.content ? p.content + '\n\n' + data.result : data.result }));
                toast.success('Структуру згенеровано');
            } else if (action === 'generate_meta') {
                setForm(p => ({
                    ...p,
                    meta_title: data.meta_title || p.meta_title,
                    meta_description: data.meta_description || p.meta_description,
                    keywords: data.keywords || p.keywords,
                    og_title: data.meta_title || p.og_title
                }));
                toast.success('SEO-дані заповнено автоматично ✓');
            } else if (action === 'generate_expert') {
                setForm(p => ({ ...p, content: data.result + '\n\n' + p.content }));
                toast.success('Вступний абзац додано');
            } else if (action === 'generate_excerpt') {
                setForm(p => ({ ...p, excerpt: data.result }));
                toast.success('Короткий опис згенеровано');
            } else if (action === 'suggest_tags') {
                if (data.tags) {
                    setForm(p => ({ ...p, tags: [...new Set([...p.tags, ...data.tags])] }));
                    toast.success('Теги додано');
                }
            }
        } catch (error: any) {
            toast.error("Помилка генерації. Спробуйте ще раз.");
            console.error(error);
        } finally {
            setAiLoading(null);
        }
    };

    const handleFileUpload = async (files: File[], type: 'cover' | 'article') => {
        if (type === 'article' && articleMedia.length + files.length > 10) {
            toast.error('Можна завантажити до 10 зображень для статті');
            return;
        }

        const uploadedUrls: string[] = [];
        setUploading(type);

        for (const file of files) {
            // Validation
            const isValidType = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'].includes(file.type);
            const isValidSize = file.size <= 10 * 1024 * 1024; // 10MB

            if (!isValidType) {
                toast.error(`Непідтримуваний формат: ${file.name}`);
                continue;
            }
            if (!isValidSize) {
                toast.error(`Файл занадто великий: ${file.name} (max 10MB)`);
                continue;
            }

            const fileExt = file.name.split('.').pop();
            const fileName = `${Math.random().toString(36).substring(2)}.${fileExt}`;
            const filePath = `blog/${type === 'cover' ? 'covers' : 'content'}/${fileName}`;

            try {
                const { error: uploadError } = await supabase.storage
                    .from('touch-memories-assets')
                    .upload(filePath, file);

                if (uploadError) throw uploadError;

                const { data: { publicUrl } } = supabase.storage
                    .from('touch-memories-assets')
                    .getPublicUrl(filePath);

                uploadedUrls.push(publicUrl);
            } catch (err: any) {
                toast.error(`Помилка завантаження ${file.name}: ${err.message}`);
            }
        }

        if (type === 'cover' && uploadedUrls.length > 0) {
            setForm(p => ({ ...p, cover_image: uploadedUrls[0] }));
            toast.success('Обкладинку оновлено ✓');
        } else if (type === 'article' && uploadedUrls.length > 0) {
            setArticleMedia(p => [...p, ...uploadedUrls]);
            toast.success(`Завантажено ${uploadedUrls.length} зображень ✓`);
        }

        setUploading(null);
    };

    const deleteMedia = (url: string, type: 'cover' | 'article') => {
        if (type === 'cover') {
            setForm(p => ({ ...p, cover_image: '' }));
        } else {
            setArticleMedia(p => p.filter(u => u !== url));
        }
    };

    const insertImageIntoContent = (url: string, align: 'left' | 'center' | 'right' = 'center', size: 'small' | 'medium' | 'full' = 'full') => {
        let sizePx = '100%';
        if (size === 'small') sizePx = '300px';
        if (size === 'medium') sizePx = '600px';

        const imgMarkdown = `\n<p align="${align}"><img src="${url}" width="${sizePx}" alt="Blog Image" /></p>\n`;
        setForm(p => ({ ...p, content: p.content + imgMarkdown }));
        toast.success('Зображення додано в текст');
    };

    const { getRootProps: getCoverProps, getInputProps: getCoverInputProps } = useDropzone({
        onDrop: (files) => handleFileUpload(files, 'cover'),
        accept: { 'image/*': ['.jpeg', '.jpg', '.png', '.webp'] },
        multiple: false
    });

    const { getRootProps: getArticleProps, getInputProps: getArticleInputProps } = useDropzone({
        onDrop: (files) => handleFileUpload(files, 'article'),
        accept: { 'image/*': ['.jpeg', '.jpg', '.png', '.webp'] },
        multiple: true
    });

    const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const title = e.target.value;
        if (!isEditMode) {
            const slug = title.toLowerCase().replace(/ /g, '-').replace(/[^\w-]+/g, '');
            setForm(p => ({ ...p, title, slug }));
        } else {
            setForm(p => ({ ...p, title }));
        }
    };

    const handleAddKeyword = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && keywordInput.trim()) {
            e.preventDefault();
            if (!form.keywords.includes(keywordInput.trim())) {
                setForm(p => ({ ...p, keywords: [...p.keywords, keywordInput.trim()] }));
            }
            setKeywordInput('');
        }
    };

    const savePost = async () => {
        if (!form.title || !form.slug || !form.category_id) {
            toast.error('Заповніть обов\'язкові поля: Заголовок, Slug, Категорія');
            return;
        }

        setLoading(true);
        try {
            const reading_time = Math.max(1, Math.ceil((form.content.split(' ').length) / 200));
            const postData = { ...form, reading_time, content_images: articleMedia };

            if (isEditMode) {
                const { error } = await supabase.from('blog_posts').update(postData).eq('id', initialData.id);
                if (error) throw error;
                toast.success('Зміни збережено');
            } else {
                const { data, error } = await supabase.from('blog_posts').insert([postData]).select().single();
                if (error) throw error;
                toast.success('Статтю створено');
                router.push(`/admin/blog/${data.id}/edit`);
            }
        } catch (error: any) {
            toast.error(error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <Link href="/admin/blog" style={{ color: '#64748b', display: 'flex', alignItems: 'center' }}>
                        <ArrowLeft size={20} />
                    </Link>
                    <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '24px', fontWeight: 900, color: '#263A99' }}>
                        {isEditMode ? 'Редагувати статтю' : 'Нова стаття'}
                    </h1>
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                    {isEditMode && form.is_published && (
                        <Link href={`/blog/${form.slug}`} target="_blank" style={{ ...btnStyle, backgroundColor: '#f1f5f9', color: '#263A99' }}>
                            <Eye size={18} /> Переглянути
                        </Link>
                    )}
                    <button onClick={savePost} disabled={loading} style={{ ...btnStyle, backgroundColor: '#263A99', color: 'white' }}>
                        {loading ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                        Зберегти {isEditMode ? 'зміни' : 'статтю'}
                    </button>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 360px', gap: '32px', alignItems: 'start' }}>

                {/* ЛІВА КОЛОНКА */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                    <div style={cardStyle}>
                        <input
                            type="text"
                            placeholder="Заголовок статті..."
                            value={form.title}
                            onChange={handleTitleChange}
                            style={{ width: '100%', fontSize: '28px', fontWeight: 800, border: 'none', outline: 'none', fontFamily: 'var(--font-heading)', color: '#263A99', backgroundColor: 'transparent' }}
                        />
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #f1f5f9' }}>
                            <div style={{ flex: 1 }}>
                                <label style={labelStyle}>Slug (URL)</label>
                                <input
                                    type="text"
                                    value={form.slug}
                                    onChange={(e) => setForm(p => ({ ...p, slug: e.target.value }))}
                                    style={inputStyle}
                                />
                            </div>
                            <div style={{ flex: 1 }}>
                                <label style={labelStyle}>Категорія *</label>
                                <select
                                    value={form.category_id}
                                    onChange={(e) => setForm(p => ({ ...p, category_id: e.target.value }))}
                                    style={inputStyle}
                                >
                                    <option value="">Оберіть категорію</option>
                                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                            </div>
                        </div>
                    </div>

                    <div style={cardStyle}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <button
                                    onClick={() => handleAIGenerate('generate_structure')}
                                    disabled={!!aiLoading}
                                    style={aiBtnStyle}
                                >
                                    {aiLoading === 'generate_structure' ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                                    AI-структура
                                </button>
                                <button
                                    onClick={() => handleAIGenerate('generate_expert')}
                                    disabled={!!aiLoading}
                                    style={aiBtnStyle}
                                >
                                    {aiLoading === 'generate_expert' ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                                    AI-експерт
                                </button>
                            </div>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <div {...getArticleInputProps()} />
                                <button {...getArticleProps()} disabled={!!uploading} style={{ ...aiBtnStyle, color: '#263A99', backgroundColor: '#f1f5f9' }}>
                                    {uploading === 'article' ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                                    Додати зображення
                                </button>
                            </div>
                        </div>

                        {articleMedia.length > 0 && (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: '12px', marginBottom: '20px', padding: '16px', backgroundColor: '#f8fafc', borderRadius: '16px', border: '1.5px dashed #e2e8f0' }}>
                                {articleMedia.map((url, i) => (
                                    <div key={i} style={{ position: 'relative', aspectRatio: '1/1', borderRadius: '8px', overflow: 'hidden', cursor: 'pointer', border: '2px solid transparent', transition: '0.2s' }} className="group">
                                        <img src={url} alt={`Media ${i}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                        <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: '4px', opacity: 0, transition: '0.2s' }} onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')} onMouseLeave={(e) => (e.currentTarget.style.opacity = '0')}>
                                            <div style={{ display: 'flex', gap: '4px' }}>
                                                <button onClick={() => insertImageIntoContent(url, 'left', 'small')} title="Ліворуч" style={miniActionStyle}><AlignLeft size={12} /></button>
                                                <button onClick={() => insertImageIntoContent(url, 'center', 'medium')} title="Центр" style={miniActionStyle}><AlignCenter size={12} /></button>
                                                <button onClick={() => insertImageIntoContent(url, 'right', 'full')} title="На всю ширину" style={miniActionStyle}><AlignRight size={12} /></button>
                                            </div>
                                            <button onClick={() => deleteMedia(url, 'article')} style={{ ...miniActionStyle, color: '#ef4444' }}><Trash2 size={12} /></button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        <div data-color-mode="light">
                            <MDEditor
                                value={form.content}
                                onChange={(val) => setForm(p => ({ ...p, content: val || '' }))}
                                height={600}
                                preview="edit"
                            />
                        </div>
                    </div>
                </div>

                {/* ПРАВА КОЛОНКА */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                    <div style={cardStyle}>
                        <h3 style={sectionTitleStyle}>Публікація</h3>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px', backgroundColor: '#f8fafc', borderRadius: '12px', marginBottom: '16px' }}>
                            <span style={{ fontWeight: 600, fontSize: '14px', color: '#263A99' }}>Статус</span>
                            <select
                                value={form.is_published ? 'published' : 'draft'}
                                onChange={(e) => setForm(p => ({ ...p, is_published: e.target.value === 'published' }))}
                                style={{ padding: '6px 12px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '13px', fontWeight: 600, outline: 'none', backgroundColor: 'white' }}
                            >
                                <option value="draft">Чернетка</option>
                                <option value="published">Опубліковано</option>
                            </select>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                            <input
                                type="checkbox"
                                id="is_featured"
                                checked={form.is_featured}
                                onChange={(e) => setForm(p => ({ ...p, is_featured: e.target.checked }))}
                                style={{ width: '18px', height: '18px', accentColor: '#263A99' }}
                            />
                            <label htmlFor="is_featured" style={{ fontSize: '14px', fontWeight: 600, color: '#263A99', cursor: 'pointer' }}>Показати на головній</label>
                        </div>
                        <label style={labelStyle}>Дата публікації</label>
                        <input
                            type="datetime-local"
                            value={new Date(form.published_at).toISOString().slice(0, 16)}
                            onChange={(e) => setForm(p => ({ ...p, published_at: new Date(e.target.value).toISOString() }))}
                            style={{ ...inputStyle, marginBottom: '0' }}
                        />
                    </div>

                    <div style={cardStyle}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                            <h3 style={sectionTitleStyle}>Обкладинка</h3>
                            {form.cover_image && (
                                <button onClick={() => deleteMedia(form.cover_image, 'cover')} style={{ color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer' }}><Trash2 size={16} /></button>
                            )}
                        </div>

                        <div {...getCoverProps()} style={{ position: 'relative', width: '100%', borderRadius: '16px', overflow: 'hidden', backgroundColor: '#f8fafc', border: '2.5px dashed #e2e8f0', cursor: 'pointer', transition: '0.2s', minHeight: '180px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', padding: '12px' }}>
                            <input {...getCoverInputProps()} />
                            {uploading === 'cover' ? (
                                <Loader2 size={32} className="animate-spin text-slate-400" />
                            ) : form.cover_image ? (
                                <img src={form.cover_image} alt="Post Cover" style={{ width: '100%', height: '100%', position: 'absolute', inset: 0, objectFit: 'cover' }} />
                            ) : (
                                <>
                                    <ImageIcon size={32} color="#94a3b8" />
                                    <p style={{ fontSize: '13px', fontWeight: 600, color: '#64748b', marginTop: '8px', textAlign: 'center' }}>Натисніть або перетягніть</p>
                                </>
                            )}
                        </div>
                        <p style={{ fontSize: '11px', color: '#94a3b8', marginTop: '10px', textAlign: 'center' }}>Рекомендований розмір: 1200×630 px</p>
                    </div>

                    <div style={cardStyle}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                            <h3 style={sectionTitleStyle}>SEO & Мета</h3>
                            <button onClick={() => handleAIGenerate('generate_meta')} disabled={!!aiLoading} style={aiBtnStyle}>
                                {aiLoading === 'generate_meta' ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                                AI SEO
                            </button>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <div>
                                <label style={labelStyle}>Meta Title</label>
                                <input type="text" value={form.meta_title} onChange={(e) => setForm(p => ({ ...p, meta_title: e.target.value }))} style={inputStyle} />
                                <div style={{ textAlign: 'right', fontSize: '11px', color: form.meta_title.length > 60 ? '#ef4444' : '#10b981', marginTop: '4px' }}>{form.meta_title.length} / 60</div>
                            </div>
                            <div>
                                <label style={labelStyle}>Meta Description</label>
                                <textarea value={form.meta_description} onChange={(e) => setForm(p => ({ ...p, meta_description: e.target.value }))} style={{ ...inputStyle, minHeight: '80px' }} />
                                <div style={{ textAlign: 'right', fontSize: '11px', color: form.meta_description.length > 160 ? '#ef4444' : '#10b981', marginTop: '4px' }}>{form.meta_description.length} / 160</div>
                            </div>
                            <div>
                                <label style={labelStyle}>Ключові слова</label>
                                <input
                                    type="text"
                                    placeholder="Натисніть Enter..."
                                    value={keywordInput}
                                    onChange={(e) => setKeywordInput(e.target.value)}
                                    onKeyDown={handleAddKeyword}
                                    style={inputStyle}
                                />
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '8px' }}>
                                    {form.keywords.map((kw: string) => (
                                        <span key={kw} style={tagPillStyle}>
                                            {kw}
                                            <button onClick={() => setForm(p => ({ ...p, keywords: p.keywords.filter((k: string) => k !== kw) }))} style={tagDeleteBtnStyle}><X size={10} /></button>
                                        </span>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

const cardStyle = { backgroundColor: 'white', padding: '24px', borderRadius: '32px', border: '1.5px solid #f1f5f9', boxShadow: '0 4px 15px rgba(0,0,0,0.01)' };
const btnStyle = { display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 24px', borderRadius: '16px', border: 'none', fontWeight: 800, fontSize: '14px', cursor: 'pointer', transition: 'all 0.2s', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' };
const aiBtnStyle = { display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 800, color: '#8b5cf6', backgroundColor: '#f5f3ff', border: 'none', padding: '8px 14px', borderRadius: '12px', cursor: 'pointer', transition: '0.2s' };
const labelStyle = { display: 'block', fontSize: '11px', fontWeight: 900, color: '#64748b', marginBottom: '8px', textTransform: 'uppercase' as any, letterSpacing: '0.08em' };
const inputStyle = { width: '100%', padding: '12px 16px', borderRadius: '14px', border: '1.5px solid #e2e8f0', outline: 'none', fontSize: '14px', backgroundColor: '#f8fafc', color: '#263A99', transition: 'all 0.2s', fontFamily: 'Inter, sans-serif' };
const sectionTitleStyle = { fontSize: '13px', fontWeight: 900, textTransform: 'uppercase' as any, color: '#263A99', marginBottom: '20px', letterSpacing: '0.1em' };
const miniActionStyle = { border: 'none', backgroundColor: 'rgba(255,255,255,0.95)', padding: '6px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#263A99', transition: '0.2s' };
const tagPillStyle = { display: 'inline-flex', alignItems: 'center', gap: '6px', backgroundColor: '#f1f5f9', color: '#475569', padding: '4px 10px', borderRadius: '10px', fontSize: '12px', fontWeight: 700 };
const tagDeleteBtnStyle = { border: 'none', background: 'transparent', color: '#94a3b8', cursor: 'pointer', padding: 0, display: 'flex' };
