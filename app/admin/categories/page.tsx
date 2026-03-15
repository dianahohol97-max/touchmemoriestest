'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { supabaseAdmin } from '@/lib/supabase/admin';
import {
    Plus,
    Edit,
    Trash2,
    GripVertical,
    Save,
    X,
    Folder,
    Loader2,
    Layout,
    ArrowRight,
    Image as ImageIcon,
    Check
} from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import { toast } from 'sonner';
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragEndEvent
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
    useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface Category {
    id: string;
    name: string;
    slug: string;
    description: string;
    display_style: 'thumbnail' | 'banner';
    is_active: boolean;
    sort_order: number;
    cover_image?: string;
}

function SortableCategoryItem({
    category,
    onEdit,
    onDelete
}: {
    category: Category,
    onEdit: (cat: Category) => void,
    onDelete: (id: string) => void
}) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: category.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
        zIndex: isDragging ? 10 : 1,
    };

    return (
        <div ref={setNodeRef} style={{ ...style, ...catRowStyle }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '20px', flex: 1 }}>
                <button type="button" {...attributes} {...listeners} style={dragHandleStyle}>
                    <GripVertical size={20} />
                </button>
                <div style={iconBoxStyle}>
                    {category.cover_image ? (
                        <img src={category.cover_image} alt={category.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                        <Folder size={20} color="var(--primary)" />
                    )}
                </div>
                <div>
                    <div style={{ fontWeight: 800, color: '#1e293b', fontSize: '16px' }}>{category.name}</div>
                    <div style={{ fontSize: '13px', color: '#94a3b8', fontFamily: 'monospace' }}>/{category.slug}</div>
                </div>
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
                <button onClick={() => onEdit(category)} style={actionBtnStyle}><Edit size={18} /></button>
                <button onClick={() => onDelete(category.id)} style={{ ...actionBtnStyle, color: '#ef4444' }}><Trash2 size={18} /></button>
            </div>
        </div>
    );
}

