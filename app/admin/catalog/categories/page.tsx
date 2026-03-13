'use client';
import { useState, useEffect } from 'react';
import { createBrowserClient } from '@supabase/auth-helpers-nextjs';
import { Plus, GripVertical, Eye, EyeOff, Edit2, Trash2, Loader2, Search } from 'lucide-react';
import toast from 'react-hot-toast';

import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragEndEvent,
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
    useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { CategoryFormModal } from './CategoryFormModal';

interface Category {
    id: string;
    name: string;
    slug: string;
    description: string;
    cover_image: string;
    sort_order: number;
    is_active: boolean;
}

// Sortable Item Component
function SortableCategoryItem({ category, onEdit, onDelete, onToggleVisibility }: { category: Category, onEdit: (c: Category) => void, onDelete: (c: Category) => void, onToggleVisibility: (c: Category) => void }) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: category.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
        zIndex: isDragging ? 10 : 1,
    };

    return (
        <div ref={setNodeRef} style={style} className="flex items-center justify-between p-4 bg-white border border-slate-200 rounded-xl shadow-sm mb-3">
            <div className="flex items-center gap-4 flex-1">
                <button {...attributes} {...listeners} className="cursor-grab p-2 text-slate-400 hover:text-slate-600 active:cursor-grabbing">
                    <GripVertical size={20} />
                </button>
                <div style={{
                    width: '48px', height: '48px', borderRadius: '8px', overflow: 'hidden', backgroundColor: '#f1f5f9', flexShrink: 0
                }}>
                    {category.cover_image ? (
                        <img src={category.cover_image} alt={category.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#cbd5e1' }}>IMG</div>
                    )}
                </div>
                <div>
                    <h3 className="font-bold text-slate-800 text-[16px] m-0">{category.name}</h3>
                    <div className="text-[13px] text-slate-500 mt-1">/{category.slug}</div>
                </div>
            </div>

            <div className="flex items-center gap-2">
                <button
                    onClick={() => onToggleVisibility(category)}
                    style={{
                        padding: '8px',
                        borderRadius: '8px',
                        border: 'none',
                        background: category.is_active ? '#ecfdf5' : '#f1f5f9',
                        color: category.is_active ? '#10b981' : '#94a3b8',
                        cursor: 'pointer'
                    }}
                    title={category.is_active ? 'Сховати' : 'Показати'}
                >
                    {category.is_active ? <Eye size={18} /> : <EyeOff size={18} />}
                </button>
                <button
                    onClick={() => onEdit(category)}
                    style={{ padding: '8px', borderRadius: '8px', border: 'none', background: '#f8fafc', color: '#64748b', cursor: 'pointer' }}
                >
                    <Edit2 size={18} />
                </button>
                <button
                    onClick={() => onDelete(category)}
                    style={{ padding: '8px', borderRadius: '8px', border: 'none', background: '#fef2f2', color: '#ef4444', cursor: 'pointer' }}
                >
                    <Trash2 size={18} />
                </button>
            </div>
        </div>
    );
}

