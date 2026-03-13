'use client';
import { useState, useEffect } from 'react';
import { createBrowserClient } from '@supabase/auth-helpers-nextjs';
import { X, Upload, Loader2, Image as ImageIcon } from 'lucide-react';
import toast from 'react-hot-toast';

interface CategoryFormModalProps {
    category: any | null;
    onClose: () => void;
    onSave: () => void;
}

export function CategoryFormModal({ category, onClose, onSave }: CategoryFormModalProps) {
    const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const [isLoading, setIsLoading] = useState(false);
    const [isUploading, setIsUploading] = useState(false);

    const [formData, setFormData] = useState({
        name: category?.name || '',
        slug: category?.slug || '',
        description: category?.description || '',
        cover_image: category?.cover_image || '',
        is_active: category ? category.is_active : true,
    });

    // Auto-generate slug from name if creating a new category
    useEffect(() => {
        if (!category && formData.name) {
            const slugList = {
                'а': 'a', 'б': 'b', 'в': 'v', 'г': 'h', 'ґ': 'g', 'д': 'd', 'е': 'e',
                'є': 'ye', 'ж': 'zh', 'з': 'z', 'и': 'y', 'і': 'i', 'ї': 'yi', 'й': 'y',
                'к': 'k', 'л': 'l', 'м': 'm', 'н': 'n', 'о': 'o', 'п': 'p', 'р': 'r',
                'с': 's', 'т': 't', 'у': 'u', 'ф': 'f', 'х': 'kh', 'ц': 'ts', 'ч': 'ch',
                'ш': 'sh', 'щ': 'shch', 'ь': '', 'ю': 'yu', 'я': 'ya', ' ': '-', "'": ''
            };
            const generatedSlug = formData.name.toLowerCase()
                .split('')
                .map(char => slugList[char as keyof typeof slugList] !== undefined ? slugList[char as keyof typeof slugList] : char)
                .join('')
                .replace(/[^a-z0-9-]/g, '')
                .replace(/-+/g, '-')
                .replace(/^-|-$/g, '');

            setFormData(prev => ({ ...prev, slug: generatedSlug }));
        }
    }, [formData.name, category]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);

        try {
            if (category) {
                // Update
                const { error } = await supabase
                    .from('categories')
                    .update({
                        name: formData.name,
                        slug: formData.slug,
                        description: formData.description,
                        cover_image: formData.cover_image,
                        is_active: formData.is_active,
                    })
                    .eq('id', category.id);
                if (error) throw error;
                toast.success('Категорію збережено');
            } else {
                // Create
                const { count } = await supabase.from('categories').select('*', { count: 'exact', head: true });
                const sort_order = count || 0;

                const { error } = await supabase
                    .from('categories')
                    .insert([{
                        name: formData.name,
                        slug: formData.slug,
                        description: formData.description,
                        cover_image: formData.cover_image,
                        is_active: formData.is_active,
                        sort_order
                    }]);
                if (error) throw error;
                toast.success('Категорію створено');
            }
            onSave();
        } catch (error: any) {
            toast.error(error.message || 'Сталася помилка');
        } finally {
            setIsLoading(false);
        }
    };

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || e.target.files.length === 0) return;
        const file = e.target.files[0];
        setIsUploading(true);

        try {
            const fileExt = file.name.split('.').pop();
            const fileName = `${Math.random()}.${fileExt}`;
            const filePath = `categories/${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from('images')
                .upload(filePath, file);

            if (uploadError) throw uploadError;

            const { data } = supabase.storage.from('images').getPublicUrl(filePath);

            setFormData({ ...formData, cover_image: data.publicUrl });
        } catch (error: any) {
            toast.error('Помилка завантаження зображення');
        } finally {
            setIsUploading(false);
        }
    };

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 100,
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px'
        }}>
            <div style={{
                backgroundColor: 'white',
                borderRadius: '24px',
                width: '100%',
                maxWidth: '600px',
                maxHeight: '90vh',
                display: 'flex',
                flexDirection: 'column',
                boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)'
            }}>
                <div style={{ padding: '24px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h2 style={{ fontSize: '20px', fontWeight: 800, margin: 0, fontFamily: 'var(--font-heading)' }}>
                        {category ? 'Редагувати категорію' : 'Нова категорія'}
                    </h2>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}>
                        <X size={24} />
                    </button>
                </div>

                <div style={{ padding: '24px', overflowY: 'auto' }}>
                    <form id="categoryForm" onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

                        <div>
                            <label style={{ display: 'block', fontSize: '14px', fontWeight: 700, marginBottom: '8px', color: '#1e293b' }}>
                                Назва категорії (UA)
                            </label>
                            <input
                                type="text"
                                required
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                style={{
                                    width: '100%', padding: '12px 16px', borderRadius: '12px',
                                    border: '1px solid #e2e8f0', fontSize: '15px', outline: 'none'
                                }}
                            />
                        </div>

                        <div>
                            <label style={{ display: 'block', fontSize: '14px', fontWeight: 700, marginBottom: '8px', color: '#1e293b' }}>
                                Slug (URL-ідентифікатор)
                            </label>
                            <input
                                type="text"
                                required
                                value={formData.slug}
                                onChange={(e) => setFormData({ ...formData, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })}
                                style={{
                                    width: '100%', padding: '12px 16px', borderRadius: '12px',
                                    border: '1px solid #e2e8f0', fontSize: '15px', outline: 'none',
                                    backgroundColor: '#f8fafc'
                                }}
                            />
                            <p style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
                                Має бути унікальним (напр., photobooks)
                            </p>
                        </div>

                        <div>
                            <label style={{ display: 'block', fontSize: '14px', fontWeight: 700, marginBottom: '8px', color: '#1e293b' }}>
                                Опис (короткий текст)
                            </label>
                            <textarea
                                value={formData.description}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                rows={3}
                                style={{
                                    width: '100%', padding: '12px 16px', borderRadius: '12px',
                                    border: '1px solid #e2e8f0', fontSize: '15px', outline: 'none',
                                    resize: 'none'
                                }}
                            />
                        </div>

                        <div>
                            <label style={{ display: 'block', fontSize: '14px', fontWeight: 700, marginBottom: '8px', color: '#1e293b' }}>
                                Зображення категорії
                            </label>
                            <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                                <div style={{
                                    width: '80px', height: '80px', borderRadius: '12px',
                                    backgroundColor: '#f1f5f9', border: '1px dashed #cbd5e1',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    overflow: 'hidden', position: 'relative'
                                }}>
                                    {formData.cover_image ? (
                                        <img src={formData.cover_image} alt="Cover" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                    ) : (
                                        <ImageIcon size={24} color="#94a3b8" />
                                    )}
                                    {isUploading && (
                                        <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(255,255,255,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            <Loader2 size={24} className="animate-spin text-slate-500" />
                                        </div>
                                    )}
                                </div>
                                <label style={{
                                    padding: '10px 20px', borderRadius: '8px',
                                    border: '1px solid #e2e8f0', backgroundColor: 'white',
                                    cursor: 'pointer', fontSize: '14px', fontWeight: 600, color: '#475569',
                                    display: 'inline-flex', alignItems: 'center', gap: '8px'
                                }}>
                                    <Upload size={16} /> {formData.cover_image ? 'Змінити зображення' : 'Завантажити зображення'}
                                    <input type="file" accept="image/*" onChange={handleImageUpload} style={{ display: 'none' }} />
                                </label>
                            </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '8px', padding: '16px', backgroundColor: '#f8fafc', borderRadius: '12px' }}>
                            <div style={{ flex: 1 }}>
                                <div style={{ fontSize: '15px', fontWeight: 700, color: '#1e293b' }}>Відображати в сайдбарі</div>
                                <div style={{ fontSize: '13px', color: '#64748b' }}>Якщо вимкнено, категорія буде схована з публічного каталогу</div>
                            </div>
                            <label style={{ position: 'relative', display: 'inline-block', width: '48px', height: '26px' }}>
                                <input
                                    type="checkbox"
                                    checked={formData.is_active}
                                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                                    style={{ opacity: 0, width: 0, height: 0 }}
                                />
                                <span style={{
                                    position: 'absolute', cursor: 'pointer', top: 0, left: 0, right: 0, bottom: 0,
                                    backgroundColor: formData.is_active ? 'var(--primary)' : '#cbd5e1',
                                    transition: '.3s', borderRadius: '26px'
                                }}>
                                    <span style={{
                                        position: 'absolute', content: '""', height: '20px', width: '20px',
                                        left: formData.is_active ? '24px' : '4px', bottom: '3px',
                                        backgroundColor: 'white', transition: '.3s', borderRadius: '50%'
                                    }} />
                                </span>
                            </label>
                        </div>

                    </form>
                </div>

                <div style={{ padding: '24px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                    <button
                        type="button"
                        onClick={onClose}
                        style={{ padding: '12px 24px', borderRadius: '12px', border: '1px solid #e2e8f0', background: 'white', fontSize: '15px', fontWeight: 600, cursor: 'pointer' }}
                    >
                        Скасувати
                    </button>
                    <button
                        type="submit"
                        form="categoryForm"
                        disabled={isLoading}
                        style={{
                            padding: '12px 24px', borderRadius: '12px', border: 'none', background: 'var(--primary)',
                            color: 'white', fontSize: '15px', fontWeight: 700, cursor: 'pointer',
                            display: 'flex', alignItems: 'center', gap: '8px'
                        }}
                    >
                        {isLoading && <Loader2 size={16} className="animate-spin" />}
                        Зберегти категорію
                    </button>
                </div>
            </div>
        </div>
    );
}