export default function CategoriesPage() {
    const supabase = createClient();
    const [categories, setCategories] = useState<Category[]>([]);
    const [loading, setLoading] = useState(true);
    const [isEditing, setIsEditing] = useState<string | null>(null);
    const [editForm, setEditForm] = useState<Partial<Category>>({
        name: '',
        slug: '',
        description: '',
        sort_order: 0,
        is_active: true,
        display_style: 'banner'
    });
    const [isAdding, setIsAdding] = useState(false);
    const [uploading, setUploading] = useState(false);

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );

    useEffect(() => {
        fetchCategories();
    }, []);

    async function fetchCategories() {
        setLoading(true);
        const { data } = await supabase
            .from('categories')
            .select('*')
            .order('sort_order', { ascending: true });

        if (data) setCategories(data);
        setLoading(false);
    }

    const onDrop = async (acceptedFiles: File[]) => {
        const file = acceptedFiles[0];
        if (!file) return;

        // Validation
        const isValidType = ['image/jpeg', 'image/png', 'image/webp'].includes(file.type);
        const isValidSize = file.size <= 5 * 1024 * 1024; // 5MB limit

        if (!isValidType) {
            toast.error('Непідтримуваний формат фото (JPG, PNG, WebP)');
            return;
        }
        if (isValidSize === false) {
            toast.error('Фото завелике (>5MB)');
            return;
        }

        setUploading(true);
        const fileExt = file.name.split('.').pop();
        const fileName = `${Math.random().toString(36).substring(2)}.${fileExt}`;
        const filePath = `categories/${fileName}`;

        try {
            const { error: uploadError } = await supabaseAdmin.storage
                .from('touch-memories-assets')
                .upload(filePath, file);

            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage
                .from('touch-memories-assets')
                .getPublicUrl(filePath);

            setEditForm(p => ({ ...p, cover_image: publicUrl }));
            toast.success('Фото завантажено');
        } catch (err: any) {
            toast.error(`Помилка: ${err.message}`);
        } finally {
            setUploading(false);
        }
    };

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: { 'image/*': ['.jpeg', '.jpg', '.png', '.webp'] },
        multiple: false
    });

    const startAdd = () => {
        setEditForm({
            name: '',
            slug: '',
            description: '',
            sort_order: categories.length + 1,
            is_active: true,
            display_style: 'banner'
        });
        setIsAdding(true);
    };

    const startEdit = (cat: Category) => {
        setEditForm({
            ...cat,
            name: cat.name || '',
            slug: cat.slug || '',
            description: cat.description || '',
            cover_image: cat.cover_image || ''
        });
        setIsEditing(cat.id);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            if (isAdding) {
                const { error } = await supabase.from('categories').insert([editForm]);
                if (error) throw error;
                toast.success('Категорію створено');
            } else {
                const { error } = await supabase
                    .from('categories')
                    .update(editForm)
                    .eq('id', isEditing);
                if (error) throw error;
                toast.success('Категорію оновлено');
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

    const handleDragEnd = async (event: DragEndEvent) => {
        const { active, over } = event;
        if (active.id !== over?.id) {
            const oldIndex = categories.findIndex(c => c.id === active.id);
            const newIndex = categories.findIndex(c => c.id === over?.id);
            const newCategories = arrayMove(categories, oldIndex, newIndex);
            setCategories(newCategories);

            // Update order in DB
            const updates = newCategories.map((cat, idx) => ({
                id: cat.id,
                sort_order: idx + 1
            }));

            try {
                await Promise.all(updates.map(u =>
                    supabase.from('categories').update({ sort_order: u.sort_order }).eq('id', u.id)
                ));
                toast.success('Порядок збережено');
            } catch (err) {
                toast.error('Помилка при збереженні порядку');
                fetchCategories();
            }
        }
    };

    const deleteCategory = async (id: string) => {
        if (!confirm('Ви впевнені?')) return;
        const { error } = await supabase.from('categories').delete().eq('id', id);
        if (!error) {
            setCategories(categories.filter(c => c.id !== id));
            toast.success('Видалено');
        }
    };

    return (
        <div style={{ maxWidth: '1000px', margin: '0 auto', color: '#0f172a' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px' }}>
                <div>
                    <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '32px', fontWeight: 900, marginBottom: '8px' }}>Категорії</h1>
                    <p style={{ color: '#64748b', fontSize: '15px' }}>Структуруйте товари та керуйте навігацією магазину.</p>
                </div>
                <button onClick={startAdd} style={addBtnStyle}>
                    <Plus size={20} /> Нова категорія
                </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {(isAdding || isEditing) && (
                    <form onSubmit={handleSave} style={formCardStyle}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
                            <h2 style={{ fontSize: '18px', fontWeight: 800 }}>{isAdding ? 'Створення категорії' : 'Редагування'}</h2>
                            <button type="button" onClick={() => { setIsAdding(false); setIsEditing(null); }} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}><X size={24} /></button>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '24px' }}>
                            <div>
                                <label style={labelStyle}>Назва категорії *</label>
                                <input
                                    type="text"
                                    value={editForm.name || ''}
                                    onChange={(e) => {
                                        const name = e.target.value;
                                        const slug = name.toLowerCase().replace(/ /g, '-').replace(/[^\w-]+/g, '');
                                        setEditForm(p => ({ ...p, name, slug: isEditing ? editForm.slug : slug }));
                                    }}
                                    style={inputStyle}
                                    placeholder="Напр. Весільні фотокниги"
                                    required
                                />
                            </div>
                            <div>
                                <label style={labelStyle}>Slug (URL-ідентифікатор) *</label>
                                <input
                                    type="text"
                                    value={editForm.slug || ''}
                                    onChange={(e) => setEditForm(p => ({ ...p, slug: e.target.value }))}
                                    style={inputStyle}
                                    required
                                />
                            </div>
                        </div>

                        <div style={{ marginBottom: '24px' }}>
                            <label style={labelStyle}>Опис</label>
                            <textarea
                                value={editForm.description || ''}
                                onChange={(e) => setEditForm(p => ({ ...p, description: e.target.value }))}
                                style={textareaStyle}
                                rows={3}
                                placeholder="Коротко про товари в цій категорії..."
                            />
                        </div>

                        <div style={{ marginBottom: '24px' }}>
                            <label style={labelStyle}>Фото категорії (optional)</label>
                            <div {...getRootProps()} style={{
                                ...dropzoneStyle,
                                borderColor: isDragActive ? 'var(--accent)' : '#e2e8f0',
                                backgroundColor: isDragActive ? '#f0f7ff' : '#f8fafc'
                            }}>
                                <input {...getInputProps()} />
                                {editForm.cover_image ? (
                                    <div style={{ position: 'relative', width: '120px', height: '90px' }}>
                                        <img
                                            src={editForm.cover_image}
                                            alt="Preview"
                                            style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '8px' }}
                                        />
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setEditForm(p => ({ ...p, cover_image: '' }));
                                            }}
                                            style={deleteImgBtnStyle}
                                        >
                                            <X size={14} />
                                        </button>
                                    </div>
                                ) : (
                                    <div style={{ textAlign: 'center', color: '#94a3b8' }}>
                                        {uploading ? (
                                            <Loader2 size={24} className="animate-spin" />
                                        ) : (
                                            <>
                                                <ImageIcon size={24} style={{ marginBottom: '8px' }} />
                                                <p style={{ fontSize: '12px' }}>Перетягніть фото або клікніть</p>
                                            </>
                                        )}
                                    </div>
                                )}
                            </div>
                            <p style={{ fontSize: '12px', color: '#94a3b8', marginTop: '8px' }}>
                                Рекомендований розмір: 800×600 px. Макс. 5MB.
                            </p>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '32px' }}>
                            <div>
                                <label style={labelStyle}>Відображення в каталозі</label>
                                <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                                    <button
                                        type="button"
                                        onClick={() => setEditForm(p => ({ ...p, display_style: 'thumbnail' }))}
                                        style={{
                                            ...radioBtnStyle,
                                            borderColor: editForm.display_style === 'thumbnail' ? 'var(--accent)' : '#e2e8f0',
                                            backgroundColor: editForm.display_style === 'thumbnail' ? '#f0f7ff' : 'white',
                                            color: editForm.display_style === 'thumbnail' ? 'var(--accent)' : '#64748b'
                                        }}
                                    >
                                        {editForm.display_style === 'thumbnail' && <Check size={14} />}
                                        Мініатюра
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setEditForm(p => ({ ...p, display_style: 'banner' }))}
                                        style={{
                                            ...radioBtnStyle,
                                            borderColor: editForm.display_style === 'banner' ? 'var(--accent)' : '#e2e8f0',
                                            backgroundColor: editForm.display_style === 'banner' ? '#f0f7ff' : 'white',
                                            color: editForm.display_style === 'banner' ? 'var(--accent)' : '#64748b'
                                        }}
                                    >
                                        {editForm.display_style === 'banner' && <Check size={14} />}
                                        Банер
                                    </button>
                                </div>
                            </div>
                            <div>
                                <label style={labelStyle}>Статус</label>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '12px', cursor: 'pointer' }}>
                                    <input
                                        type="checkbox"
                                        checked={editForm.is_active}
                                        onChange={(e) => setEditForm(p => ({ ...p, is_active: e.target.checked }))}
                                        style={{ width: '20px', height: '20px', cursor: 'pointer' }}
                                    />
                                    <span style={{ fontSize: '14px', fontWeight: 600 }}>Показувати в каталозі</span>
                                </label>
                            </div>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                            <button type="submit" disabled={loading || uploading} style={saveBtnStyle}>
                                {loading ? <Loader2 size={18} className="animate-spin" /> : isAdding ? <Plus size={18} /> : <Save size={18} />}
                                {isAdding ? 'Створити категорію' : 'Зберегти зміни'}
                            </button>
                        </div>
                    </form>
                )}

                {loading && !isAdding && !isEditing ? (
                    <div style={{ textAlign: 'center', padding: '100px', backgroundColor: 'white', borderRadius: '32px' }}>
                        <Loader2 size={40} className="animate-spin" style={{ color: '#cbd5e1', marginBottom: '16px' }} />
                        <p style={{ fontWeight: 600, color: '#94a3b8' }}>Завантаження категорій...</p>
                    </div>
                ) : categories.length === 0 ? (
                    <div style={emptyStateStyle}>
                        <Layout size={48} color="#cbd5e1" style={{ marginBottom: '16px' }} />
                        <h3 style={{ fontWeight: 800, marginBottom: '8px' }}>Немає категорій</h3>
                        <p style={{ color: '#64748b', marginBottom: '24px' }}>Додайте першу категорію, щоб почати наповнювати каталог.</p>
                        <button onClick={startAdd} style={addBtnStyle}>Створити категорію</button>
                    </div>
                ) : (
                    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                        <SortableContext items={categories.map(c => c.id)} strategy={verticalListSortingStrategy}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                {categories.map((cat) => (
                                    <SortableCategoryItem
                                        key={cat.id}
                                        category={cat}
                                        onEdit={startEdit}
                                        onDelete={deleteCategory}
                                    />
                                ))}
                            </div>
                        </SortableContext>
                    </DndContext>
                )}
            </div>
        </div>
    );
}

