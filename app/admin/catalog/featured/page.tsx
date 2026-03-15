'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
    GripVertical,
    Search,
    Trash2,
    Loader2,
    Star,
    Image as ImageIcon,
    Plus,
    X,
    Layout,
    ArrowUpRight
} from 'lucide-react';
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

interface Product {
    id: string;
    name: string;
    images: string[];
    price: number;
    popular_order: number;
}

function SortableProductItem({ product, onRemove }: { product: Product, onRemove: (id: string) => void }) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: product.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
        zIndex: isDragging ? 20 : 1,
    };

    return (
        <div ref={setNodeRef} style={{ ...style, ...featuredItemStyle }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '20px', flex: 1 }}>
                <button type="button" {...attributes} {...listeners} style={dragHandleStyle}>
                    <GripVertical size={20} />
                </button>
                <div style={thumbnailStyle}>
                    {product.images && product.images[0] ? (
                        <img src={product.images[0]} alt={product.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                        <ImageIcon size={20} color="#cbd5e1" />
                    )}
                </div>
                <div>
                    <h3 style={{ fontSize: '15px', fontWeight: 800, color: '#263A99', margin: '0 0 4px 0' }}>{product.name}</h3>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--primary)' }}>{product.price} ₴</div>
                </div>
            </div>

            <button
                onClick={() => onRemove(product.id)}
                style={removeBtnStyle}
                title="Видалити"
            >
                <Trash2 size={18} />
            </button>
        </div>
    );
}

