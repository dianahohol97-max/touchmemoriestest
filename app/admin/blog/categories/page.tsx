'use client';
import { useState, useEffect } from 'react';
import { createBrowserClient } from '@supabase/auth-helpers-nextjs';
import {
    Plus,
    Edit,
    Trash2,
    GripVertical,
    Save,
    Folder,
    Loader2
} from 'lucide-react';
import { toast } from 'sonner';

export default function BlogCategoriesPage() {
    const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    const [categories, setCategories] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [isEditing, setIsEditing] = useState<string | null>(null);
    const [editForm, setEditForm] = useState({ name: '', slug: '', description: '', sort_order: 0, is_active: true });
    const [isAdding, setIsAdding] = useState(false);

    useEffect(() => {
        fetchCategories();
    }, []);

    async function fetchCategories() {
        setLoading(true);
        const { data } = await supabase
            .from('blog_categories')
            .select('*')
            .order('sort_order', { ascending: true });

        if (data) setCategories(data);
        setLoading(false);
    }

    const startAdd = () => {
        setEditForm({ name: '', slug: '', description: '', sort_order: categories.length + 1, is_active: true });
        setIsAdding(true);
    };

    const startEdit = (cat: any) => {
        setEditForm({ ...cat });
        setIsEditing(cat.id);
    };

    const cancelEdit = () => {
        setIsEditing(null);
        setIsAdding(false);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            if (isAdding) {
                const { error } = await supabase.from('blog_categories').insert([editForm]);
                if (error) throw error;
                toast.success('Категорію блогу створено');
            } else {
                const { error } = await supabase
                    .from('blog_categories')
                    .update({
                        name: editForm.name,
                        slug: editForm.slug,
                        description: editForm.description,
                        sort_order: editForm.sort_order,
                        is_active: editForm.is_active
                    })
                    .eq('id', isEditing);
                if (error) throw error;
                toast.success('Категорію блогу оновлено');
            }
            fetchCategories();
            setIsAdding(false);
            setIsEditing(null);
        } catch (error: any) {
            toast.error(error.message);
        } finally {
            setLoading(false);
        }
    };

    const deleteCategory = async (id: string) => {
        if (!confirm('Ви впевнені? Це також вплине на статті в цій категорії.')) return;

        const { error } = await supabase.from('blog_categories').delete().eq('id', id);
        if (!error) {
            setCategories(categories.filter(c => c.id !== id));
            toast.success('Видалено');
        } else {
            toast.error(error.message);
        }
    };

    return (
        <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px' }}>
                <div>
                    <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '28px', fontWeight: 900, color: '#1e293b', marginBottom: '8px' }}>Категорії блогу</h1>
                    <p style={{ color: '#64748b' }}>Керуйте темами та розділами для блогу.</p>
                </div>
                <button onClick={startAdd} style={addBtnStyle}>
                    <Plus size={20} />
                    Нова категорія
                </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {loading && !isAdding && !isEditing ? (
                    <div style={{ textAlign: 'center', padding: '100px' }}>Завантаження...</div>
                ) : (
                    <>
                        {(isAdding || isEditing) && (
                            <form onSubmit={handleSave} style={formCardStyle}>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
                                    <div>
                                        <label style={labelStyle}>Назва</label>
                                        <input
                                            type="text"
                                            value={editForm.name}
                                            onChange={(e) => {
                                                const name = e.target.value;
                                                const slug = name.toLowerCase().replace(/ /g, '-').replace(/[^\w-]+/g, '');
                                                setEditForm(p => ({ ...p, name, slug: isAdding || !p.slug ? slug : p.slug }));
                                            }}
                                            style={inputStyle}
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label style={labelStyle}>Slug (URL)</label>
                                        <input
                                            type="text"
                                            value={editForm.slug}
                                            onChange={(e) => setEditForm(p => ({ ...p, slug: e.target.value }))}
                                            style={inputStyle}
                                            required
                                        />
                                    </div>
                                </div>
                                <div style={{ marginBottom: '20px' }}>
                                    <label style={labelStyle}>Опис</label>
                                    <textarea
                                        value={editForm.description || ''}
                                        onChange={(e) => setEditForm(p => ({ ...p, description: e.target.value }))}
                                        style={textareaStyle}
                                        rows={2}
                                    />
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
                                    <input
                                        type="checkbox"
                                        id="isActive"
                                        checked={editForm.is_active}
                                        onChange={(e) => setEditForm(p => ({ ...p, is_active: e.target.checked }))}
                                        style={{ width: '18px', height: '18px' }}
                                    />
                                    <label htmlFor="isActive" style={{ fontWeight: 600, color: '#475569', cursor: 'pointer' }}>Активна</label>
                                </div>

                                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                                    <button type="button" onClick={cancelEdit} style={cancelBtnStyle}>Скасувати</button>
                                    <button type="submit" disabled={loading} style={saveBtnStyle}>
                                        {loading ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                                        Зберегти
                                    </button>
                                </div>
                            </form>
                        )}

                        {categories.map((cat) => (
                            <div key={cat.id} style={{ ...catRowStyle, opacity: cat.is_active ? 1 : 0.6 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flex: 1 }}>
                                    <GripVertical size={20} color="#cbd5e1" style={{ cursor: 'move' }} />
                                    <div style={iconBoxStyle}><Folder size={20} color="var(--primary)" /></div>
                                    <div>
                                        <div style={{ fontWeight: 800, color: '#1e293b', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            {cat.name}
                                            {!cat.is_active && <span style={{ fontSize: '11px', padding: '2px 6px', backgroundColor: '#e2e8f0', borderRadius: '4px', color: '#64748b' }}>Неактивна</span>}
                                        </div>
                                        <div style={{ fontSize: '13px', color: '#94a3b8' }}>/blog/category/{cat.slug}</div>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                    <button onClick={() => startEdit(cat)} style={actionBtnStyle}><Edit size={18} /></button>
                                    <button onClick={() => deleteCategory(cat.id)} style={{ ...actionBtnStyle, color: '#dc2626' }}><Trash2 size={18} /></button>
                                </div>
                            </div>
                        ))}
                    </>
                )}
            </div>
        </div>
    );
}

const addBtnStyle = { display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 24px', backgroundColor: '#1e293b', color: 'white', borderRadius: '12px', border: 'none', fontWeight: 700, fontSize: '15px', cursor: 'pointer' };
const catRowStyle = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px', backgroundColor: 'white', borderRadius: '24px', border: '1px solid #f1f5f9', boxShadow: '0 4px 15px rgba(0,0,0,0.01)' };
const iconBoxStyle = { width: '44px', height: '44px', borderRadius: '12px', backgroundColor: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center' };
const actionBtnStyle = { padding: '10px', borderRadius: '12px', backgroundColor: '#f8fafc', color: '#64748b', border: 'none', cursor: 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center' };
const formCardStyle = { backgroundColor: '#f8fafc', padding: '32px', borderRadius: '24px', border: '2px dashed #e2e8f0', marginBottom: '16px' };
const labelStyle = { display: 'block', fontSize: '12px', fontWeight: 800, color: '#64748b', marginBottom: '8px', textTransform: 'uppercase' as any, letterSpacing: '0.05em' };
const inputStyle = { width: '100%', padding: '12px 16px', borderRadius: '12px', border: '1.5px solid #e2e8f0', outline: 'none', fontSize: '14px', backgroundColor: 'white' };
const textareaStyle = { width: '100%', padding: '12px 16px', borderRadius: '12px', border: '1.5px solid #e2e8f0', outline: 'none', fontSize: '14px', backgroundColor: 'white', fontFamily: 'inherit' };
const saveBtnStyle = { display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', backgroundColor: '#10b981', color: 'white', borderRadius: '10px', border: 'none', fontWeight: 700, cursor: 'pointer', fontSize: '14px' };
const cancelBtnStyle = { padding: '10px 20px', backgroundColor: 'transparent', color: '#64748b', borderRadius: '10px', border: '1.5px solid #e2e8f0', fontWeight: 700, cursor: 'pointer', fontSize: '14px' };
