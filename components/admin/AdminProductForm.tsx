'use client';
import { useState, useEffect, useCallback } from 'react';
import styles from './admin-product-form.module.css';
import { createClient } from '@/lib/supabase/client';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { useRouter } from 'next/navigation';
import {
    Upload,
    X,
    Save,
    ArrowLeft,
    Loader2,
    Image as ImageIcon,
    Settings,
    Globe,
    Layout,
    CheckCircle2,
    XCircle,
    Package,
    ChevronRight,
    Search,
    FileText,
    Plus,
    Video,
    Trash2,
    EyeOff,
    Tag,
    AlertCircle,
    GripVertical,
    Play
} from 'lucide-react';
import { toast } from 'sonner';
import MDEditor from '@uiw/react-md-editor';
import { useDropzone } from 'react-dropzone';
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
    horizontalListSortingStrategy,
    useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import CustomAttributeManager from './CustomAttributeManager';
import { CustomAttribute, AttributePriceModifiers } from '@/lib/types/product';

// Sortable Image Item
function SortableImage({ url, onRemove, index, isFirst }: { url: string, onRemove: (url: string) => void, index: number, isFirst: boolean }) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: url });
    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
        zIndex: isDragging ? 10 : 1,
    };

    return (
        <div ref={setNodeRef} className="relative group rounded-xl overflow-hidden border border-slate-200 aspect-square" style={{ ...style, position: 'relative' }}>
            <img src={url} alt={`Preview ${index}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />

            <div style={{
                position: 'absolute',
                inset: 0,
                backgroundColor: 'rgba(0,0,0,0.4)',
                opacity: 0,
                transition: 'opacity 0.2s',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
            }} onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')} onMouseLeave={(e) => (e.currentTarget.style.opacity = '0')}>
                <button type="button" {...attributes} {...listeners} style={{ padding: '8px', backgroundColor: 'white', color: '#64748b', border: 'none', borderRadius: '8px', cursor: 'grab' }}>
                    <GripVertical size={16} />
                </button>
                <button type="button" onClick={() => onRemove(url)} style={{ padding: '8px', backgroundColor: '#fef2f2', color: '#ef4444', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>
                    <Trash2 size={16} />
                </button>
            </div>
            {isFirst && (
                <div style={{
                    position: 'absolute',
                    top: '8px',
                    left: '8px',
                    backgroundColor: '#3b82f6',
                    color: 'white',
                    fontSize: '10px',
                    fontWeight: 800,
                    padding: '2px 8px',
                    borderRadius: '6px',
                    textTransform: 'uppercase'
                }}>
                    Головне
                </div>
            )}
        </div>
    );
}

interface ProductVariant {
    id: string;
    name: string;
    price: number;
    cost_price: number;
    sku: string;
    stock: number;
}

interface ProductFormProps {
    initialData?: any;
    isEditing?: boolean;
}

export default function AdminProductForm({ initialData, isEditing = false }: ProductFormProps) {
    const supabase = createClient();
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [categories, setCategories] = useState<any[]>([]);

    const [formData, setFormData] = useState({
        name: initialData?.name || '',
        slug: initialData?.slug || '',
        description: initialData?.description || '',
        short_description: initialData?.short_description || '',
        price: initialData?.price || 0,
        stock: initialData?.stock || 0,
        category_id: initialData?.category_id || '',
        is_active: initialData?.is_active ?? true,
        meta_title: initialData?.meta_title || '',
        meta_description: initialData?.meta_description || '',
        is_personalized: initialData?.is_personalized ?? true,
        track_inventory: initialData?.track_inventory ?? true,
        low_stock_threshold: initialData?.low_stock_threshold ?? 10,
        cost_price: initialData?.cost_price || 0,
        cost_price_currency: initialData?.cost_price_currency || 'UAH',
        video_url: initialData?.video_url || '',
        is_popular: initialData?.is_popular ?? false,
        sku: initialData?.sku || '',
    });

    const [variants, setVariants] = useState<ProductVariant[]>(initialData?.variants || []);
    const [images, setImages] = useState<string[]>(initialData?.images || []);
    const [uploading, setUploading] = useState(false);
    const [customAttributes, setCustomAttributes] = useState<CustomAttribute[]>(initialData?.custom_attributes || []);
    const [attributePriceModifiers, setAttributePriceModifiers] = useState<AttributePriceModifiers>(initialData?.attribute_price_modifiers || {});
    const [tags, setTags] = useState<string[]>(initialData?.tags || []);
    const [tagInput, setTagInput] = useState('');
    const [allExistingTags, setAllExistingTags] = useState<string[]>([]);
    const [isTagDropdownOpen, setIsTagDropdownOpen] = useState(false);

    useEffect(() => {
        const fetchCategories = async () => {
            const { data } = await supabase.from('categories').select('*').order('name');
            if (data) setCategories(data);
        };
        const fetchTags = async () => {
            const { data } = await supabase.from('products').select('tags');
            if (data) {
                const uniqueTags = Array.from(new Set((data as any[]).flatMap(p => p.tags || []))) as string[];
                setAllExistingTags(uniqueTags);
            }
        };
        fetchCategories();
        fetchTags();
    }, [supabase]);

    useEffect(() => {
        if (!isEditing && formData.name) {
            const slug = formData.name.toLowerCase()
                .replace(/ /g, '-')
                .replace(/[^\w-]+/g, '');
            setFormData(prev => ({ ...prev, slug }));
        }
    }, [formData.name, isEditing]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value, type } = e.target;
        const val = type === 'checkbox' ? (e.target as HTMLInputElement).checked : value;

        if (name === 'is_personalized') {
            setFormData(prev => ({
                ...prev,
                [name]: val,
                track_inventory: val === true ? false : true
            }));
        } else {
            setFormData(prev => ({ ...prev, [name]: val }));
        }
    };

    const [videoUploading, setVideoUploading] = useState(false);

    const onDrop = useCallback(async (acceptedFiles: File[]) => {
        if (images.length + acceptedFiles.length > 10) {
            toast.error('Максимальна кількість зображень — 10');
            return;
        }

        const validFiles = acceptedFiles.filter(file => {
            const isValidType = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'].includes(file.type);
            const isValidSize = file.size <= 10 * 1024 * 1024; // 10MB

            if (!isValidType) toast.error(`Непідтримуваний формат: ${file.name}`);
            if (!isValidSize) toast.error(`Файл завеликий (>10MB): ${file.name}`);

            return isValidType && isValidSize;
        });

        if (validFiles.length === 0) return;

        setUploading(true);
        const newImagesBatch: string[] = [];
        const total = validFiles.length;

        for (let i = 0; i < total; i++) {
            const file = validFiles[i];
            const toastId = toast.loading(`Завантаження ${i + 1}/${total}...`);

            const fileExt = file.name.split('.').pop();
            const fileName = `${Math.random().toString(36).substring(2)}.${fileExt}`;
            const filePath = `products/${fileName}`;

            try {
                const { error: uploadError } = await supabaseAdmin.storage
                    .from('products')
                    .upload(filePath, file);

                if (uploadError) throw uploadError;

                const { data: { publicUrl } } = supabase.storage
                    .from('products')
                    .getPublicUrl(filePath);

                newImagesBatch.push(publicUrl);
                toast.dismiss(toastId);
            } catch (err: any) {
                toast.error(`Помилка завантаження ${file.name}: ${err.message}`);
                toast.dismiss(toastId);
            }
        }

        const updatedImages = [...images, ...newImagesBatch];
        setImages(updatedImages);

        // If editing, update the products table immediately 
        if (isEditing && initialData?.id) {
            try {
                // Get current images array from DB to avoid overwriting recent changes
                const { data: product } = await supabase
                    .from('products')
                    .select('images')
                    .eq('id', initialData.id)
                    .single();

                const dbImages = product?.images || [];
                const finalImages = [...dbImages, ...newImagesBatch].slice(0, 10);

                const { error: updateError } = await supabase
                    .from('products')
                    .update({ images: finalImages })
                    .eq('id', initialData.id);

                if (updateError) throw updateError;
                setImages(finalImages); // Sync state with DB
            } catch (err: any) {
                console.error('Immediate update error:', err);
                toast.error('Помилка синхронізації з базою даних');
            }
        }

        setUploading(false);
        toast.success(newImagesBatch.length > 0 ? 'Зображення додано' : 'Нічого не завантажено');
    }, [images, supabase, isEditing, initialData?.id]);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: { 'image/*': ['.jpeg', '.jpg', '.png', '.webp'] },
        maxFiles: 10 - images.length
    });

    const handleVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const isValidType = ['video/mp4', 'video/quicktime', 'video/x-msvideo'].includes(file.type);
        const isValidSize = file.size <= 200 * 1024 * 1024; // 200MB

        if (!isValidType) {
            toast.error('Непідтримуваний формат відео (MP4, MOV, AVI)');
            return;
        }
        if (!isValidSize) {
            toast.error('Відео завелике (>200MB)');
            return;
        }

        setVideoUploading(true);
        const fileExt = file.name.split('.').pop();
        const fileName = `${Math.random().toString(36).substring(2)}.${fileExt}`;
        const filePath = `videos/${fileName}`;

        try {
            const { error: uploadError } = await supabaseAdmin.storage
                .from('videos')
                .upload(filePath, file);

            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage
                .from('videos')
                .getPublicUrl(filePath);

            setFormData(prev => ({ ...prev, video_url: publicUrl }));

            // If editing, update database immediately
            if (isEditing && initialData?.id) {
                const { error: updateError } = await supabase
                    .from('products')
                    .update({ video_url: publicUrl })
                    .eq('id', initialData.id);

                if (updateError) throw updateError;
            }

            toast.success('Відео завантажено');
        } catch (err: any) {
            toast.error(`Помилка: ${err.message}`);
        } finally {
            setVideoUploading(false);
        }
    };

    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (over && active.id !== over.id) {
            setImages((items) => {
                const oldIndex = items.indexOf(active.id as string);
                const newIndex = items.indexOf(over.id as string);
                return arrayMove(items, oldIndex, newIndex);
            });
        }
    };

    const addVariant = () => {
        setVariants([...variants, { id: crypto.randomUUID(), name: '', price: 0, cost_price: 0, sku: '', stock: 0 }]);
    };

    const updateVariant = (id: string, field: keyof ProductVariant, value: any) => {
        setVariants(variants.map(v => v.id === id ? { ...v, [field]: value } : v));
    };

    const removeVariant = (id: string) => {
        setVariants(variants.filter(v => v.id !== id));
    };

    const handleAddTag = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && tagInput.trim()) {
            e.preventDefault();
            if (!tags.includes(tagInput.trim())) {
                setTags([...tags, tagInput.trim()]);
            }
            setTagInput('');
        }
    };

    const removeTag = (tag: string) => {
        setTags(tags.filter(t => t !== tag));
    };

    const handleSubmit = async (publish: boolean) => {
        setLoading(true);

        const lowestPrice = variants.length > 0
            ? Math.min(...variants.map(v => v.price))
            : formData.price;

        const { stock, is_active, ...restFormData } = formData;

        const payload = {
            ...restFormData,
            category_id: restFormData.category_id === '' || restFormData.category_id === 'none' || !restFormData.category_id ? null : restFormData.category_id,
            price: lowestPrice,
            stock_quantity: stock,
            status: publish ? 'active' : 'draft',
            is_active: publish,
            images: images,
            variants: variants,
            characteristics: customAttributes,
            attribute_price_modifiers: attributePriceModifiers,
            tags: tags,
            updated_at: new Date().toISOString()
        };

        try {
            if (isEditing) {
                const { error } = await supabase
                    .from('products')
                    .update(payload)
                    .eq('id', initialData.id);
                if (error) throw error;
                toast.success(publish ? 'Товар опубліковано!' : 'Зміни збережено.');
            } else {
                const { error } = await supabase
                    .from('products')
                    .insert([payload]);
                if (error) throw error;
                toast.success(publish ? 'Товар створено та опубліковано!' : 'Товар збережено як чернетку.');
            }
            router.push('/admin/products');
            router.refresh();
        } catch (error: any) {
            console.error('Save error:', error);
            toast.error(error.message || 'Помилка при збереженні');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ maxWidth: '1440px', margin: '0 auto', color: '#0f172a' }}>
            {/* Top Bar: Replaces the previous simple header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                    <button type="button" onClick={() => router.back()} style={iconButtonStyle}><ArrowLeft size={20} /></button>
                    <div>
                        <h1 style={{ fontSize: '32px', fontWeight: 950, letterSpacing: '-0.02em', marginBottom: '4px' }}>
                            {isEditing ? 'Редагування товару' : 'Новий товар'}
                        </h1>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: '#64748b' }}>
                            Admin Panel <ChevronRight size={14} /> Products <ChevronRight size={14} /> {isEditing ? formData.name : 'Create'}
                        </div>
                    </div>
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                    <button type="button" onClick={() => handleSubmit(false)} disabled={loading} style={draftBtnStyle}>
                        {loading ? <Loader2 size={18} className={styles.animateSpin} /> : <Save size={18} />}
                        Зберегти чернетку
                    </button>
                    <button type="button" onClick={() => handleSubmit(true)} disabled={loading} style={publishBtnStyle}>
                        {loading ? <Loader2 size={18} className={styles.animateSpin} /> : <Globe size={18} />}
                        Опублікувати
                    </button>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 400px', gap: '32px' }}>
                {/* Main Content (Left) */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>

                    {/* General Content Card */}
                    <div style={cardStyle}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '28px' }}>
                            <div style={{ padding: '10px', backgroundColor: '#eff6ff', borderRadius: '12px', color: '#3b82f6' }}><FileText size={20} /></div>
                            <h3 style={{ fontSize: '18px', fontWeight: 900, margin: 0 }}>Контент та опис</h3>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                            <div>
                                <label style={labelStyle}>Назва товару (UA) *</label>
                                <input type="text" name="name" value={formData.name} onChange={handleInputChange} style={inputStyle} placeholder="Введіть повну назву товару" required />
                            </div>
                            <div>
                                <label style={labelStyle}>Slug (URL-адреса)</label>
                                <input type="text" name="slug" value={formData.slug} onChange={handleInputChange} style={inputStyle} />
                            </div>
                            {variants.length === 0 && (
                                <div>
                                    <label style={labelStyle}>Артикул (SKU)</label>
                                    <input
                                        type="text"
                                        name="sku"
                                        value={formData.sku}
                                        onChange={handleInputChange}
                                        style={inputStyle}
                                        placeholder="Наприклад: BK-2020-CL"
                                    />
                                </div>
                            )}
                            <div>
                                <label style={labelStyle}>Короткий опис (на картці)</label>
                                <textarea name="short_description" value={formData.short_description} onChange={handleInputChange} style={{ ...textareaStyle, minHeight: '80px' }} rows={2} />
                            </div>
                            <div>
                                <label style={labelStyle}>Повний опис продукту</label>
                                <div data-color-mode="light" style={{ borderRadius: '16px', overflow: 'hidden', border: '1.5px solid #e2e8f0' }}>
                                    <MDEditor
                                        value={formData.description}
                                        onChange={(val) => setFormData(p => ({ ...p, description: val || '' }))}
                                        height={450}
                                        preview="edit"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Media Card */}
                    <div style={cardStyle}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '28px' }}>
                            <div style={{ padding: '10px', backgroundColor: '#f5f3ff', borderRadius: '12px', color: '#8b5cf6' }}><ImageIcon size={20} /></div>
                            <h3 style={{ fontSize: '18px', fontWeight: 900, margin: 0 }}>Зображення та Відео</h3>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <label style={labelStyle}>Фотогалерея ({images.length} / 10)</label>
                                <span style={{ fontSize: '11px', fontWeight: 800, color: images.length >= 10 ? '#ef4444' : '#94a3b8' }}>
                                    {images.length === 0 ? 'Мінімально 1 фото' : ''}
                                </span>
                            </div>

                            <div {...getRootProps()} style={{
                                ...emptyStateStyle,
                                cursor: 'pointer',
                                borderColor: isDragActive ? '#3b82f6' : '#f1f5f9',
                                backgroundColor: isDragActive ? '#f0f9ff' : '#f8fafc',
                                border: '2px dashed #e2e8f0',
                                padding: '24px'
                            }}>
                                <input {...getInputProps()} />
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                                    {uploading ? <Loader2 className={styles.animateSpin} size={24} /> : <Upload size={24} color="#cbd5e1" />}
                                    <p style={{ margin: 0, fontSize: '13px', fontWeight: 600 }}>
                                        {isDragActive ? 'Скиньте сюди' : 'Завантажити фото'}
                                    </p>
                                </div>
                            </div>

                            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                                <SortableContext items={images} strategy={horizontalListSortingStrategy}>
                                    <div style={imageGridStyle}>
                                        {images.map((url, index) => (
                                            <SortableImage
                                                key={url}
                                                url={url}
                                                index={index}
                                                isFirst={index === 0}
                                                onRemove={async (u) => {
                                                    const newImages = images.filter(img => img !== u);
                                                    setImages(newImages);

                                                    // If editing, update database immediately
                                                    if (isEditing && initialData?.id) {
                                                        const { error } = await supabase
                                                            .from('products')
                                                            .update({ images: newImages })
                                                            .eq('id', initialData.id);

                                                        if (error) {
                                                            toast.error('Помилка при видаленні з бази');
                                                        }
                                                    }
                                                }}
                                            />
                                        ))}
                                    </div>
                                </SortableContext>
                            </DndContext>

                            <div style={{ marginTop: '20px', paddingTop: '24px', borderTop: '1px solid #f1f5f9' }}>
                                <label style={{ ...labelStyle, marginBottom: '16px' }}>Відео-презентація (з пристрою)</label>
                                <div style={{ backgroundColor: '#f8fafc', borderRadius: '20px', padding: '20px', border: '1px solid #f1f5f9' }}>
                                    {formData.video_url ? (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                            <div style={{ position: 'relative', width: '120px', aspectRatio: '16/9', borderRadius: '12px', overflow: 'hidden', backgroundColor: 'black' }}>
                                                <video src={formData.video_url} style={{ width: '100%', height: '100%' }} />
                                                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.3)' }}>
                                                    <Play size={20} color="white" />
                                                </div>
                                            </div>
                                            <div style={{ flex: 1 }}>
                                                <p style={{ margin: 0, fontSize: '13px', fontWeight: 700 }}>Відео завантажено</p>
                                                <button
                                                    type="button"
                                                    onClick={async () => {
                                                        setFormData(p => ({ ...p, video_url: '' }));
                                                        if (isEditing && initialData?.id) {
                                                            await supabase
                                                                .from('products')
                                                                .update({ video_url: '' })
                                                                .eq('id', initialData.id);
                                                            toast.success('Відео видалено');
                                                        }
                                                    }}
                                                    style={{ marginTop: '8px', padding: '4px 12px', backgroundColor: '#fef2f2', color: '#ef4444', border: 'none', borderRadius: '8px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}
                                                >
                                                    Видалити відео
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div style={{ textAlign: 'center' }}>
                                            <input
                                                type="file"
                                                id="video-upload"
                                                accept="video/mp4,video/quicktime,video/x-msvideo"
                                                style={{ display: 'none' }}
                                                onChange={handleVideoUpload}
                                            />
                                            <label htmlFor="video-upload" style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                gap: '12px',
                                                cursor: 'pointer',
                                                padding: '12px'
                                            }}>
                                                {videoUploading ? <Loader2 className="animate-spin" size={20} /> : <Video size={20} color="#cbd5e1" />}
                                                <span style={{ fontSize: '13px', fontWeight: 600 }}>Обрати відео (макс. 200MB)</span>
                                            </label>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Variants Card */}
                    <div style={cardStyle}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <div style={{ padding: '10px', backgroundColor: '#fdf2f8', borderRadius: '12px', color: '#ec4899' }}><Layout size={20} /></div>
                                <h3 style={{ fontSize: '18px', fontWeight: 900, margin: 0 }}>Варіації продукту</h3>
                            </div>
                            <button type="button" onClick={addVariant} style={addBtnStyle}><Plus size={18} /> Додати варіант</button>
                        </div>
                        {variants.length === 0 ? (
                            <div style={emptyStateStyle}>Додайте варіації, щоб налаштувати ціни для різних розмірів чи форматів.</div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', overflowX: 'auto' }}>
                                <div style={variantHeaderStyle}>
                                    <span style={{ minWidth: '180px', flex: 2 }}>Назва варіації</span>
                                    <span style={{ minWidth: '100px', flex: 1 }}>Ціна (грн)</span>
                                    <span style={{ minWidth: '100px', flex: 1 }}>Собівартість</span>
                                    <span style={{ minWidth: '80px', flex: 1 }}>Маржа</span>
                                    <span style={{ minWidth: '100px', flex: 1 }}>SKU</span>
                                    {!formData.is_personalized && <span style={{ minWidth: '80px', flex: 0.8 }}>Склад</span>}
                                    <span style={{ width: '40px' }}></span>
                                </div>
                                {variants.map((v, idx) => {
                                    const marginGrivna = v.price - v.cost_price;
                                    const marginPercent = v.price > 0 ? (marginGrivna / v.price) * 100 : 0;

                                    return (
                                        <div key={v.id} style={variantRowStyle}>
                                            <input style={{ minWidth: '180px', flex: 2, ...variantInputStyle }} value={v.name} onChange={e => updateVariant(v.id, 'name', e.target.value)} placeholder="напр. 20х20" />
                                            <input style={{ minWidth: '100px', flex: 1, ...variantInputStyle }} type="number" value={v.price} onChange={e => updateVariant(v.id, 'price', Number(e.target.value))} />
                                            <input style={{ minWidth: '100px', flex: 1, ...variantInputStyle }} type="number" value={v.cost_price} onChange={e => updateVariant(v.id, 'cost_price', Number(e.target.value))} />
                                            <div style={{ minWidth: '80px', flex: 1, fontSize: '12px', fontWeight: 700, color: marginGrivna > 0 ? '#10b981' : '#f43f5e', display: 'flex', flexDirection: 'column' }}>
                                                <span>{marginGrivna.toFixed(0)} ₴</span>
                                                <span style={{ fontSize: '10px', opacity: 0.8 }}>{marginPercent.toFixed(1)}%</span>
                                            </div>
                                            <input style={{ minWidth: '100px', flex: 1, ...variantInputStyle }} value={v.sku} onChange={e => updateVariant(v.id, 'sku', e.target.value)} placeholder="SKU" />
                                            {!formData.is_personalized && (
                                                <input style={{ minWidth: '80px', flex: 0.8, ...variantInputStyle }} type="number" value={v.stock} onChange={e => updateVariant(v.id, 'stock', Number(e.target.value))} />
                                            )}
                                            <button type="button" onClick={() => removeVariant(v.id)} style={{ padding: '8px', color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center' }}><Trash2 size={18} /></button>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* Custom Attributes Management */}
                    <CustomAttributeManager
                        attributes={customAttributes}
                        priceModifiers={attributePriceModifiers}
                        onChange={(attrs, modifiers) => {
                            setCustomAttributes(attrs);
                            setAttributePriceModifiers(modifiers);
                        }}
                    />
                </div>

                {/* Sidebar (Right) */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>

                    {/* Status & Settings Card */}
                    <div style={cardStyle}>
                        <h3 style={sectionTitleStyle}>Статус та Тип</h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                            <div>
                                <label style={labelStyle}>Категорія</label>
                                <select name="category_id" value={formData.category_id || ''} onChange={handleInputChange} style={selectInputStyle}>
                                    <option value="">Не вибрано</option>
                                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                            </div>
                            <div style={toggleRowStyle}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    {formData.is_active ? <CheckCircle2 size={18} color="#10b981" /> : <EyeOff size={18} color="#94a3b8" />}
                                    <span style={{ fontSize: '14px', fontWeight: 700 }}>{formData.is_active ? 'Активний' : 'Чернетка'}</span>
                                </div>
                                <input type="checkbox" id="is_active" name="is_active" checked={formData.is_active} onChange={handleInputChange} style={checkboxStyle} />
                            </div>
                            <div style={toggleRowStyle}>
                                <span style={{ fontSize: '14px', fontWeight: 700 }}>Популярний</span>
                                <input type="checkbox" id="is_popular" name="is_popular" checked={formData.is_popular} onChange={handleInputChange} style={checkboxStyle} />
                            </div>
                            <div style={toggleRowStyle}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <input type="checkbox" name="is_personalized" checked={formData.is_personalized} onChange={handleInputChange} style={checkboxStyle} />
                                    <div>
                                        <span style={{ fontSize: '14px', fontWeight: 800 }}>Персоналізований товар</span>
                                        {formData.is_personalized && (
                                            <p style={{ fontSize: '11px', color: '#64748b', margin: '2px 0 0 0' }}>
                                                Персоналізований товар виготовляється під замовлення. Залишки на складі не відстежуються.
                                            </p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Pricing & Stock Card */}
                    <div style={cardStyle}>
                        <h3 style={sectionTitleStyle}>Ціна та Склад</h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                            {variants.length === 0 && (
                                <div>
                                    <label style={labelStyle}>Базова ціна (UAH)</label>
                                    <input type="number" name="price" value={formData.price} onChange={handleInputChange} style={inputStyle} />
                                </div>
                            )}
                            <div>
                                <label style={labelStyle}>Собівартість (cost_price)</label>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                    <input type="number" name="cost_price" value={formData.cost_price} onChange={handleInputChange} style={{ ...inputStyle, flex: 1 }} />
                                    <select name="cost_price_currency" value={formData.cost_price_currency} onChange={handleInputChange} style={{ ...selectInputStyle, width: '90px' }}>
                                        <option value="UAH">UAH</option>
                                        <option value="USD">USD</option>
                                        <option value="EUR">EUR</option>
                                    </select>
                                </div>
                            </div>
                            {!formData.is_personalized && (
                                <>
                                    <div>
                                        <label style={labelStyle}>Загальний склад (шт)</label>
                                        <div style={{ position: 'relative' }}>
                                            <div style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }}><Package size={18} /></div>
                                            <input type="number" name="stock" value={formData.stock} onChange={handleInputChange} style={{ ...inputStyle, paddingLeft: '44px' }} />
                                        </div>
                                    </div>
                                    <div>
                                        <label style={labelStyle}>Поріг низького залишку</label>
                                        <input type="number" name="low_stock_threshold" value={formData.low_stock_threshold} onChange={handleInputChange} style={inputStyle} />
                                    </div>
                                </>
                            )}
                        </div>
                    </div>

                    {/* Tags Card */}
                    <div style={cardStyle}>
                        <h3 style={sectionTitleStyle}>Теги товару</h3>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '16px' }}>
                            {tags.map(t => (
                                <span key={t} style={tagStyle}>
                                    {t} <X size={12} onClick={() => removeTag(t)} style={{ cursor: 'pointer' }} />
                                </span>
                            ))}
                        </div>
                        <div style={{ position: 'relative' }}>
                            <div style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }}><Tag size={16} /></div>
                            <input
                                value={tagInput}
                                onChange={e => {
                                    setTagInput(e.target.value);
                                    setIsTagDropdownOpen(true);
                                }}
                                onFocus={() => setIsTagDropdownOpen(true)}
                                onKeyDown={handleAddTag}
                                placeholder="Шукайте або додавайте тег..."
                                style={{ ...inputStyle, paddingLeft: '44px' }}
                            />

                            {isTagDropdownOpen && (
                                <div style={tagDropdownStyle}>
                                    <div style={{ padding: '8px 12px', fontSize: '11px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase' }}>Існуючі теги</div>
                                    <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                                        {allExistingTags
                                            .filter(t => t.toLowerCase().includes(tagInput.toLowerCase()) && !tags.includes(t))
                                            .map(t => (
                                                <div
                                                    key={t}
                                                    onClick={() => {
                                                        setTags([...tags, t]);
                                                        setTagInput('');
                                                        setIsTagDropdownOpen(false);
                                                    }}
                                                    style={tagDropdownItemStyle}
                                                >
                                                    {t}
                                                </div>
                                            ))
                                        }
                                        {tagInput && !allExistingTags.some(t => t.toLowerCase() === tagInput.toLowerCase()) && (
                                            <div
                                                onClick={() => {
                                                    setTags([...tags, tagInput.trim()]);
                                                    setTagInput('');
                                                    setIsTagDropdownOpen(false);
                                                }}
                                                style={{ ...tagDropdownItemStyle, color: '#3b82f6', borderTop: '1px solid #f1f5f9' }}
                                            >
                                                + Створити "{tagInput}"
                                            </div>
                                        )}
                                    </div>
                                    <div
                                        onClick={() => setIsTagDropdownOpen(false)}
                                        style={{ padding: '8px', textAlign: 'center', fontSize: '11px', color: '#94a3b8', cursor: 'pointer', borderTop: '1px solid #f1f5f9' }}
                                    >
                                        Закрити
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* SEO Card */}
                    <div style={cardStyle}>
                        <h3 style={sectionTitleStyle}>SEO Оптимізація</h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                            <div>
                                <label style={labelStyle}>Meta Title</label>
                                <input type="text" name="meta_title" value={formData.meta_title} onChange={handleInputChange} style={inputStyle} />
                            </div>
                            <div>
                                <label style={labelStyle}>Meta Description</label>
                                <textarea name="meta_description" value={formData.meta_description} onChange={handleInputChange} style={textareaStyle} rows={4} />
                            </div>
                        </div>
                    </div>
                </div>
            </div>

        </div>
    );
}

// Re-using bits of premium style logic from previous work
const cardStyle = { backgroundColor: 'white', padding: '32px', borderRadius: '32px', border: '1px solid #f1f5f9', boxShadow: '0 4px 25px rgba(0,0,0,0.02)' };
const iconButtonStyle = { width: '48px', height: '48px', borderRadius: '16px', border: '1.5px solid #e2e8f0', background: 'white', color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' };
const labelStyle = { display: 'block', fontSize: '11px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase' as any, letterSpacing: '0.05em', marginBottom: '8px' };
const inputStyle = { width: '100%', padding: '14px 18px', borderRadius: '14px', border: '1.5px solid #e2e8f0', outline: 'none', fontSize: '14px', backgroundColor: '#f8fafc', fontWeight: 600, transition: 'all 0.2s' };
const textareaStyle = { width: '100%', padding: '14px 18px', borderRadius: '14px', border: '1.5px solid #e2e8f0', outline: 'none', fontSize: '14px', backgroundColor: '#f8fafc', fontWeight: 500, resize: 'none' as any };
const selectInputStyle = { width: '100%', padding: '14px 18px', borderRadius: '14px', border: '1.5px solid #e2e8f0', backgroundColor: '#f8fafc', outline: 'none', fontSize: '14px', fontWeight: 700, cursor: 'pointer' };
const sectionTitleStyle = { fontSize: '16px', fontWeight: 900, marginBottom: '24px', color: '#1e293b' };
const draftBtnStyle = { display: 'flex', alignItems: 'center', gap: '8px', padding: '14px 24px', backgroundColor: 'white', border: '1.5px solid #e2e8f0', color: '#475569', borderRadius: '16px', fontWeight: 800, cursor: 'pointer' };
const publishBtnStyle = { display: 'flex', alignItems: 'center', gap: '8px', padding: '14px 24px', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '16px', fontWeight: 800, cursor: 'pointer' };
const addBtnStyle = { display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', backgroundColor: '#f1f5f9', color: '#1e293b', borderRadius: '12px', border: 'none', fontWeight: 800, fontSize: '13px', cursor: 'pointer' };
const emptyStateStyle = { padding: '40px', textAlign: 'center' as any, border: '2px dashed #f1f5f9', borderRadius: '24px', color: '#94a3b8', fontWeight: 500, fontSize: '14px' };
const imageGridStyle = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: '16px' };
const imageWrapperStyle = { position: 'relative' as any, aspectRatio: '1/1', borderRadius: '16px', overflow: 'hidden', border: '1px solid #f1f5f9' };
const removeImageBtnStyle = { position: 'absolute' as any, top: '6px', right: '6px', padding: '6px', backgroundColor: 'rgba(0,0,0,0.5)', color: 'white', borderRadius: '50%', border: 'none', cursor: 'pointer', display: 'flex' };
const coverLabelStyle = { position: 'absolute' as any, bottom: 0, left: 0, right: 0, padding: '4px', backgroundColor: 'rgba(16, 185, 129, 0.9)', color: 'white', fontSize: '10px', textAlign: 'center' as any, fontWeight: 900, textTransform: 'uppercase' as any };
const uploadTriggerStyle = { aspectRatio: '1/1', borderRadius: '16px', border: '2px dashed #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#cbd5e1', backgroundColor: '#f8fafc' };
const variantHeaderStyle = { display: 'flex', gap: '12px', padding: '0 16px', fontSize: '11px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase' as any };
const variantRowStyle = { display: 'flex', gap: '12px', alignItems: 'center' };
const variantInputStyle = { padding: '10px 14px', borderRadius: '12px', border: '1.5px solid #e2e8f0', outline: 'none', fontSize: '13px', backgroundColor: '#f8fafc', fontWeight: 700 };
const toggleRowStyle = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px', backgroundColor: '#f8fafc', borderRadius: '16px' };
const checkboxStyle = { width: '20px', height: '20px', accentColor: '#3b82f6', cursor: 'pointer' };
const tagStyle = { display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', backgroundColor: '#eff6ff', color: '#3b82f6', borderRadius: '100px', fontSize: '13px', fontWeight: 800 };
const tagDropdownStyle: React.CSSProperties = { position: 'absolute', top: '100%', left: 0, right: 0, backgroundColor: 'white', borderRadius: '16px', border: '1.5px solid #e2e8f0', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', zIndex: 50, marginTop: '8px', overflow: 'hidden' };
const tagDropdownItemStyle: React.CSSProperties = { padding: '10px 16px', fontSize: '14px', fontWeight: 600, color: '#1e293b', cursor: 'pointer', transition: 'background 0.2s' };
const cardTitleStyle = { fontSize: '18px', fontWeight: 900 };