export default function CategoriesPage() {
    const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const [categories, setCategories] = useState<Category[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [search, setSearch] = useState('');

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );

    useEffect(() => {
        fetchCategories();
    }, []);

    const fetchCategories = async () => {
        setIsLoading(true);
        const { data, error } = await supabase
            .from('categories')
            .select('*')
            .order('sort_order', { ascending: true });

        if (error) {
            toast.error('Помилка завантаження категорій');
        } else {
            setCategories(data || []);
        }
        setIsLoading(false);
    };

    const handleDragEnd = async (event: DragEndEvent) => {
        const { active, over } = event;

        if (active.id !== over?.id) {
            setCategories((items) => {
                const oldIndex = items.findIndex(item => item.id === active.id);
                const newIndex = items.findIndex(item => item.id === over?.id);

                const newOrder = arrayMove(items, oldIndex, newIndex);

                // Setup bulk update
                updateSortOrder(newOrder);

                return newOrder;
            });
        }
    };

    const updateSortOrder = async (orderedCategories: Category[]) => {
        try {
            const updates = orderedCategories.map((cat, index) => ({
                id: cat.id,
                sort_order: index,
            }));

            // Supabase doesn't have a simple bulk update, so we update sequentially or using an RPC.
            // Using sequential updates for categories since the array is small (usually <20)
            await Promise.all(
                updates.map(u => supabase.from('categories').update({ sort_order: u.sort_order }).eq('id', u.id))
            );
            toast.success('Порядок збережено');
        } catch (error) {
            toast.error('Помилка збереження порядку');
            fetchCategories(); // revert UI
        }
    };

    const handleDelete = async (category: Category) => {
        // Check if products exist in this category first
        const { count, error: countError } = await supabase
            .from('products')
            .select('*', { count: 'exact', head: true })
            .eq('category_id', category.id);

        if (countError) {
            toast.error('Помилка перевірки товарів');
            return;
        }

        if (count && count > 0) {
            toast.error(`У цій категорії є ${count} товарів. Спочатку перемістіть або видаліть їх.`);
            return;
        }

        if (confirm(`Ви впевнені, що хочете видалити категорію "${category.name}"?`)) {
            const { error } = await supabase.from('categories').delete().eq('id', category.id);
            if (error) {
                toast.error('Помилка видалення');
            } else {
                toast.success('Категорію видалено');
                fetchCategories();
            }
        }
    };

    const handleToggleVisibility = async (category: Category) => {
        const { error } = await supabase
            .from('categories')
            .update({ is_active: !category.is_active })
            .eq('id', category.id);

        if (error) {
            toast.error('Помилка оновлення статусу');
        } else {
            toast.success('Статус оновлено');
            setCategories(categories.map(c => c.id === category.id ? { ...c, is_active: !c.is_active } : c));
        }
    };

    const filteredCategories = categories.filter(c => c.name.toLowerCase().includes(search.toLowerCase()));

    return (
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
                <h1 style={{ fontSize: '28px', fontWeight: 800, margin: 0, fontFamily: 'var(--font-heading)' }}>
                    Категорії Каталогу
                </h1>
                <button
                    onClick={() => { setSelectedCategory(null); setIsModalOpen(true); }}
                    style={{
                        display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 24px',
                        backgroundColor: 'var(--primary)', color: 'white', borderRadius: '12px',
                        fontWeight: 700, border: 'none', cursor: 'pointer'
                    }}
                >
                    <Plus size={20} /> Створити категорію
                </button>
            </div>

            <div style={{ marginBottom: '24px', position: 'relative' }}>
                <Search size={20} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                <input
                    type="text"
                    placeholder="Пошук категорій..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    style={{
                        width: '100%',
                        padding: '16px 16px 16px 48px',
                        borderRadius: '16px',
                        border: '1px solid #e2e8f0',
                        fontSize: '16px',
                        outline: 'none',
                    }}
                />
            </div>

            <div style={{ backgroundColor: '#f8fafc', borderRadius: '16px', padding: '24px' }}>
                {isLoading ? (
                    <div style={{ display: 'flex', justifyContent: 'center', padding: '40px 0', color: '#64748b' }}>
                        <Loader2 className="animate-spin" size={32} />
                    </div>
                ) : (
                    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                        <SortableContext items={filteredCategories.map(c => c.id)} strategy={verticalListSortingStrategy}>
                            {filteredCategories.map(cat => (
                                <SortableCategoryItem
                                    key={cat.id}
                                    category={cat}
                                    onEdit={(c) => { setSelectedCategory(c); setIsModalOpen(true); }}
                                    onDelete={handleDelete}
                                    onToggleVisibility={handleToggleVisibility}
                                />
                            ))}
                            {filteredCategories.length === 0 && (
                                <div style={{ textAlign: 'center', padding: '40px 0', color: '#94a3b8' }}>
                                    {search ? 'Нічого не знайдено' : 'Немає категорій'}
                                </div>
                            )}
                        </SortableContext>
                    </DndContext>
                )}
            </div>

            {isModalOpen && (
                <CategoryFormModal
                    category={selectedCategory}
                    onClose={() => setIsModalOpen(false)}
                    onSave={() => {
                        setIsModalOpen(false);
                        fetchCategories();
                    }}
                />
            )}
        </div>
    );
}