export default function FeaturedProductsPage() {
    const supabase = createClient();

    const [featured, setFeatured] = useState<Product[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<Product[]>([]);
    const [isSearching, setIsSearching] = useState(false);

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );

    useEffect(() => {
        fetchFeatured();
    }, []);

    useEffect(() => {
        const delaySearch = setTimeout(() => {
            if (searchQuery.trim().length >= 2) {
                performSearch(searchQuery);
            } else {
                setSearchResults([]);
            }
        }, 300);
        return () => clearTimeout(delaySearch);
    }, [searchQuery]);

    const fetchFeatured = async () => {
        setIsLoading(true);
        const { data, error } = await supabase
            .from('products')
            .select('id, name, images, price, popular_order')
            .eq('is_popular', true)
            .order('popular_order', { ascending: true });

        if (error) {
            toast.error('Помилка завантаження');
        } else {
            setFeatured(data || []);
        }
        setIsLoading(false);
    };

    const performSearch = async (query: string) => {
        setIsSearching(true);
        const { data, error } = await supabase
            .from('products')
            .select('id, name, images, price, popular_order')
            .ilike('name', `%${query}%`)
            .eq('is_popular', false)
            .limit(5);

        if (!error && data) {
            setSearchResults(data);
        }
        setIsSearching(false);
    };

    const handleDragEnd = async (event: DragEndEvent) => {
        const { active, over } = event;
        if (active.id !== over?.id) {
            const oldIndex = featured.findIndex(item => item.id === active.id);
            const newIndex = featured.findIndex(item => item.id === over?.id);
            const newOrder = arrayMove(featured, oldIndex, newIndex);
            setFeatured(newOrder);
            updateOrderInDB(newOrder);
        }
    };

    const updateOrderInDB = async (ordered: Product[]) => {
        try {
            await Promise.all(
                ordered.map((p, index) =>
                    supabase.from('products').update({ popular_order: index }).eq('id', p.id)
                )
            );
            toast.success('Порядок оновлено');
        } catch (error) {
            toast.error('Помилка збереження порядку');
            fetchFeatured();
        }
    };

    const handleAdd = async (product: Product) => {
        if (featured.length >= 8) {
            toast.error('Ліміт 8 товарів вичерпано');
            return;
        }

        try {
            const nextOrder = featured.length;
            const { error } = await supabase
                .from('products')
                .update({ is_popular: true, popular_order: nextOrder })
                .eq('id', product.id);

            if (error) throw error;

            toast.success('Додано');
            setFeatured([...featured, { ...product, popular_order: nextOrder }]);
            setSearchQuery('');
            setSearchResults([]);
        } catch (error) {
            toast.error('Помилка додавання');
        }
    };

    const handleRemove = async (id: string) => {
        try {
            const { error } = await supabase
                .from('products')
                .update({ is_popular: false, popular_order: null })
                .eq('id', id);

            if (error) throw error;
            toast.success('Видалено');

            const newFeatured = featured.filter(f => f.id !== id);
            setFeatured(newFeatured);
            updateOrderInDB(newFeatured);
        } catch (error) {
            toast.error('Помилка видалення');
        }
    };

    return (
        <div style={{ maxWidth: '900px', margin: '0 auto', color: '#263A99' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px' }}>
                <div>
                    <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '32px', fontWeight: 900, marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <Star className="text-amber-500" fill="currentColor" size={32} /> Популярні товари
                    </h1>
                    <p style={{ color: '#64748b', fontSize: '15px' }}>Ці товари будуть виділені на головній сторінці сайту.</p>
                </div>
                <div style={counterStyle}>
                    <span style={{ color: featured.length >= 8 ? '#ef4444' : '#64748b' }}>{featured.length}</span> / 8
                </div>
            </div>

            {/* Premium Search */}
            <div style={{ marginBottom: '40px', position: 'relative' }}>
                <div style={searchContainerStyle}>
                    <Search size={20} color="#94a3b8" />
                    <input
                        type="text"
                        placeholder="Шукати товари для додавання..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        style={searchInputStyle}
                    />
                    {isSearching && <Loader2 size={18} className="animate-spin" color="#cbd5e1" />}
                </div>

                {searchQuery.trim().length >= 2 && (
                    <div style={resultsDropdownStyle}>
                        {searchResults.length > 0 ? (
                            searchResults.map(result => (
                                <div key={result.id} style={resultItemStyle}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                        <div style={smallThumbStyle}>
                                            {result.images?.[0] ? <img src={result.images[0]} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <ImageIcon size={14} color="#cbd5e1" />}
                                        </div>
                                        <div style={{ fontWeight: 700, fontSize: '14px' }}>{result.name}</div>
                                    </div>
                                    <button
                                        onClick={() => handleAdd(result)}
                                        disabled={featured.length >= 8}
                                        style={addBadgeStyle}
                                    >
                                        <Plus size={14} /> Додати
                                    </button>
                                </div>
                            ))
                        ) : !isSearching && (
                            <div style={{ padding: '20px', textAlign: 'center', color: '#94a3b8', fontSize: '14px' }}>Нічого не знайдено</div>
                        )}
                    </div>
                )}
            </div>

            {/* Sorted List */}
            <div style={listContainerStyle}>
                {isLoading ? (
                    <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}>
                        <Loader2 className="animate-spin" size={32} color="#cbd5e1" />
                    </div>
                ) : featured.length === 0 ? (
                    <div style={emptyStateStyle}>
                        <Layout size={40} color="#cbd5e1" style={{ marginBottom: '16px' }} />
                        <p style={{ color: '#64748b', fontWeight: 600 }}>Список порожній. Скористайтеся пошуком вище.</p>
                    </div>
                ) : (
                    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                        <SortableContext items={featured.map(f => f.id)} strategy={verticalListSortingStrategy}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                {featured.map(product => (
                                    <SortableProductItem key={product.id} product={product} onRemove={handleRemove} />
                                ))}
                            </div>
                        </SortableContext>
                    </DndContext>
                )}
            </div>

            <div style={{ marginTop: '24px', padding: '16px 20px', backgroundColor: '#f8fafc', borderRadius: '16px', border: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#263A99' }}></div>
                <p style={{ fontSize: '13px', color: '#64748b', margin: 0 }}>Потягніть за іконку зліва, щоб змінити порядок відображення на сайті.</p>
            </div>
        </div>
    );
}

const counterStyle = { fontWeight: 900, fontSize: '14px', backgroundColor: 'white', padding: '10px 18px', borderRadius: '100px', border: '1px solid #f1f5f9', boxShadow: '0 4px 15px rgba(0,0,0,0.02)' };
const searchContainerStyle = { display: 'flex', alignItems: 'center', gap: '14px', padding: '14px 20px', backgroundColor: 'white', borderRadius: '20px', border: '1.5px solid #e2e8f0', boxShadow: '0 10px 30px rgba(0,0,0,0.03)', transition: 'all 0.2s' };
const searchInputStyle = { flex: 1, border: 'none', outline: 'none', fontSize: '16px', fontWeight: 600, color: '#263A99' };
const resultsDropdownStyle = { position: 'absolute' as any, top: 'calc(100% + 12px)', left: 0, right: 0, backgroundColor: 'white', borderRadius: '24px', border: '1px solid #f1f5f9', boxShadow: '0 20px 50px rgba(0,0,0,0.1)', overflow: 'hidden', zIndex: 50 };
const resultItemStyle = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid #f8fafc', transition: 'background 0.2s' };
const smallThumbStyle = { width: '40px', height: '40px', borderRadius: '10px', backgroundColor: '#f1f5f9', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' };
const addBadgeStyle = { display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', borderRadius: '10px', backgroundColor: '#eff6ff', color: '#2563eb', fontWeight: 800, fontSize: '12px', border: 'none', cursor: 'pointer' };
const listContainerStyle = { backgroundColor: '#f8fafc', borderRadius: '32px', padding: '24px', border: '1px solid #f1f5f9' };
const featuredItemStyle = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', backgroundColor: 'white', borderRadius: '20px', border: '1px solid #f1f5f9', boxShadow: '0 4px 15px rgba(0,0,0,0.01)', transition: 'all 0.2s' };
const thumbnailStyle = { width: '56px', height: '56px', borderRadius: '14px', backgroundColor: '#f8fafc', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' };
const dragHandleStyle = { padding: '8px', color: '#cbd5e1', cursor: 'grab', background: 'none', border: 'none' };
const removeBtnStyle = { padding: '10px', borderRadius: '12px', backgroundColor: '#fef2f2', color: '#ef4444', border: 'none', cursor: 'pointer', transition: 'all 0.2s' };
const emptyStateStyle = { textAlign: 'center' as any, padding: '60px 20px', display: 'flex', flexDirection: 'column' as any, alignItems: 'center' };