const addBtnStyle = { display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 24px', backgroundColor: '#1e293b', color: 'white', borderRadius: '12px', border: 'none', fontWeight: 800, fontSize: '15px', cursor: 'pointer', transition: 'transform 0.2s' };
const catRowStyle = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', backgroundColor: 'white', borderRadius: '20px', border: '1px solid #f1f5f9', boxShadow: '0 4px 15px rgba(0,0,0,0.01)', transition: 'all 0.2s' };
const iconBoxStyle = { width: '48px', height: '48px', borderRadius: '14px', backgroundColor: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' };
const dragHandleStyle = { padding: '8px', color: '#cbd5e1', cursor: 'grab', background: 'none', border: 'none', display: 'flex', alignItems: 'center' };
const actionBtnStyle = { padding: '10px', borderRadius: '12px', backgroundColor: '#f8fafc', color: '#64748b', border: 'none', cursor: 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center' };
const formCardStyle = { backgroundColor: 'white', padding: '40px', borderRadius: '32px', border: '1px solid #f1f5f9', boxShadow: '0 10px 40px rgba(0,0,0,0.05)', marginBottom: '32px' };
const labelStyle = { display: 'block', fontSize: '12px', fontWeight: 800, color: '#64748b', marginBottom: '8px', textTransform: 'uppercase' as any, letterSpacing: '0.05em' };
const inputStyle = { width: '100%', padding: '14px 16px', borderRadius: '14px', border: '1.5px solid #e2e8f0', outline: 'none', fontSize: '14px', backgroundColor: '#f8fafc', transition: 'border-color 0.2s' };
const textareaStyle = { width: '100%', padding: '14px 16px', borderRadius: '14px', border: '1.5px solid #e2e8f0', outline: 'none', fontSize: '14px', backgroundColor: '#f8fafc', fontFamily: 'inherit' };
const saveBtnStyle = { display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 24px', backgroundColor: '#10b981', color: 'white', borderRadius: '12px', border: 'none', fontWeight: 700, cursor: 'pointer', fontSize: '15px' };
const emptyStateStyle = { textAlign: 'center' as any, padding: '80px 40px', backgroundColor: 'white', borderRadius: '32px', border: '2px dashed #e2e8f0', display: 'flex', flexDirection: 'column' as any, alignItems: 'center' };
const dropzoneStyle = { border: '2px dashed #e2e8f0', borderRadius: '16px', padding: '16px', cursor: 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center' };
const radioBtnStyle = { display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 20px', borderRadius: '12px', border: '1.5px solid #e2e8f0', cursor: 'pointer', fontSize: '14px', fontWeight: 700, transition: 'all 0.2s' };
const deleteImgBtnStyle = { position: 'absolute' as any, top: '-8px', right: '-8px', width: '24px', height: '24px', borderRadius: '50%', backgroundColor: '#ef4444', color: 'white', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' };
